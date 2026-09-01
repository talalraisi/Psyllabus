/**
 * Predicted Diploma score.
 *
 * Converts verified quiz accuracy into a predicted 1-7 grade per subject, then
 * a predicted total out of 45 alongside the student's target.
 *
 * The mapping is deliberately conservative and stated openly in the UI: an
 * untested subtopic contributes nothing, so a prediction built on three quizzes
 * is shown as low confidence rather than dressed up as certainty.
 */

import { progressKey } from './progress'
import { IB_CORE_SUBJECTS, coreBonusPoints } from './ib-points'
import { CURRICULA, curriculumOf, gradeToFraction } from './curriculum'

/**
 * Mastery score for one subtopic, 0-1.
 * Mirrors the status thresholds used when a quiz is marked.
 */
const STATUS_VALUE = {
  mastered: 1,
  proficient: 0.8,
  decaying: 0.7, // was known, now unreliable
  confident: 0.5,
  in_progress: 0.25,
  not_started: 0,
}

/**
 * Mastery to a grade on whatever scale the curriculum uses.
 *
 * The bands used to be hardcoded to the IB's 1 to 7, so an A-Level student was
 * predicted a "5" and an AP student a "6". The shape is kept: the top grade
 * needs 85% of the syllabus held, and the scale is stretched to fit however
 * many grades the curriculum has.
 */
const TOP_BAND = 0.85
const BOTTOM_BAND = 0.15

export function gradeFromMastery(fraction, curriculum = 'IB') {
  const scale = (CURRICULA[curriculum] || CURRICULA.IB).grades
  if (fraction >= TOP_BAND) return scale[0]
  if (fraction < BOTTOM_BAND) return scale[scale.length - 1]
  // Spread the remaining grades evenly between the two ends.
  const span = TOP_BAND - BOTTOM_BAND
  const step = span / (scale.length - 1)
  // ceil, with a nudge for floating point: a fraction sitting exactly on a
  // boundary should earn the higher grade, and 0.7333... lands a hair under
  // its own boundary once divided.
  const from_top = Math.ceil((TOP_BAND - fraction) / step - 1e-9)
  return scale[Math.min(scale.length - 1, Math.max(0, from_top))]
}

/** How much of a subject has actually been tested, 0-1. */
function coverage(subtopics, effectiveMap, subject) {
  if (!subtopics.length) return 0
  const tested = subtopics.filter(
    (s) => (effectiveMap[progressKey(subject, s.subtopic)] || 'not_started') !== 'not_started'
  ).length
  return tested / subtopics.length
}

/**
 * Per-subject prediction.
 * `mastery` is the fraction of the syllabus held, which drives the grade.
 * `confidence` reflects how much of the subject has been tested at all.
 */
export function predictSubject(subject, subtopics, effectiveMap, curriculum = 'IB') {
  if (!subtopics.length) {
    return { subject, mastery: 0, grade: null, coverage: 0, confidence: 'none', tested: 0, total: 0 }
  }

  let sum = 0
  let tested = 0
  for (const s of subtopics) {
    const status = effectiveMap[progressKey(subject, s.subtopic)] || 'not_started'
    sum += STATUS_VALUE[status] ?? 0
    if (status !== 'not_started') tested++
  }

  const mastery = sum / subtopics.length
  const cov = tested / subtopics.length

  return {
    subject,
    mastery,
    grade: tested === 0 ? null : gradeFromMastery(mastery, curriculum),
    coverage: cov,
    confidence: cov >= 0.6 ? 'high' : cov >= 0.25 ? 'medium' : cov > 0 ? 'low' : 'none',
    tested,
    total: subtopics.length,
  }
}

