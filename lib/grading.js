/**
 * Marking a typed answer.
 *
 * The rule that matters: a student must never be the one deciding whether they
 * were right, because mastery points come from this and the whole product
 * rests on those being earned rather than claimed. So only answers a machine
 * can judge objectively are markable here, and anything else is practice
 * without points.
 *
 * Everything is deliberately forgiving about form and strict about value.
 * Someone who knows the answer is 9.81 should not lose the mark for writing
 * "9.81 m/s^2", and someone who writes 9 should not get it.
 */

/** Relative tolerance when a question does not set its own. */
export const DEFAULT_TOLERANCE = 0.01

/** Units, words and symbols that carry no meaning for correctness. */
const NOISE = /\b(m\/s\^?2|m\/s|ms\^?-1|m|cm|mm|km|kg|g|s|n|j|w|v|a|k|mol|c|hz|pa|approximately|approx|about|roughly|around|answer|is|equals|=)\b/gi

export function normaliseText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^\w\s./^+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Read a number out of what someone typed.
 * Handles fractions, scientific notation, thousands separators and a trailing
 * unit, and returns null when there is no number in there at all.
 */
export function parseNumber(value) {
  if (value == null) return null
  let s = String(value).trim().toLowerCase()
  if (!s) return null

  s = s.replace(/,(?=\d{3}\b)/g, '') // thousands separators only
  s = s.replace(NOISE, ' ').trim()
  s = s.replace(/\s+/g, '')

  // 3/4 and -2/5
  const fraction = s.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))\/(-?(?:\d+(?:\.\d+)?|\.\d+))$/)
  if (fraction) {
    const d = parseFloat(fraction[2])
    return d === 0 ? null : parseFloat(fraction[1]) / d
  }

  // 6.02e23, 6.02 x 10^23, 6.02*10^23
  const sci = s.match(/^(-?\d+(?:\.\d+)?)(?:[x*]10\^?|e)(-?\d+)$/)
  if (sci) return parseFloat(sci[1]) * Math.pow(10, parseInt(sci[2], 10))

  const plain = s.match(/^-?(?:\d+(?:\.\d+)?|\.\d+)$/)
  return plain ? parseFloat(s) : null
}

/**
 * Is `given` close enough to `expected`?
 * Relative for large numbers, absolute near zero, where a relative tolerance
 * would demand impossible precision.
 */
export function numbersMatch(given, expected, tolerance = DEFAULT_TOLERANCE) {
  if (given == null || expected == null) return false
  const scale = Math.abs(expected)
  const allowed = scale < 1e-9 ? tolerance : scale * tolerance
  return Math.abs(given - expected) <= allowed
}

/**
 * Mark one typed answer.
 * @returns {{correct: boolean, reason?: string}}
 */
export function gradeShortAnswer(question, response) {
  const accepted = Array.isArray(question?.accepted_answers)
    ? question.accepted_answers
    : question?.correct_answer != null
      ? [question.correct_answer]
      : []

  if (!accepted.length) return { correct: false, reason: 'This question has no answer recorded.' }
  if (!String(response ?? '').trim()) return { correct: false, reason: 'No answer given.' }

  const kind = question.answer_kind || (parseNumber(accepted[0]) != null ? 'numeric' : 'text')

  if (kind === 'numeric') {
    const given = parseNumber(response)
    if (given == null) return { correct: false, reason: 'That did not read as a number.' }
    const tolerance = Number(question.answer_tolerance) || DEFAULT_TOLERANCE
    const hit = accepted.some((a) => numbersMatch(given, parseNumber(a), tolerance))
    return { correct: hit }
  }

  const given = normaliseText(response)
  const hit = accepted.some((a) => normaliseText(a) === given)
  return { correct: hit }
}

/** Mark any question, whichever type it is. */
export function gradeAnswer(question, response) {
  if (question?.question_type === 'short_answer') {
    return gradeShortAnswer(question, response)
  }
  return { correct: response === question?.correct_answer }
}
