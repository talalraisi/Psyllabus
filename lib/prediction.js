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

/** Grade boundaries as a fraction of syllabus mastered. */
const GRADE_BANDS = [
  { grade: 7, min: 0.85 },
  { grade: 6, min: 0.72 },
  { grade: 5, min: 0.58 },
  { grade: 4, min: 0.45 },
  { grade: 3, min: 0.3 },
  { grade: 2, min: 0.15 },
  { grade: 1, min: 0 },
]

export function gradeFromMastery(fraction) {
  return GRADE_BANDS.find((b) => fraction >= b.min)?.grade ?? 1
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
export function predictSubject(subject, subtopics, effectiveMap) {
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
    grade: tested === 0 ? null : gradeFromMastery(mastery),
    coverage: cov,
    confidence: cov >= 0.6 ? 'high' : cov >= 0.25 ? 'medium' : cov > 0 ? 'low' : 'none',
    tested,
    total: subtopics.length,
  }
}

/**
 * Whole-Diploma prediction against the student's targets.
 * Core components are excluded from the six graded subjects; TOK and EE
 * contribute through their target grades until they can be assessed directly.
 */
export function predictDiploma({ profile, syllabusRows = [], effectiveMap = {} }) {
  const all = profile?.subjects || []
  const graded = all.filter((s) => !IB_CORE_SUBJECTS.includes(s))
  const targets = profile?.target_grades || {}

  const subjects = graded.map((subject) =>
    predictSubject(
      subject,
      syllabusRows.filter((r) => r.subject === subject),
      effectiveMap
    )
  )

  const withTargets = subjects.map((s) => {
    const target = parseInt(targets[s.subject], 10)
    return {
      ...s,
      target: Number.isNaN(target) ? null : target,
      gap: Number.isNaN(target) || s.grade === null ? null : s.grade - target,
    }
  })

  const predictedPoints = withTargets.reduce((sum, s) => sum + (s.grade ?? 0), 0)
  const targetPoints = withTargets.reduce((sum, s) => sum + (s.target ?? 0), 0)

  // TOK and EE are targets rather than measurements until coursework is graded.
  const bonus = coreBonusPoints(targets['Theory of Knowledge'], targets['Extended Essay'])
  const bonusPoints = typeof bonus === 'number' ? bonus : 0

  const testedSubjects = withTargets.filter((s) => s.tested > 0).length
  const overallCoverage = withTargets.length
    ? withTargets.reduce((sum, s) => sum + s.coverage, 0) / withTargets.length
    : 0

  const predictedTotal = predictedPoints + bonusPoints
  const targetTotal = targetPoints + bonusPoints

  return {
    subjects: withTargets,
    predictedPoints,
    targetPoints,
    bonusPoints,
    predictedTotal,
    targetTotal,
    gap: predictedTotal - targetTotal,
    onTrack: predictedTotal >= targetTotal,
    coverage: overallCoverage,
    testedSubjects,
    confidence:
      overallCoverage >= 0.6 ? 'high' : overallCoverage >= 0.25 ? 'medium' : overallCoverage > 0 ? 'low' : 'none',
    // How far through the syllabus you would need to be for the target grade.
    percentToTarget: targetTotal > 0 ? Math.round((predictedTotal / targetTotal) * 100) : 0,
  }
}

export const CONFIDENCE_COPY = {
  none: 'No quiz data yet, so there is nothing to predict from.',
  low: 'Based on a small sample. Test more subtopics for a reliable figure.',
  medium: 'Based on partial coverage. Still moving as you test more.',
  high: 'Based on broad coverage of your syllabus.',
}