/**
 * Prediction across everything the student takes.
 *
 * Works for any curriculum. Only the IB is added into a total, because only the
 * IB is scored as one: A-Levels and APs are read as a set of separate results,
 * so a combined number would be one nobody uses.
 *
 * The core bonus is NOT predicted. TOK and the Extended Essay are coursework,
 * and nothing here has seen a word of either, so awarding up to 3 points off
 * the back of a target the student typed in would inflate every prediction by
 * exactly the amount they hoped for. The bonus is reported separately as what
 * their targets would be worth, and left out of the predicted total.
 */
export function predictDiploma({ profile, syllabusRows = [], effectiveMap = {} }) {
  const rules = curriculumOf(profile)
  const all = profile?.subjects || []
  const graded = rules.hasCore ? all.filter((s) => !IB_CORE_SUBJECTS.includes(s)) : all
  const targets = profile?.target_grades || {}

  const subjects = graded.map((subject) =>
    predictSubject(
      subject,
      syllabusRows.filter((r) => r.subject === subject),
      effectiveMap,
      rules.id
    )
  )

  // Compared as positions on the scale, so A* beats A and 7 beats 6 without
  // this code knowing which curriculum it is looking at.
  const withTargets = subjects.map((s) => {
    const target = targets[s.subject] ?? null
    const tf = target == null ? null : gradeToFraction(rules.id, target)
    const pf = s.grade == null ? null : gradeToFraction(rules.id, s.grade)
    return {
      ...s,
      target,
      // Positive means ahead of target, negative means behind, in grade steps.
      gap:
        tf == null || pf == null
          ? null
          : Math.round((pf - tf) * (rules.grades.length - 1)),
    }
  })

  const testedSubjects = withTargets.filter((s) => s.tested > 0).length
  const overallCoverage = withTargets.length
    ? withTargets.reduce((sum, s) => sum + s.coverage, 0) / withTargets.length
    : 0

  const confidence =
    overallCoverage >= 0.6 ? 'high' : overallCoverage >= 0.25 ? 'medium' : overallCoverage > 0 ? 'low' : 'none'

  const base = {
    curriculum: rules,
    subjects: withTargets,
    coverage: overallCoverage,
    testedSubjects,
    confidence,
    hasTotal: rules.hasTotal,
  }

  if (!rules.hasTotal) {
    // No combined score. Progress is how many subjects are at or above target.
    const onTargetCount = withTargets.filter((s) => s.gap !== null && s.gap >= 0).length
    const comparable = withTargets.filter((s) => s.gap !== null).length
    return {
      ...base,
      onTargetCount,
      comparable,
      onTrack: comparable > 0 && onTargetCount === comparable,
      percentToTarget: comparable > 0 ? Math.round((onTargetCount / comparable) * 100) : 0,
    }
  }

  // IB only from here.
  const toPoints = (g) => (g == null ? 0 : parseInt(g, 10) || 0)
  const predictedPoints = withTargets.reduce((sum, s) => sum + toPoints(s.grade), 0)
  const targetPoints = withTargets.reduce((sum, s) => sum + toPoints(s.target), 0)

  // Reported, never added in. See the note above.
  const bonus = coreBonusPoints(targets['Theory of Knowledge'], targets['Extended Essay'])
  const targetBonus = typeof bonus === 'number' ? bonus : null

  return {
    ...base,
    predictedPoints,
    targetPoints,
    targetBonus,
    coreFailing: bonus === 'F',
    predictedTotal: predictedPoints,
    targetTotal: targetPoints,
    maxSubjectPoints: rules.maxSubjectPoints,
    gap: predictedPoints - targetPoints,
    onTrack: predictedPoints >= targetPoints,
    percentToTarget: targetPoints > 0 ? Math.round((predictedPoints / targetPoints) * 100) : 0,
  }
}

export const CONFIDENCE_COPY = {
  none: 'No quiz data yet, so there is nothing to predict from.',
  low: 'Based on a small sample. Test more subtopics for a reliable figure.',
  medium: 'Based on partial coverage. Still moving as you test more.',
  high: 'Based on broad coverage of your syllabus.',
}
