/**
 * Coverage, and what it is not.
 *
 * Two different questions about a subtopic:
 *
 *   Has my class covered this?   A fact about the course.
 *   Have I proved I know it?     A fact about me, and only a quiz answers it.
 *
 * The product refuses self-rated competence, and that stands. But refusing the
 * second question is not a reason to refuse the first, and the gap between them
 * is the most useful thing on the screen: taught but unproven is exactly what a
 * student should be working on, while never-taught is not their fault yet.
 *
 * This is also what lets the app do something on day one, before a single
 * question has been answered.
 */

import { progressKey } from './progress'

export const COVERAGE = {
  proven: 'proven', // covered and tested above Weak
  taught: 'taught', // covered in class, not yet proven
  ahead: 'ahead', // proven without being marked covered
  untaught: 'untaught', // not covered, not proven
}

export function coverageOf(detail) {
  const covered = !!detail?.covered
  const proven = (detail?.points || 0) > 0
  if (covered && proven) return COVERAGE.proven
  if (covered) return COVERAGE.taught
  if (proven) return COVERAGE.ahead
  return COVERAGE.untaught
}

export const COVERAGE_LABELS = {
  proven: 'Covered and proved',
  taught: 'Covered in class, not proved',
  ahead: 'Proved ahead of class',
  untaught: 'Not covered yet',
}

/**
 * A summary a student can read before they have answered anything.
 * `details` is the map from buildProgressDetailMap.
 */
export function summarise(subtopics, details, subject) {
  const counts = { proven: 0, taught: 0, ahead: 0, untaught: 0 }
  for (const s of subtopics) {
    counts[coverageOf(details[progressKey(subject, s.subtopic)])]++
  }
  const total = subtopics.length || 1
  return {
    ...counts,
    total: subtopics.length,
    // What the class has been through, whether or not it stuck.
    coveredPercent: Math.round(((counts.proven + counts.taught) / total) * 100),
    // What the student has actually shown.
    provenPercent: Math.round(((counts.proven + counts.ahead) / total) * 100),
    // The backlog: taught and not yet proved.
    gap: counts.taught,
  }
}

/** Days since a self-logged review, or null. */
export function daysSinceReview(detail, now = Date.now()) {
  if (!detail?.reviewedAt) return null
  return Math.floor((now - new Date(detail.reviewedAt).getTime()) / 86400000)
}
