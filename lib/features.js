/**
 * What is switched on.
 *
 * Some features need a language model at the moment a student uses them: a
 * chatbot, feedback written for the answer you actually gave, marking a
 * paragraph. Every one of those costs money per use, and the MVP deliberately
 * ships without an API key.
 *
 * The point of this file is that they fail honestly. A feature nobody can pay
 * for yet should say so and stay out of the way, not appear and then break, and
 * not be silently deleted so that turning it on later means rebuilding it. So
 * the code exists, the entry points exist, and they read as "not yet" until
 * NEXT_PUBLIC_AI_ENABLED is set.
 *
 * Switching it on is one environment variable, not a deploy of new code.
 */

/**
 * Runtime AI. Read from a NEXT_PUBLIC_ variable because the client needs to
 * know whether to offer the button at all; the key itself never leaves the
 * server.
 */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export const AI_FEATURES = {
  tutor: {
    name: 'Ask about this subtopic',
    blurb: 'A tutor that can answer a question about the thing in front of you.',
    why: 'Every message costs money to answer, so this waits until there are students using it.',
  },
  feedback: {
    name: 'Feedback on your answer',
    blurb: 'Why your answer was wrong, written for the answer you actually gave.',
    why: 'Needs a model to read your working, which is charged per answer.',
  },
  longAnswer: {
    name: 'Marked long answers',
    blurb: 'Essays and paragraphs marked against a mark scheme.',
    why: 'The most expensive kind to run. It opens once the product has users paying for it.',
  },
}

/**
 * What a student sees instead.
 *
 * Deliberately not a paywall: it is not a thing they can buy today, so pretending
 * otherwise would be a lie. It says what it will do and that it is not on yet.
 */
export function lockedCopy(key) {
  const f = AI_FEATURES[key]
  if (!f) return null
  return { title: f.name, blurb: f.blurb, why: f.why }
}
