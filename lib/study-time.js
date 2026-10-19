/**
 * Minutes studied per local calendar day, from quiz attempts and timer runs.
 *
 * The two overlap by design: the timer is meant to keep running while you
 * take quizzes. Adding them would count a 20-minute quiz inside a 40-minute
 * session as 60 minutes, so they are treated as stretches of time and merged
 * — any moment covered by either counts once.
 *
 * A stretch that crosses midnight is split at midnight, local time. The
 * student's day, not UTC's: in Muscat UTC midnight is 4am, and a session at
 * 11pm would otherwise land on tomorrow.
 *
 * Tested by scripts/study-time-test.mjs.
 */

/** The local calendar date as YYYY-MM-DD. */
export function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** [startMs, endMs] for every quiz attempt and timer run that has a length. */
export function studyIntervals({ attempts = [], sessions = [] }) {
  const out = []
  for (const a of attempts) {
    if (!a?.completed_at || !(a.elapsed_seconds > 0)) continue
    const end = Date.parse(a.completed_at)
    if (Number.isFinite(end)) out.push([end - a.elapsed_seconds * 1000, end])
  }
  for (const s of sessions) {
    const start = Date.parse(s?.started_at)
    const end = Date.parse(s?.ended_at)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) out.push([start, end])
  }
  return out
}

/** Merge overlapping stretches, split them at local midnight, sum per day. */
export function minutesPerDay(intervals) {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const merged = []
  for (const [a, b] of sorted) {
    const last = merged.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  const perDay = new Map()
  for (const [from, to] of merged) {
    let at = from
    while (at < to) {
      const d = new Date(at)
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
      const end = Math.min(to, midnight)
      const key = dayKey(d)
      perDay.set(key, (perDay.get(key) || 0) + (end - at) / 60000)
      at = end
    }
  }
  return [...perDay].map(([date, value]) => ({ date, value }))
}
