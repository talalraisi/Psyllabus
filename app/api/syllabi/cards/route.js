import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseFor, fromOurOwnSite } from '@/lib/request-supabase'
import { hasSyllabi } from '@/lib/access'
import { MODELS, claim, settle } from '@/lib/ai-cost'
import { toBlocks, AttachmentError } from '@/lib/attachments'
import { CARDS_SCHEMA as SCHEMA, cardsSystem as system, MAX_CARDS } from '@/lib/notes-cards'

/**
 * Syllabi turning a student's own notes into flashcards.
 *
 * Takes pasted notes and/or up to three files (photos of handwritten notes,
 * PDFs, text), and gives back cards for the student to check. Nothing is
 * saved here: the page shows the cards and only the ones approved are
 * written, by the student, under their own row rules.
 *
 * Same order of checks as the tutor, every one before a token is spent: our
 * own site, signed in, Premium, a sane request, then a claim against the
 * 'notes_cards' allowance (074-notes-cards.sql). Input and output are both
 * capped, which is what makes the reservation a true ceiling.
 *
 * The cards come only from the notes. A card the notes do not support is
 * worse than no card: the student would sit trying to recall something the
 * app made up.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_TEXT = 30000 // characters of pasted notes
const MAX_OUTPUT = 6000 // tokens

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
    return NextResponse.json({ error: 'Making cards from uploads is part of Premium.', code: 'upgrade_required' }, { status: 402 })
  }

  const body = await request.json().catch(() => null)
  const subject = (profile.subjects || []).includes(body?.subject) ? body.subject : ''
  if (!subject) return NextResponse.json({ error: 'Pick one of your subjects first.' }, { status: 400 })
  const subtopic = typeof body?.subtopic === 'string' ? body.subtopic.trim().slice(0, 120) : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: `That is a lot of notes at once. Keep it under ${MAX_TEXT.toLocaleString()} characters.` }, { status: 413 })
  }

  let files
  try {
    files = toBlocks(body?.attachments)
  } catch (e) {
    if (e instanceof AttachmentError) return NextResponse.json({ error: e.message }, { status: 413 })
    throw e
  }
  if (!files.blocks.length && text.length < 40) {
    return NextResponse.json({ error: 'Add a file, or paste a few lines of notes.' }, { status: 400 })
  }

  const claimed = await claim(supabase, 'notes_cards', subject)
  if (!claimed.ok) return NextResponse.json({ error: claimed.error, code: claimed.code }, { status: claimed.status })

  const model = MODELS.tutor
  let response
  try {
    response = await new Anthropic().messages
      .stream(
        {
          model,
          max_tokens: MAX_OUTPUT,
          output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
          system: system({ curriculum: profile.curriculum, subject, subtopic }),
          messages: [
            {
              role: 'user',
              content: [...files.blocks, { type: 'text', text: text ? `My notes:\n\n${text}` : 'Make flashcards from these notes.' }],
            },
          ],
        },
        { signal: request.signal }
      )
      .finalMessage()
  } catch (e) {
    console.error('syllabi cards:', e?.status || '', e?.message || e)
    await settle(supabase, claimed.id, model, request.signal.aborted ? undefined : null).catch(() => {})
    return NextResponse.json({ error: 'Syllabi could not read those notes just now. Try again in a minute.' }, { status: 502 })
  }

  await settle(supabase, claimed.id, model, response.usage).catch(() => {})

  if (response.stop_reason === 'refusal') {
    return NextResponse.json({ error: 'Syllabi can’t make cards from that.' }, { status: 422 })
  }

  let parsed = null
  try {
    parsed = JSON.parse(response.content.filter((b) => b.type === 'text').map((b) => b.text).join(''))
  } catch {
    parsed = null
  }
  // Checked before the page sees it: trimmed, capped, no empties, no repeats.
  const seen = new Set()
  const cards = (Array.isArray(parsed?.cards) ? parsed.cards : [])
    .map((c) => ({ front: String(c?.front || '').trim().slice(0, 400), back: String(c?.back || '').trim().slice(0, 1200) }))
    .filter((c) => c.front.length > 2 && c.back.length > 1 && !seen.has(c.front.toLowerCase()) && seen.add(c.front.toLowerCase()))
    .slice(0, MAX_CARDS)

  if (!cards.length) {
    return NextResponse.json(
      { error: String(parsed?.note || 'No cards came out of that. Try clearer photos, or notes with definitions and key facts.').slice(0, 300) },
      { status: 422 }
    )
  }

  return NextResponse.json({ cards, note: String(parsed?.note || '').slice(0, 300), remaining: claimed.remaining })
}
