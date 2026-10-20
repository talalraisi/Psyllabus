import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { TASKS, DRAFT_REVIEW_SCHEMA } from '@/lib/syllabi-prompts'
import { rubricFor } from '@/lib/criteria'
import { cleanReview } from '@/lib/draft-review'
import { RESEARCH_SCHEMA, STUDY_SCHEMA, cleanResearch, cleanStudy } from '@/lib/ideas'
import { hasSyllabi } from '@/lib/access'
import { MODELS, claim, settle } from '@/lib/ai-cost'
// Only this deployment and our own domains: any *.vercel.app origin used to
// pass, and anyone can put a page on vercel.app.
import { fromOurOwnSite, supabaseFor } from '@/lib/request-supabase'

/**
 * Syllabi: the one place in the app that talks to a model at request time.
 *
 * Everything else — questions, flashcards — is generated in advance by a
 * script and checked before a student ever sees it. This is different: the
 * student's own draft goes in, so it has to happen now, and that means three
 * things have to be true before a single token is spent.
 *
 * 1. It is a signed-in student. The key is ours; an open endpoint is a bill.
 * 2. They have not already had their allowance today, and the day's budget
 *    across everyone is not spent. Claimed in the database before the call,
 *    under a lock, so parallel requests cannot all slip through
 *    (062-ai-limits.sql).
 * 3. The task is one of ours. Free-form prompts from the browser would make
 *    the integrity rules decorative.
 *
 * The model never sees who the student is. It sees a task, a subject and the
 * text they pasted.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A full draft review can write for a minute or two.
export const maxDuration = 300

/** Longest draft accepted, in characters. An EE is about 25,000. */
const MAX_INPUT = 60000

/** Everything except a draft is a sentence or two. */
const MAX_SHORT = 2000

/** Every task answers as JSON the page lays out. */
const SCHEMAS = { draft_feedback: DRAFT_REVIEW_SCHEMA, research_questions: RESEARCH_SCHEMA, study_advice: STUDY_SCHEMA }

/** A short string, or nothing. These go into the instructions, so they are cut to size. */
const short = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 150)) : undefined)

export async function POST(request) {
  if (!fromOurOwnSite(request)) {
    return NextResponse.json({ error: 'Not allowed from there.' }, { status: 403 })
  }

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

  const { task, text = '' } = body || {}
  const kind = ['ia', 'ee', 'tok'].includes(body?.kind) ? body.kind : 'ia'
  const topic = short(body?.topic, 200)
  const interest = short(body?.interest, 1000)
  const weak = list(body?.weak)
  const strong = list(body?.strong)

  const build = TASKS[task]
  if (!build) {
    return NextResponse.json({ error: 'Unknown task.' }, { status: 400 })
  }

  const limit = task === 'draft_feedback' ? MAX_INPUT : MAX_SHORT
  if (typeof text !== 'string' || text.length > limit) {
    return NextResponse.json(
      { error: `That is longer than Syllabi reads in one go (${limit.toLocaleString()} characters).` },
      { status: 413 }
    )
  }

  const supabase = supabaseFor(request)
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
    .select('plan, is_admin, access_expires_at, subjects')
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

  // One of their own subjects, since it goes into the instructions.
  const subject = (profile.subjects || []).includes(body?.subject) ? body.subject : ''

  const claimed = await claim(supabase, task, subject)
  if (!claimed.ok) {
    return NextResponse.json({ error: claimed.error, code: claimed.code }, { status: claimed.status })
  }

  const review = task === 'draft_feedback'
  const rubric = review ? rubricFor(kind, subject) : null
  const prompt = build({ kind, subject, topic, interest, weak, strong, rubric })
  const anthropic = new Anthropic()
  const model = MODELS.writing

  let response
  try {
    // Streamed, then collected: a long review would otherwise sit on one
    // open request long enough to time out.
    response = await anthropic.messages
      .stream({
      model,
      // Thinking counts towards this, so it leaves room for the answer. With
      // the input caps above, it is what makes the claim's reservation a
      // ceiling (062-ai-limits.sql).
      max_tokens: review ? 12000 : 3000,
      // A draft comes back as JSON the page can lay out: marks per criterion
      // and highlights on the student's own sentences.
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMAS[task] } },
      system: prompt,
      messages: [
        {
          role: 'user',
          content: text.trim() || 'No text provided.',
        },
      ],
    }, { signal: request.signal })
      .finalMessage()
  } catch (e) {
    // The student gets a sentence, not a stack trace; the log gets the detail.
    console.error('syllabi:', e?.message || e)
    // A page closed part-way may already have been charged, so that stays
    // reserved; anything else failed before the model wrote a word.
    await settle(supabase, claimed.id, model, request.signal.aborted ? undefined : null).catch(() => {})
    return NextResponse.json(
      { error: 'Syllabi could not answer that just now. Try again in a minute.' },
      { status: 502 }
    )
  }

  const answer =
    response.stop_reason === 'refusal'
      ? 'Syllabi can’t help with that one.'
      : response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim()

  // Settled with what it actually cost, so the day's budget is exact.
  await settle(supabase, claimed.id, model, response.usage).catch(() => {})

  // Every task answers as JSON; it is checked before the page sees it.
  const parsed =
    response.stop_reason !== 'end_turn'
      ? null
      : review
        ? cleanReview(answer, text, rubric)
        : task === 'research_questions'
          ? cleanResearch(answer)
          : cleanStudy(answer)
  if (!parsed) {
    return NextResponse.json(
      { error: response.stop_reason === 'refusal' ? answer : 'Syllabi could not finish that. Try again, or send a shorter part.' },
      { status: 502 }
    )
  }
  return NextResponse.json(review ? { review: parsed, remaining: claimed.remaining } : { result: parsed, remaining: claimed.remaining })
}
