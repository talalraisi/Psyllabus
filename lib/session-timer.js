/**
 * Study session timer state, shared across the whole dashboard.
 *
 * The timer used to live inside the study plan page, so starting it and then
 * opening a practice quiz unmounted the component and the session vanished,
 * which is exactly when you most want it running. State now lives in
 * localStorage and is read by whatever is on screen, so the countdown survives
 * navigation, a reload, and closing the tab for a minute.
 *
 * Only a deadline is stored, never a tick count. Wall-clock arithmetic cannot
 * drift when a background tab gets throttled, and it stays correct across a
 * reload without any catch-up logic.
 *
 * Every uninterrupted run is also recorded, as a row in study_sessions, so
 * "Time studied" counts the timer and not just quizzes. A run starts at
 * start or resume and ends at pause, reset, finish or the deadline, and is
 * written from whichever of those happens first. Three things keep that
 * honest:
 *
 *  - The run's id is made here, when it starts. Ending it can happen in
 *    several places — the study plan, the floating pill on another page, a
 *    later visit after the tab was closed mid-session — and they all write
 *    the same row, which the database keeps once.
 *  - A run that reaches its deadline with nobody watching is closed at the
 *    deadline, not at whenever someone next looked. settleTimer() does that,
 *    and the pill calls it on every dashboard page.
 *  - Each run remembers whose it is. On a shared computer a timer left going
 *    by one student would otherwise be saved under whoever signed in next.
 *
 * Rows that cannot be written yet — offline, signed out — wait in
 * localStorage and go on the next attempt.
 */

import { createClient } from '@/lib/supabase'
import { markStudied } from '@/lib/streak'

const KEY = 'psyllabus:session-timer'
const PENDING = 'psyllabus:study-sessions-pending'
// Shorter than this is a mis-tap on Start, not studying.
const MIN_SECONDS = 15
const listeners = new Set()

/** @returns {{state:'idle'|'running'|'paused'|'done', minutes:number, deadline:number|null, remaining:number}} */
export function readTimer() {
  const empty = { state: 'idle', minutes: 40, deadline: null, remaining: 40 * 60 }
  if (typeof window === 'undefined') return empty
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const t = JSON.parse(raw)
    if (t.state === 'running' && t.deadline) {
      const left = Math.round((t.deadline - Date.now()) / 1000)
      return left <= 0
        ? { ...t, state: 'done', remaining: 0 }
        : { ...t, remaining: left }
    }
    return { ...empty, ...t }
  } catch {
    return empty
  }
}

function readRaw() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

function readPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING) || '[]')
  } catch {
    return []
  }
}

function writePending(rows) {
  try {
    localStorage.setItem(PENDING, JSON.stringify(rows))
  } catch {
    /* private mode: this run is lost, the timer itself is unaffected */
  }
}

let flushing = null

/** Send every waiting run. Safe to call often: concurrent calls share one attempt. */
export function flushStudySessions() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (flushing) return flushing
  flushing = (async () => {
    const waiting = readPending()
    if (!waiting.length) return
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const me = session?.user?.id
    if (!me) return
    // Someone else's run, from a shared device: dropped, never re-attributed.
    // A run with no owner is one whose session lookup failed at start, which
    // reads local storage and so all but never happens; it is counted as the
    // signed-in student's rather than held forever.
    const mine = waiting.filter((r) => !r.owner || r.owner === me)
    const rows = mine.map(({ id, started_at, ended_at, subject, subtopic }) => ({ id, started_at, ended_at, subject: subject || null, subtopic: subtopic || null }))
    if (rows.length) {
      const { error } = await supabase
        .from('study_sessions')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) return
      markStudied()
    }
    const sent = new Set([...mine, ...waiting.filter((r) => r.owner && r.owner !== me)].map((r) => r.id))
    writePending(readPending().filter((r) => !sent.has(r.id)))
  })()
    .catch(() => {})
    .finally(() => {
      flushing = null
    })
  return flushing
}

