import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseFor, fromOurOwnSite } from '@/lib/request-supabase'
import { hasSyllabi } from '@/lib/access'
import { MODELS, claim, settle } from '@/lib/ai-cost'
import { tutorSystem } from '@/lib/tutor-prompt'

/**
 * Syllabi as a tutor: a conversation, streamed.
 *
 * Every check that protects the bill happens before a token is spent, and in
 * this order: our own site, signed in, Premium, a sane request, then a claim
 * against the limits in the database (062-ai-limits.sql), which is the only
 * check that cannot be raced. Input and output are both capped here, which is
 * what makes the reservation the claim takes a true ceiling.
 *
 * The conversation lives in the student's browser, not our database: each
 * request carries the recent turns, trimmed here to a fixed size. The model
 * sees their course, their subject and the syllabus, never who they are.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_QUESTION = 2000 // characters in the message being sent
const MAX_TURN = 8000 // characters kept of any earlier turn
const MAX_HISTORY = 16000 // characters of conversation sent in all
const MAX_TURNS = 24
const MAX_OUTPUT = 2000 // tokens, thinking included

/** The recent conversation, cleaned and cut to size, or a reason it is unusable. */
function conversation(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return { error: 'Malformed conversation.' }
  const turns = []
  for (const t of raw) {
    if (!t || (t.role !== 'user' && t.role !== 'assistant') || typeof t.content !== 'string') {
      return { error: 'Malformed conversation.' }
    }
    const content = t.content.trim()
    if (content) turns.push({ role: t.role, content })
  }
  const last = turns[turns.length - 1]
  if (!last || last.role !== 'user') return { error: 'Ask something first.' }
  if (last.content.length > MAX_QUESTION) {
    return { error: `That is a lot for one message. Keep it under ${MAX_QUESTION.toLocaleString()} characters.`, status: 413 }
  }

  // Newest first, until the budget runs out.
  const kept = []
  let size = 0
  for (let i = turns.length - 1; i >= 0 && kept.length < MAX_TURNS; i--) {
    const content = turns[i].content.slice(0, MAX_TURN)
    if (size + content.length > MAX_HISTORY && kept.length) break
    size += content.length
    kept.unshift({ role: turns[i].role, content })
  }
  // The model's side of a conversation always follows a student turn.
  while (kept.length && kept[0].role !== 'user') kept.shift()
  return { messages: kept }
}

export async function POST(request) {
  if (!fromOurOwnSite(request)) return NextResponse.json({ error: 'Not allowed from there.' }, { status: 403 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Syllabi is not switched on yet.', code: 'not_configured' }, { status: 503 })
  }

  const supabase = supabaseFor(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, is_admin, access_expires_at, subjects, curriculum')
    .eq('id', user.id)
    .maybeSingle()
  if (!hasSyllabi(profile)) {
    return NextResponse.json({ error: 'Syllabi is part of Premium.', code: 'upgrade_required' }, { status: 402 })
  }

  const body = await request.json().catch(() => null)
  const { messages, error, status } = conversation(body?.messages)
  if (error) return NextResponse.json({ error }, { status: status || 400 })

  // Only one of their own subjects, and only a topic that is in it: both go
  // into the instructions, so neither can be free text.
  const subject = (profile.subjects || []).includes(body?.subject) ? body.subject : ''
  let rows = []
  if (subject) {
    const { data } = await supabase
      .from('syllabus_content')
      .select('topic, unit, subtopic, hl_only, position')
      .eq('subject', subject)
      .order('position')
      .limit(600)
    rows = data || []
  }
  const named = new Set(rows.flatMap((r) => [r.topic, r.unit, r.subtopic]))
  const topic = typeof body?.topic === 'string' && named.has(body.topic) ? body.topic : ''

  const claimed = await claim(supabase, 'tutor', subject)
  if (!claimed.ok) return NextResponse.json({ error: claimed.error, code: claimed.code }, { status: claimed.status })

  const model = MODELS.tutor
  const anthropic = new Anthropic()
  const stream = anthropic.messages.stream(
    {
      model,
      max_tokens: MAX_OUTPUT,
      output_config: { effort: 'medium' },
      system: tutorSystem({ curriculum: profile.curriculum, subject, topic, rows }),
      messages,
    },
    { signal: request.signal }
  )

  const encoder = new TextEncoder()
  let settled = false
  const finish = async (usage) => {
    if (settled) return
    settled = true
    await settle(supabase, claimed.id, model, usage).catch(() => {})
  }

  const body$ = new ReadableStream({
    async start(controller) {
      let sent = false
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            sent = true
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        const final = await stream.finalMessage()
        await finish(final.usage)
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode(sent ? '\n\nI have to stop there.' : 'I can’t help with that one. Ask me something about your subjects.'))
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode('\n\nThat ran long, so it stops there. Ask me to carry on.'))
        }
      } catch (e) {
        if (request.signal.aborted) {
          // They closed the page: whatever was spent stays reserved.
          await finish(undefined)
        } else {
          console.error('syllabi tutor:', e?.status || '', e?.message || e)
          // Nothing streamed means nothing was spent.
          await finish(sent ? undefined : null)
          controller.enqueue(encoder.encode(sent ? '\n\nSyllabi lost the connection. Try again.' : 'Syllabi could not answer just now. Try again in a minute.'))
        }
      }
      try {
        controller.close()
      } catch {
        /* already closed by the client */
      }
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(body$, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-syllabi-remaining': String(claimed.remaining ?? ''),
    },
  })
}
