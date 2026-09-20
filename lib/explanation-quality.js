/**
 * Does this explanation read like it was written for a student?
 *
 * The generator already checks that the worked answer agrees with the marked
 * one. It never checked the prose. So a question shipped whose explanation
 * was the model arguing with itself — working out that the stem it had just
 * written did not match the answer it had just recorded, deciding to change
 * the stem, and then not changing it:
 *
 *   "...Q = 10. Wait, I think I messed up... But the accepted_answers is
 *   [5, 5.0]. That's not right. I need to fix this. Let's change the TC..."
 *
 * A student answering correctly was marked wrong and then shown that. Any
 * one of those three things is worse than an empty subtopic.
 *
 * The tells are deliberately narrow. "However" and "note that" are ordinary
 * teaching words. "Wait," and "I need to fix this" are not sentences that
 * appear in an explanation written for somebody else to read.
 */

export const SCRATCHPAD_TELLS = [
  'wait,',
  'wait.',
  'i messed up',
  "that's not right",
  "let's try",
  "let's change",
  'let me fix',
  'i need to fix',
  'accepted_answers',
  'adjust the stem',
  "let's do it again",
  'hmm,',
  'actually, let',
  "so let's",
  "i'll change",
  'i should change',
  'on second thought',
]

/** The first tell found, or null. Case-insensitive, substring. */
export function scratchpadTell(text) {
  if (!text) return null
  const haystack = String(text).toLowerCase()
  return SCRATCHPAD_TELLS.find((t) => haystack.includes(t)) || null
}

/** True when any field of a question reads like the model talking to itself. */
export function readsLikeScratchpad(question) {
  if (!question) return null
  const fields = [
    question.explanation,
    question.hint,
    question.stem,
    question.option_feedback && JSON.stringify(question.option_feedback),
    question.optionFeedback && JSON.stringify(question.optionFeedback),
  ]
  for (const f of fields) {
    const tell = scratchpadTell(f)
    if (tell) return tell
  }
  return null
}
