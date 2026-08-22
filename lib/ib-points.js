/**
 * IB Diploma points.
 *
 * Six subjects are graded 1-7 (42 max). Theory of Knowledge and the Extended
 * Essay are graded A-E and combine to award up to 3 bonus points, giving the
 * 45-point maximum. A grade of E in either TOK or EE is a failing condition
 * for the Diploma.
 */

export const IB_CORE_SUBJECTS = [
  'Theory of Knowledge',
  'Extended Essay',
  'Creativity Activity Service',
]

export const CORE_GRADES = ['A', 'B', 'C', 'D', 'E']

export const MAX_SUBJECT_POINTS = 42
export const MAX_TOTAL_POINTS = 45

/**
 * Official IB bonus-point matrix. Rows are TOK, columns are EE.
 * 'F' marks a failing combination (an E in either component).
 */
const BONUS_MATRIX = {
  A: { A: 3, B: 3, C: 2, D: 2, E: 'F' },
  B: { A: 3, B: 2, C: 2, D: 1, E: 'F' },
  C: { A: 2, B: 2, C: 1, D: 0, E: 'F' },
  D: { A: 2, B: 1, C: 0, D: 0, E: 'F' },
  E: { A: 'F', B: 'F', C: 'F', D: 'F', E: 'F' },
}

/** Bonus points for a TOK/EE pair. Returns 0-3, or 'F' for a failing combination. */
export function coreBonusPoints(tokGrade, eeGrade) {
  if (!tokGrade || !eeGrade) return null
  return BONUS_MATRIX[tokGrade]?.[eeGrade] ?? null
}

/**
 * Predicted Diploma total from per-subject targets plus the core.
 * Only the six graded subjects count toward the 42; CAS is pass/fail.
 */
export function predictedTotal(targetGrades = {}, subjects = []) {
  const graded = subjects.filter((s) => !IB_CORE_SUBJECTS.includes(s))

  let subjectPoints = 0
  let gradedCount = 0
  for (const subject of graded) {
    const value = parseInt(targetGrades[subject], 10)
    if (!Number.isNaN(value)) {
      subjectPoints += value
      gradedCount++
    }
  }

  const tok = targetGrades['Theory of Knowledge']
  const ee = targetGrades['Extended Essay']
  const bonus = coreBonusPoints(tok, ee)

  return {
    subjectPoints,
    gradedCount,
    bonus,                                   // 0-3, 'F', or null when unset
    failing: bonus === 'F',
    total: subjectPoints + (typeof bonus === 'number' ? bonus : 0),
    complete: gradedCount === graded.length && graded.length > 0 && bonus !== null,
  }
}

export function isCoreSubject(subject) {
  return IB_CORE_SUBJECTS.includes(subject)
}
