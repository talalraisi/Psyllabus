/**
 * The streak: days in a row with some study in them, and a daily goal.
 *
 * One definition, used by the sidebar, the dashboard, the heatmap and the
 * quiz results, so none of them can disagree about how many days it is.
 *
 *   A day counts     Any study at all: a quiz finished or the timer run. The
 *                    goal is what a good day looks like, not the price of
 *                    keeping the streak; a streak lost to a 9-minute day
 *                    teaches a student that 9 minutes was worthless.
 *   Rest days        A weekday the study plan gives no time (Friday, unless
 *                    the student changed it) does not break the streak. It
 *                    does not add to it either, unless they studied anyway.
 *   Today            Counted from yesterday until something is done today, so
 *                    the streak does not read zero at breakfast.
 *
 * Minutes come from lib/study-time.js, where quizzes and timer runs that
 * overlap are counted once.
 */

import { dayKey, minutesPerDay, studyIntervals } from './study-time.js'
import { resolveSettings } from './study-plan.js'

export const GOALS = [10, 20, 30, 45, 60, 90]
export const DEFAULT_GOAL = 20
export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]

/** The student's daily goal in minutes. */
export function goalFor(profile) {
  const g = Number(profile?.plan_settings?.goal)
  return Number.isFinite(g) && g >= 5 && g <= 240 ? Math.round(g) : DEFAULT_GOAL
}

/** Weekdays (0 = Sunday) the plan gives no time to. */
export function restDaysFor(profile) {
  const { week } = resolveSettings(profile)
  const out = new Set()
  for (let d = 0; d < 7; d++) if (!(week[d] > 0)) out.add(d)
  // A plan with no time on any day is not a plan of rest; nothing is excused.
  return out.size === 7 ? new Set() : out
}

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Below a minute is a quiz opened and closed, not study. */
const STUDIED = 1

/**
 * Longest and current run between `from` and `today`, rest days bridging.
 * `byDay` maps YYYY-MM-DD to minutes.
 */
export function runs(byDay, from, today, rest = new Set()) {
  let longest = 0
  let run = 0
  for (let d = midnight(from); d <= today; d = addDays(d, 1)) {
    if ((byDay.get(dayKey(d)) || 0) >= STUDIED) {
      run++
      longest = Math.max(longest, run)
    } else if (!rest.has(d.getDay())) run = 0
  }
  let current = 0
  let d = (byDay.get(dayKey(today)) || 0) >= STUDIED ? today : addDays(today, -1)
  for (let i = 0; i < 2000; i++, d = addDays(d, -1)) {
    if ((byDay.get(dayKey(d)) || 0) >= STUDIED) current++
    else if (!rest.has(d.getDay())) break
  }
  return { longest: Math.max(longest, current), current }
}

/**
 * Everything the streak UI shows, from minutes per day.
 * `days` is [{ date: 'YYYY-MM-DD', value: minutes }].
 */
export function computeStreak({ days = [], goal = DEFAULT_GOAL, rest = new Set(), today = midnight(new Date()) }) {
  const byDay = new Map(days.map((d) => [d.date, d.value]))
  const first = days.length ? days.reduce((a, b) => (a.date < b.date ? a : b)).date : dayKey(today)
  const { longest, current } = runs(byDay, new Date(`${first}T12:00:00`), today, rest)

  const todayMinutes = Math.round(byDay.get(dayKey(today)) || 0)
  const studiedToday = todayMinutes >= STUDIED

  const week = []
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i)
    const minutes = Math.round(byDay.get(dayKey(d)) || 0)
    const state =
      minutes >= goal ? 'goal' : minutes >= STUDIED ? 'studied' : i === 0 ? 'today' : rest.has(d.getDay()) ? 'rest' : 'missed'
    week.push({ date: dayKey(d), weekday: d.getDay(), minutes, state, isToday: i === 0 })
  }

  const next = MILESTONES.find((m) => m > current) || null
  const prev = [...MILESTONES].reverse().find((m) => m <= current) || 0

  return {
    current,
    longest,
    goal,
    todayMinutes,
    studiedToday,
    goalMet: todayMinutes >= goal,
    // Studied in the run that is still alive, and nothing yet today.
    atRisk: current > 0 && !studiedToday && !rest.has(today.getDay()),
    restToday: rest.has(today.getDay()),
    week,
    weekMinutes: week.reduce((n, d) => n + d.minutes, 0),
    goalDays: week.filter((d) => d.state === 'goal').length,
    totalMinutes: Math.round(days.reduce((n, d) => n + d.value, 0)),
    milestone: { next, prev, reached: MILESTONES.filter((m) => m <= longest) },
  }
}

/* ---------- Loading, shared across the app ---------- */

// One read for every component on the page, kept for a minute, and dropped
// the moment something is studied (see markStudied).
const cache = new Map()
const TTL = 60_000
export const STUDIED_EVENT = 'psyllabus:studied'

/** Minutes per day for roughly the past two years. */
export async function loadStudyDays(supabase, userId) {
  const held = cache.get(userId)
  if (held && Date.now() - held.at < TTL) return held.promise
  const since = new Date()
  since.setDate(since.getDate() - 800)
  const promise = Promise.all([
    supabase.from('quiz_attempts').select('completed_at, elapsed_seconds').eq('user_id', userId).gte('completed_at', since.toISOString()),
    supabase.from('study_sessions').select('started_at, ended_at').eq('user_id', userId).gte('started_at', since.toISOString()),
  ]).then(([a, s]) => minutesPerDay(studyIntervals({ attempts: a?.data || [], sessions: s?.data || [] })))
  cache.set(userId, { at: Date.now(), promise })
  promise.catch(() => cache.delete(userId))
  return promise
}

/** A page that has already read the days hands them over, so nothing reads twice. */
export function primeStudyDays(userId, days) {
  cache.set(userId, { at: Date.now(), promise: Promise.resolve(days) })
}

/** Something was just studied: everything showing the streak reads it again. */
export function markStudied() {
  cache.clear()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STUDIED_EVENT))
}
