/**
 * Friends, read once and shared: the Friends page and the button in the top
 * bar both use this, so they agree and the second one costs nothing.
 *
 * Streaks and minutes are worked out from each friend's study times with the
 * student's own code (lib/streak.js), so a friend's number is the one they
 * see themselves. Nothing here ever carries a grade (095-friends.sql).
 */

import { computeStreak, goalFor, restDaysFor } from './streak.js'
import { minutesPerDay, studyIntervals } from './study-time.js'

/** Everything a friend's row shows, from their raw activity. */
export function summarise({ attempts, sessions, plan, session_minutes }) {
  const who = { plan_settings: plan || {}, session_minutes }
  const days = minutesPerDay(studyIntervals({ attempts: attempts || [], sessions: sessions || [] }))
  const s = computeStreak({ days, goal: goalFor(who), rest: restDaysFor(who) })
  const ends = [...(attempts || []).map((a) => Date.parse(a.completed_at)), ...(sessions || []).map((x) => Date.parse(x.ended_at || x.started_at))].filter(Number.isFinite)
  return { ...s, last: ends.length ? Math.max(...ends) : null }
}

let held = null
const TTL = 60_000

/** Friends and requests, each accepted friend with their summary. Kept a minute. */
export function loadFriends(supabase, { fresh = false } = {}) {
  if (!fresh && held && Date.now() - held.at < TTL) return held.promise
  const promise = Promise.all([supabase.rpc('my_friends'), supabase.rpc('friends_activity')]).then(([{ data: list }, { data: acts }]) => {
    const activity = Object.fromEntries((acts || []).map((a) => [a.friend, summarise(a)]))
    return { list: list || [], activity }
  })
  held = { at: Date.now(), promise }
  promise.catch(() => (held = null))
  return promise
}

/** After adding, accepting or removing: read again next time. */
export function forgetFriends() {
  held = null
}
