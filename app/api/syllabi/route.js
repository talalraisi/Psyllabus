import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { TASKS, DRAFT_REVIEW_SCHEMA } from '@/lib/syllabi-prompts'
import { rubricFor } from '@/lib/criteria'
import { cleanReview } from '@/lib/draft-review'
import { senseCheck } from '@/lib/sense-check'
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const kind = ['ia', 'ee', 'tok', 'p1', 'p2'].includes(body?.kind) ? body.kind : 'ia'
  // For an exam paper: the question answered, and any extract. Capped, and
  // sent as material in the message, never in the instructions.
  const question = task === 'draft_feedback' && (kind === 'p1' || kind === 'p2') ? short(body?.question, 8000) : ''
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

  // Nonsense is turned away here, for free, before it can cost a review or
  // a place in the student's allowance.
  if (task === 'draft_feedback') {
    const why = senseCheck(text)
    if (why) return NextResponse.json({ error: why, code: 'not_writing' }, { status: 422 })
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
  const prompt = build({ kind, subject, topic, interest, weak, strong, rubric, question })
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
          content: question ? `QUESTION / EXTRACT:\n${question}\n\n---\n\nSTUDENT ANSWER:\n${text.trim()}` : text.trim() || 'No text provided.',
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
  // Kept on the student's account, so a marking or a set of ideas is there
  // to come back to (069-syllabi-saved.sql). Saved here rather than by the
  // page, so it is kept even if they close the tab while it was working. A
  // failure to save is logged and does not cost them the answer.
  let saved = null
  if (review) {
    const draftId = UUID.test(body?.draft_id || '') ? body.draft_id : crypto.randomUUID()
    const total = parsed.criteria.reduce((a, c) => a + c.score, 0)
    const outOf = parsed.criteria.reduce((a, c) => a + c.max, 0)
    const { data, error: saveError } = await supabase
      .from('syllabi_marks')
      .insert({
        user_id: user.id,
        draft_id: draftId,
        subject: subject || null,
        kind,
        title: (text.trim().split('\n').find((l) => l.trim()) || 'Untitled draft').trim().slice(0, 160),
        text,
        question: question || null,
        review: parsed,
        total,
        out_of: outOf,
        grade: parsed.grade_estimate.slice(0, 4) || null,
      })
      .select('id, draft_id, created_at')
      .single()
    if (saveError) console.error('syllabi save mark:', saveError.message)
    saved = data || null
  } else {
    const { data, error: saveError } = await supabase
      .from('syllabi_ideas')
      .insert({
        user_id: user.id,
        mode: task === 'research_questions' ? 'research' : 'study',
        subject: subject || null,
        kind: task === 'research_questions' && kind !== 'tok' ? kind : null,
        prompt: text.slice(0, 2000),
        result: parsed,
      })
      .select('id, created_at')
      .single()
    if (saveError) console.error('syllabi save ideas:', saveError.message)
    saved = data || null
  }

  return NextResponse.json(
    review ? { review: parsed, saved, remaining: claimed.remaining } : { result: parsed, saved, remaining: claimed.remaining }
  )
}