/** Close the run described by raw at endMs, if it was long enough to count. */
function endRun(raw, endMs) {
  if (!raw?.runId || !raw.runStart) return
  const end = Math.min(endMs, raw.deadline || endMs)
  if ((end - raw.runStart) / 1000 < MIN_SECONDS) return
  const row = {
    id: raw.runId,
    owner: raw.owner || null,
    started_at: new Date(raw.runStart).toISOString(),
    ended_at: new Date(end).toISOString(),
    subject: raw.subject || null,
    subtopic: raw.subtopic || null,
  }
  const waiting = readPending()
  if (!waiting.some((r) => r.id === row.id)) writePending([...waiting, row])
  flushStudySessions()
}

/**
 * Close a run whose deadline passed while nobody was watching, at its
 * deadline. Leaves the timer's own state alone — the study plan still gets to
 * notice it finished, chime and say so. Also sends anything waiting.
 */
export function settleTimer() {
  const raw = readRaw()
  if (raw?.state === 'running' && raw.deadline && raw.deadline <= Date.now()) endRun(raw, raw.deadline)
  return flushStudySessions()
}

/** End the current run and stop the clock, before the account it belongs to signs out. */
export async function stopTimerForSignOut() {
  const raw = readRaw()
  if (raw?.state === 'running') endRun(raw, Date.now())
  await flushStudySessions()
  publish({ state: 'idle', minutes: raw?.minutes ?? 40, deadline: null, remaining: (raw?.minutes ?? 40) * 60 })
}

function publish(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the timer still works within this page */
  }
  for (const fn of listeners) fn(next)
}

/** Subscribe to changes, including those made in another tab. */
export function subscribeTimer(fn) {
  listeners.add(fn)
  const onStorage = (e) => {
    if (e.key === KEY) fn(readTimer())
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/**
 * `label` is what the run is for — { subject, subtopic } — when it is started
 * from a study plan task. Recorded with the run, it is what makes time per
 * subject possible. A timer started on its own still counts, unlabelled.
 */
export function startTimer(minutes, resumeFrom = null, label = null) {
  const seconds = resumeFrom ?? minutes * 60
  const runId = crypto.randomUUID()
  const runStart = Date.now()
  publish({
    state: 'running',
    minutes,
    deadline: runStart + seconds * 1000,
    remaining: seconds,
    runId,
    runStart,
    subject: label?.subject || null,
    subtopic: label?.subtopic || null,
  })
  // Whose run this is, filled in as soon as the session is known. Reading it
  // is async and starting the clock should not wait for it.
  createClient()
    .auth.getSession()
    .then(({ data: { session } }) => {
      const raw = readRaw()
      if (raw?.runId === runId && session?.user?.id) publish({ ...raw, owner: session.user.id })
    })
    .catch(() => {})
}

export function pauseTimer() {
  const raw = readRaw()
  const t = readTimer()
  if (t.state !== 'running') return
  endRun(raw, Date.now())
  publish({
    ...t,
    state: 'paused',
    deadline: null,
    remaining: Math.max(0, t.remaining),
    runId: null,
    runStart: null,
    owner: null,
  })
}

export function resetTimer(minutes) {
  const raw = readRaw()
  if (raw?.state === 'running') endRun(raw, Date.now())
  const m = minutes ?? readTimer().minutes
  publish({ state: 'idle', minutes: m, deadline: null, remaining: m * 60 })
}

export function finishTimer() {
  const raw = readRaw()
  if (raw?.state === 'running') endRun(raw, Date.now())
  publish({ ...readTimer(), state: 'done', deadline: null, remaining: 0, runId: null, runStart: null })
}

/** Re-arm the length while the timer is not running. */
export function setTimerMinutes(minutes) {
  const t = readTimer()
  if (t.state === 'running' || t.state === 'paused') return
  publish({ state: 'idle', minutes, deadline: null, remaining: minutes * 60 })
}
