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

export function isDecayed(status, updatedAt, now = Date.now()) {
  if (status !== 'mastered' || !updatedAt) return false
  return now - new Date(updatedAt).getTime() > DECAY_DAYS * DAY_MS
}

export function effectiveStatus(status, updatedAt, now = Date.now()) {
  return isDecayed(status, updatedAt, now) ? 'decaying' : status
}

export function daysSince(updatedAt, now = Date.now()) {
  if (!updatedAt) return null
  return Math.floor((now - new Date(updatedAt).getTime()) / DAY_MS)
}

/** key → { status, updatedAt } (raw, no decay applied) */
export function buildProgressDetailMap(progressRows) {
  return (progressRows || []).reduce((acc, p) => {
    acc[progressKey(p.subject, p.subtopic)] = {
      status: p.status,
      updatedAt: p.updated_at,
    }
    return acc
  }, {})
}

/** key → status with decay applied. Drop-in replacement for buildProgressMap. */
export function buildEffectiveProgressMap(progressRows, now = Date.now()) {
  return (progressRows || []).reduce((acc, p) => {
    acc[progressKey(p.subject, p.subtopic)] = effectiveStatus(p.status, p.updated_at, now)
    return acc
  }, {})
}
