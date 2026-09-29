import { progressKey } from './progress.js'

/**
 * Forgetting, in two stages.
 *
 * Something you proved and then left alone does not stay proved, and it does
 * not fall straight to the floor either. So there are two boundaries rather
 * than one:
 *
 *   day 0 .. 14    it stands. You proved it recently enough.
 *   day 14 .. 35   Fading. Its own colour, back in the plan for a short
 *                  retest. This is a warning, and it is reversible by
 *                  answering correctly once.
 *   day 35+        Weak. The fade ran its course and nothing came back, so
 *                  it is treated as not known rather than as slipping.
 *
 * Developing now fades too. It used to be that only Mastered and Proficient
 * could fade, which said that a half-learned topic left for a month was in
 * better shape than a mastered one left for the same month. It is not. The
 * further up you were, the further you have to fall, but everybody falls.
 *
 * Weak and Untested are not in the set: there is nowhere below Weak to go,
 * and Untested is the absence of a level rather than a level.
 *
 * None of this writes to the database. The saved status is what you proved,
 * decay is what it is worth today, and it is applied at read time so that
 * answering one question correctly restores it without a migration.
 */

/** Untouched this long and it starts fading. */
export const DECAY_DAYS = 14

/** And fading lasts this long before it counts as not known. */
export const FADE_DAYS = 21

const DAY_MS = 24 * 60 * 60 * 1000

const FADES = new Set(['mastered', 'proficient', 'confident'])

/** Where a lapsed subtopic lands. Weak, not Untested: you did once prove it,
 *  and the map should not claim you have never been tested on it. */
const LAPSED = 'in_progress'

/**
 * Days since the last correct answer, not since the row was last written.
 *
 * progress.updated_at is bumped by any quiz touching the subtopic, including
 * one where every answer was wrong, so a Fading subtopic could be cleared by
 * sitting a quiz and failing it. Retention has to be re-proved, not just
 * revisited. Rows written before this column existed fall back to updated_at.
 */
function ageInDays(lastCorrectAt, now) {
  if (!lastCorrectAt) return null
  return (now - new Date(lastCorrectAt).getTime()) / DAY_MS
}

/** Showing as Fading: past the first boundary, not yet past the second. */
export function isDecayed(status, lastCorrectAt, now = Date.now()) {
  if (!FADES.has(status)) return false
  const age = ageInDays(lastCorrectAt, now)
  if (age === null) return false
  return age > DECAY_DAYS && age <= DECAY_DAYS + FADE_DAYS
}

/** Fully lapsed: the fade ran out and nothing came back. */
export function hasLapsed(status, lastCorrectAt, now = Date.now()) {
  if (!FADES.has(status)) return false
  const age = ageInDays(lastCorrectAt, now)
  return age !== null && age > DECAY_DAYS + FADE_DAYS
}

/** Days left before a fading subtopic drops to Weak, or null if not fading. */
export function daysOfFadeLeft(status, lastCorrectAt, now = Date.now()) {
  if (!isDecayed(status, lastCorrectAt, now)) return null
  return Math.max(0, Math.ceil(DECAY_DAYS + FADE_DAYS - ageInDays(lastCorrectAt, now)))
}

export function effectiveStatus(status, lastCorrectAt, now = Date.now()) {
  if (hasLapsed(status, lastCorrectAt, now)) return LAPSED
  if (isDecayed(status, lastCorrectAt, now)) return 'decaying'
  return status
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
