/**
 * Reading a student's own calendar.
 *
 * A Google, Apple or Outlook private link returns an iCalendar file. What the
 * study plan needs from it is the student's next few weeks as plain events:
 * when each one starts and ends, whether it is all day, whether it actually
 * blocks time, and a title — for showing it and for spotting tests.
 *
 * ical.js (Mozilla's parser, the one Thunderbird uses) does the parts that are
 * easy to get wrong by hand: repeating events, which is how a school
 * timetable is stored, exceptions to them, and time zones. A class at 8:00
 * Muscat time written with TZID=Asia/Muscat must land at 8:00 for the
 * student, not at 8:00 UTC.
 *
 * Kept: start, end, all-day, free/busy, title. Not kept: location,
 * description, guests — nothing the plan uses, so nothing it stores.
 *
 * Pure apart from the parser; tested by scripts/ics-test.mjs.
 */

import ICAL from 'ical.js'

export const WINDOW_DAYS = 42
// A timetable that repeats every day for years is still only six weeks here,
// but a malformed rule must not be able to run forever.
const MAX_OCCURRENCES = 3000

/**
 * Events from iCalendar text that overlap [from, to].
 * Throws if the text is not a calendar.
 */
export function readCalendar(text, { from = new Date(), to = new Date(Date.now() + WINDOW_DAYS * 86400000) } = {}) {
  if (typeof text !== 'string' || !/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) {
    throw new Error('That link did not return a calendar.')
  }
  const root = new ICAL.Component(ICAL.parse(text))

  // Time zones the file defines for itself, so TZID references resolve.
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz)
    } catch {
      /* a broken zone falls back to floating time */
    }
  }

  // Exceptions ("this week's class is at 9 instead") belong to their series.
  const byUid = new Map()
  for (const vevent of root.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(vevent)
    const uid = event.uid || `${event.summary}|${event.startDate?.toString()}`
    if (!byUid.has(uid)) byUid.set(uid, { master: null, exceptions: [] })
    if (event.isRecurrenceException()) byUid.get(uid).exceptions.push(event)
    else byUid.get(uid).master = event
  }

  const out = []
  const fromMs = from.getTime()
  const toMs = to.getTime()
  /**
   * All-day events are dates, not instants. toJSDate() would turn a date
   * into midnight in whatever time zone the server runs in — Muscat on a
   * laptop, UTC in production — so the same test could land on different
   * days depending on where this ran. They are kept as UTC midnight of their
   * date, everywhere, and read back as a date.
   */
  const instant = (t) => (t.isDate ? new Date(Date.UTC(t.year, t.month - 1, t.day)) : t.toJSDate())
  const push = (uid, event, start, end) => {
    if (!start || !end) return
    const s = instant(start)
    let e = instant(end)
    if (!(e > s)) e = new Date(s.getTime() + (start.isDate ? 86400000 : 30 * 60000))
    if (e.getTime() <= fromMs || s.getTime() >= toMs) return
    const status = String(event.component.getFirstPropertyValue('status') || '').toUpperCase()
    if (status === 'CANCELLED') return
    const transp = String(event.component.getFirstPropertyValue('transp') || '').toUpperCase()
    out.push({
      event_uid: `${uid}|${s.toISOString()}`.slice(0, 600),
      title: String(event.summary || '').trim().slice(0, 300),
      starts_at: s.toISOString(),
      ends_at: e.toISOString(),
      all_day: Boolean(start.isDate),
      transparent: transp === 'TRANSPARENT',
    })
  }

  for (const [uid, { master, exceptions }] of byUid) {
    if (!master) {
      // An exception whose series is not in the file: keep it as it stands.
      for (const ex of exceptions) push(uid, ex, ex.startDate, ex.endDate)
      continue
    }
    for (const ex of exceptions) master.relateException(ex)

    if (!master.isRecurring()) {
      push(uid, master, master.startDate, master.endDate)
      continue
    }

    const it = master.iterator()
    let next
    let n = 0
    while ((next = it.next()) && n++ < MAX_OCCURRENCES) {
      if (next.toJSDate().getTime() >= toMs) break
      const details = master.getOccurrenceDetails(next)
      push(uid, details.item, details.startDate, details.endDate)
    }
  }

  out.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return out
}

// Test-spotting lives on its own so the browser can use it without the parser.
export { looksLikeTest } from './test-detect.js'
