import { progressKey } from './progress.js'

/**
 * Forgetting, on a curve.
 *
 * Memory fades fastest for what was only half learned and slowest for what
 * was learned well (the forgetting curve: each successful recall flattens
 * it). So how long a level holds depends on the level:
 *
 *                 holds      Fading       then             then
 *   Mastered      4 weeks    weeks 5-6    Developing wk 7  Weak
 *   Proficient    3 weeks    weeks 4-5    Developing wk 6  Weak
 *   Developing    2 weeks    weeks 3-4                     Weak
 *
 * Fading is a warning, its own colour and back in the plan for a short
 * retest; one correct answer restores the level. After it, a Mastered or
 * Proficient subtopic steps down to Developing for a week rather than
 * falling straight to the floor (you did know it, and some of it is still
 * there), and only then to Weak.
 *
 * Weak and Untested do not fade: there is nowhere below Weak to go, and
 * Untested is the absence of a level rather than a level.
 *
 * None of this writes to the database. The saved status is what you proved,
 * decay is what it is worth today, and it is applied at read time so that
 * answering one question correctly restores it without a migration.
 */

const WEEK = 7

/** Days it holds, days it shows as Fading, then days at Developing. */
export const SCHEDULE = {
  mastered: { holds: 4 * WEEK, fades: 2 * WEEK, slips: WEEK },
  proficient: { holds: 3 * WEEK, fades: 2 * WEEK, slips: WEEK },
  confident: { holds: 2 * WEEK, fades: 2 * WEEK, slips: 0 },
}

/** The shortest hold and fade, for callers that need one number (the planner's urgency). */
export const DECAY_DAYS = SCHEDULE.confident.holds
export const FADE_DAYS = SCHEDULE.confident.fades

const DAY_MS = 24 * 60 * 60 * 1000

/** Where a lapsed subtopic lands. Weak, not Untested: you did once prove it,
 *  and the map should not claim you have never been tested on it. */
const LAPSED = 'in_progress'
/** The step down after fading, for the levels that have one. */
const SLIPPED = 'confident'

/** Days it holds before fading, for this proven level (null if it never fades). */
export function holdDays(status) {
  return SCHEDULE[status]?.holds ?? null
}

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

/** Which stage of the curve: 'holds' | 'fading' | 'slipped' | 'lapsed', or null if it cannot fade. */
function stage(status, lastCorrectAt, now) {
  const s = SCHEDULE[status]
  if (!s) return null
  const age = ageInDays(lastCorrectAt, now)
  if (age === null) return null
  if (age <= s.holds) return 'holds'
  if (age <= s.holds + s.fades) return 'fading'
  if (age <= s.holds + s.fades + s.slips) return 'slipped'
  return 'lapsed'
}

/** Showing as Fading. */
export function isDecayed(status, lastCorrectAt, now = Date.now()) {
  return stage(status, lastCorrectAt, now) === 'fading'
}

/** Past Fading: stepped down to Developing, or all the way to Weak. */
export function hasLapsed(status, lastCorrectAt, now = Date.now()) {
  const st = stage(status, lastCorrectAt, now)
  return st === 'slipped' || st === 'lapsed'
}

/** Days left before a fading subtopic drops a level, or null if not fading. */
export function daysOfFadeLeft(status, lastCorrectAt, now = Date.now()) {
  if (!isDecayed(status, lastCorrectAt, now)) return null
  const s = SCHEDULE[status]
  return Math.max(0, Math.ceil(s.holds + s.fades - ageInDays(lastCorrectAt, now)))
}

/** What a fading subtopic drops to next: 'confident' (Developing) or 'in_progress' (Weak). */
export function dropsTo(status) {
  return SCHEDULE[status]?.slips ? SLIPPED : LAPSED
}

export function effectiveStatus(status, lastCorrectAt, now = Date.now()) {
  const st = stage(status, lastCorrectAt, now)
  if (st === 'fading') return 'decaying'
  if (st === 'slipped') return SLIPPED
  if (st === 'lapsed') return LAPSED
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
