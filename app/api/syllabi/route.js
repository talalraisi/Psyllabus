import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { cookieOptionsFor } from '@/lib/cookie-domain'
import { TASKS } from '@/lib/syllabi-prompts'
import { hasSyllabi } from '@/lib/access'

/**
 * Syllabi: the one place in the app that talks to a model at request time.
 *
 * Everything else — questions, flashcards — is generated in advance by a
 * script and checked before a student ever sees it. This is different: the
 * student's own draft goes in, so it has to happen now, and that means three
 * things have to be true before a single token is spent.
 *
 * 1. It is a signed-in student. The key is ours; an open endpoint is a bill.
 * 2. They have not already had their allowance today. Enforced by a count in
 *    the database rather than anything the client says about itself.
 * 3. The task is one of ours. Free-form prompts from the browser would make
 *    the integrity rules decorative.
 *
 * The model never sees who the student is. It sees a task, a subject and the
 * text they pasted.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** What one student may ask for in a day. Tuned to be generous and finite. */
const DAILY_LIMIT = 12

/** Longest draft accepted, in characters. An EE is about 25,000. */
const MAX_INPUT = 60000

const MODEL = process.env.SYLLABI_MODEL || 'claude-sonnet-5'

function client(request) {
  const cookieOptions = cookieOptionsFor(request.nextUrl.hostname)
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      ...(cookieOptions ? { cookieOptions } : {}),
      cookies: {
        getAll: () => request.cookies.getAll(),
        // Nothing here changes the session, so there is nothing to write back.
        setAll: () => {},
      },
    }
  )
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          'Syllabi is not switched on yet. It needs an API key in the server environment.',
        code: 'not_configured',
      },
      { status: 503 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const { task, text = '', subject = '', kind = 'ia', topic = '', interest = '', weak, strong } = body || {}

  const build = TASKS[task]
  if (!build) {
    return NextResponse.json({ error: 'Unknown task.' }, { status: 400 })
  }

  if (typeof text !== 'string' || text.length > MAX_INPUT) {
    return NextResponse.json(
      { error: `That is longer than Syllabi reads in one go (${MAX_INPUT.toLocaleString()} characters).` },
      { status: 413 }
    )
  }

  const supabase = client(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }

  // Syllabi is the thing Premium buys, so the check is here rather than only
  // on the button: an endpoint that trusts the UI to hide it is not gated.
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, is_admin, access_expires_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!hasSyllabi(profile)) {
    return NextResponse.json(
      {
        error: 'Syllabi is part of Premium.',
        code: 'upgrade_required',
      },
      { status: 402 }
    )
  }

  const { data: usedToday } = await supabase.rpc('ai_requests_today', { p_user: user.id })
  if ((usedToday || 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `That is ${DAILY_LIMIT} for today. Syllabi resets at midnight.`,
        code: 'limit_reached',
      },
      { status: 429 }
    )
  }

  const prompt = build({ kind, subject, topic, interest, weak, strong })
  const anthropic = new Anthropic()

  let response
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: text.trim() || 'No text provided.',
        },
      ],
    })
  } catch (e) {
    // The student gets a sentence, not a stack trace; the log gets the detail.
    console.error('syllabi:', e?.message || e)
    return NextResponse.json(
      { error: 'Syllabi could not answer that just now. Try again in a minute.' },
      { status: 502 }
    )
  }

  const answer = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  // Recorded after the fact, including the tokens, so the bill has a paper
  // trail per student rather than one number at the end of the month.
  await supabase.from('ai_usage').insert({
    user_id: user.id,
    task,
    subject: subject || null,
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
  })

  return NextResponse.json({
    answer,
    remaining: Math.max(0, DAILY_LIMIT - (usedToday || 0) - 1),
  })
}
