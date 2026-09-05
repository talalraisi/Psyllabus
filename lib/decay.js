import { progressKey } from './progress'

/**
 * Dynamic mastery decay, a simple forgetting-curve rule.
 * A subtopic marked mastered that has not been re-verified (status saved or
 * quiz passed, both of which bump progress.updated_at) in more than
 * DECAY_DAYS days degrades to a derived 'decaying' status. The underlying
 * saved status is never mutated; decay is applied at read time.
 */
export const DECAY_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

const FADES = new Set(['mastered', 'proficient'])

/**
 * Fading is measured from the last correct answer, not the last time the row
 * was written.
 *
 * progress.updated_at is bumped by any quiz touching the subtopic, including
 * one where every answer was wrong, so a Fading subtopic could be cleared by
 * sitting a quiz and failing it. Retention has to be re-proved, not just
 * revisited. Rows written before this column existed fall back to updated_at.
 */
export function isDecayed(status, lastCorrectAt, now = Date.now()) {
  if (!FADES.has(status) || !lastCorrectAt) return false
  return now - new Date(lastCorrectAt).getTime() > DECAY_DAYS * DAY_MS
}

export function effectiveStatus(status, lastCorrectAt, now = Date.now()) {
  return isDecayed(status, lastCorrectAt, now) ? 'decaying' : status
}

export function daysSince(updatedAt, now = Date.now()) {
  if (!updatedAt) return null
  return Math.floor((now - new Date(updatedAt).getTime()) / DAY_MS)
}

/** key → { status, points, updatedAt } (raw, no decay applied) */
export function buildProgressDetailMap(progressRows) {
  return (progressRows || []).reduce((acc, p) => {
    acc[progressKey(p.subject, p.subtopic)] = {
      status: p.status,
      points: Number(p.mastery_points) || 0,
      covered: !!p.covered,
      reviewedAt: p.reviewed_at,
      reviewMinutes: p.review_minutes || 0,
      // Falls back for rows written before last_correct_at existed.
      updatedAt: p.last_correct_at || p.updated_at,
    }
    return acc
  }, {})
}

/** key → status with decay applied. Drop-in replacement for buildProgressMap. */
export function buildEffectiveProgressMap(progressRows, now = Date.now()) {
  return (progressRows || []).reduce((acc, p) => {
    acc[progressKey(p.subject, p.subtopic)] = effectiveStatus(
      p.status,
      p.last_correct_at || p.updated_at,
      now
    )
    return acc
  }, {})
}
