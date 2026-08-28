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
 */

const KEY = 'psyllabus:session-timer'
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

export function startTimer(minutes, resumeFrom = null) {
  const seconds = resumeFrom ?? minutes * 60
  publish({
    state: 'running',
    minutes,
    deadline: Date.now() + seconds * 1000,
    remaining: seconds,
  })
}

export function pauseTimer() {
  const t = readTimer()
  if (t.state !== 'running') return
  publish({ ...t, state: 'paused', deadline: null, remaining: Math.max(0, t.remaining) })
}

export function resetTimer(minutes) {
  const m = minutes ?? readTimer().minutes
  publish({ state: 'idle', minutes: m, deadline: null, remaining: m * 60 })
}

export function finishTimer() {
  publish({ ...readTimer(), state: 'done', deadline: null, remaining: 0 })
}

/** Re-arm the length while the timer is not running. */
export function setTimerMinutes(minutes) {
  const t = readTimer()
  if (t.state === 'running' || t.state === 'paused') return
  publish({ state: 'idle', minutes, deadline: null, remaining: minutes * 60 })
}
