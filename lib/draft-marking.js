import { draftReviewPrompt, draftScoresPrompt, DRAFT_REVIEW_SCHEMA, DRAFT_SCORES_SCHEMA } from './syllabi-prompts.js'

/**
 * Marking a draft: the full review, and the same work marked twice more for
 * the marks alone, all at once. Each criterion's mark is then the middle of
 * the three, so one reading that drifts a band up or down does not decide
 * a student's mark. The review's comments are kept; only its numbers are
 * settled by the three.
 *
 * Shared by app/api/syllabi (a student's draft) and scripts/marking-eval.mjs
 * (marked examples, to measure how close the marks are).
 *
 * content: the user message: a string, or content blocks (a PDF, page images).
 * Returns { answer, stop_reason, usage, extra } where answer is the review's
 * JSON text and extra holds the two marks-only readings.
 */

const add = (a = {}, b = {}) => {
  const out = { ...a }
  for (const k of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) {
    out[k] = (a[k] || 0) + (b[k] || 0)
  }
  return out
}

export async function markDraft({ anthropic, model, kind, subject, rubric, question, guide, content, maxTokens, signal, readings = 2 }) {
  const reviewCall = anthropic.messages
    .stream(
      {
        model,
        max_tokens: maxTokens,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: DRAFT_REVIEW_SCHEMA } },
        system: draftReviewPrompt({ kind, subject, rubric, question, guide }),
        messages: [{ role: 'user', content }],
      },
      { signal }
    )
    .finalMessage()

  // The extra readings only make sense against known criteria.
  const scoreCalls = rubric
    ? Array.from({ length: readings }, () =>
        anthropic.messages
          .stream(
            {
              model,
              max_tokens: 6000,
              output_config: { effort: 'medium', format: { type: 'json_schema', schema: DRAFT_SCORES_SCHEMA } },
              system: draftScoresPrompt({ kind, subject, rubric, guide }),
              messages: [{ role: 'user', content }],
            },
            { signal }
          )
          .finalMessage()
          .catch(() => null)
      )
    : []

  const [review, ...scored] = await Promise.all([reviewCall, ...scoreCalls])
  let usage = review.usage
  const extra = []
  for (const m of scored) {
    if (!m) continue
    usage = add(usage, m.usage)
    try {
      const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      extra.push(JSON.parse(text).criteria || [])
    } catch {
      /* a reading that did not parse is left out */
    }
  }
  const answer = review.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
  return { answer, stop_reason: review.stop_reason, usage, extra }
}

/** Each criterion's mark becomes the middle of the review's and the extra readings'. */
export function settleMarks(criteria, extra) {
  return criteria.map((c) => {
    const marks = [c.score]
    for (const reading of extra) {
      const r = reading.find((x) => String(x.id).trim().toUpperCase() === c.id)
      if (r && Number.isFinite(Number(r.score))) marks.push(Math.max(0, Math.min(c.max, Math.round(Number(r.score)))))
    }
    marks.sort((a, b) => a - b)
    return { ...c, score: marks[Math.floor((marks.length - 1) / 2)], readings: marks }
  })
}
