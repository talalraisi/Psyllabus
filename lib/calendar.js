/**
 * Calendar helpers.
 *
 * Dates are handled in the student's local timezone throughout — an exam on the
 * 14th must read as the 14th wherever they open the app, so month grids are
 * built from local date parts rather than by slicing an ISO string.
 */

export const EVENT_KINDS = [
  { key: 'test', label: 'Test', tone: 'weak' },
  { key: 'mock', label: 'Mock exam', tone: 'weak' },
  { key: 'deadline', label: 'Deadline', tone: 'warn' },
  { key: 'ia', label: 'IA milestone', tone: 'brand' },
  { key: 'oral', label: 'Oral / presentation', tone: 'brand' },
  { key: 'other', label: 'Other', tone: 'muted' },
]

export const KIND_LABEL = Object.fromEntries(EVENT_KINDS.map((k) => [k.key, k.label]))

export const KIND_DOT = {
  test: 'bg-[var(--status-weak)]',
  mock: 'bg-[var(--status-weak)]',
  deadline: 'bg-[var(--warning-text)]',
  ia: 'bg-[var(--brand)]',
  oral: 'bg-[var(--brand)]',
  other: 'bg-[var(--text-faint)]',
}

export const REMINDER_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
  { value: '4320', label: '3 days before' },
  { value: '10080', label: '1 week before' },
]

/** Local YYYY-MM-DD for a Date. Never use toISOString here — it shifts the day. */
export function localDateKey(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Midnight local time for a YYYY-MM-DD string. */
export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from today to the event, in local time. Negative = past. */
export function daysUntil(due, now = new Date()) {
  const a = new Date(now)
  a.setHours(0, 0, 0, 0)
  const b = new Date(due)
  b.setHours(0, 0, 0, 0)
  return Math.round((b - a) / 86400000)
}

export function relativeDay(due, now = new Date()) {
  const d = daysUntil(due, now)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  if (d < 0) return `${Math.abs(d)} days ago`
  if (d < 7) return `In ${d} days`
  if (d < 14) return 'Next week'
  return `In ${Math.round(d / 7)} weeks`
}

export function formatEventDate(due, allDay) {
  const d = new Date(due)
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  if (allDay) return date
  return `${date}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

/**
 * A 6x7 grid of local Dates covering the month, padded with the surrounding
 * days so the grid is always the same height and never reflows.
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  // Monday-first, matching how school timetables are written.
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

export function groupByDay(events) {
  const map = new Map()
  for (const e of events) {
    const key = localDateKey(e.due_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  return map
}

/** Upcoming, soonest first. Past events are dropped unless `includePast`. */
export function upcoming(events, { includePast = false, now = new Date() } = {}) {
  return [...events]
    .filter((e) => includePast || daysUntil(e.due_at, now) >= 0)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
}

/**
 * Events whose reminder is due now and has not already been shown.
 * `shown` is a Set of event ids the caller has already notified about.
 */
export function dueReminders(events, shown, now = new Date()) {
  return events.filter((e) => {
    if (e.completed || shown.has(e.id)) return false
    if (e.remind_minutes_before == null) return false
    const fireAt = new Date(e.due_at).getTime() - e.remind_minutes_before * 60000
    const dueTime = new Date(e.due_at).getTime()
    return now.getTime() >= fireAt && now.getTime() < dueTime
  })
}
