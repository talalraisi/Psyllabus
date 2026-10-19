/**
 * The calendar a student subscribes to: their study blocks and their dated
 * events, as an iCalendar file their phone's calendar can read.
 *
 * Written by hand rather than through a library because the shape is small
 * and fixed, and the rules that trip people up are few and checkable: text is
 * escaped, long lines are folded at 75 bytes, all-day events are dates rather
 * than midnight-to-midnight times, and every event keeps the same UID from
 * one refresh to the next — or the phone would see each block deleted and
 * re-added, and fire its reminder again, every time it checked.
 *
 * Tested by scripts/ics-write-test.mjs.
 */

const KIND = { test: 'Test', mock: 'Mock exam', deadline: 'Deadline', ia: 'IA milestone', oral: 'Oral', other: 'Event' }

const escape = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateOnly = (d) => {
  const x = new Date(d)
  return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`
}

/** Fold to 75 octets per line, continuation lines starting with a space (RFC 5545 3.1). */
export function fold(line) {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const out = []
  let start = 0
  let limit = 75
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    // Never split a multi-byte character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    out.push((out.length ? ' ' : '') + bytes.subarray(start, end).toString('utf8'))
    start = end
    limit = 74
  }
  return out.join('\r\n')
}

/** A short stable hash, for UIDs that survive the blocks being rewritten. */
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

export function buildFeed({ blocks = [], events = [] }, { now = new Date(), allDayAt = null } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Project Syllabus//Study plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Project Syllabus',
    'X-WR-CALDESC:Your study plan and test dates from Project Syllabus',
    // How often to come back. Google ignores it and refreshes on its own
    // schedule; Apple and Outlook honour it.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]
  const dtstamp = stamp(now)

  for (const b of blocks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:block-${hash(`${b.starts_at}|${b.title}`)}@psyllabus.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(b.starts_at)}`,
      `DTEND:${stamp(b.ends_at)}`,
      `SUMMARY:${escape(b.title)}`,
      ...(b.subject ? [`CATEGORIES:${escape(b.subject)}`] : []),
      'TRANSP:OPAQUE',
      'END:VEVENT'
    )
  }

  for (const e of events) {
    const label = KIND[e.kind] || 'Event'
    const title = e.subject && !e.title?.toLowerCase().includes(e.subject.toLowerCase()) ? `${e.title} (${e.subject})` : e.title
    lines.push('BEGIN:VEVENT', `UID:event-${e.id}@psyllabus.app`, `DTSTAMP:${dtstamp}`)
    if (e.all_day) {
      // A date, in the student's own day: the stored instant is local midnight.
      const day = allDayAt ? allDayAt(e.due_at) : dateOnly(e.due_at)
      const next = new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8) + 1))
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${dateOnly(next)}`, 'TRANSP:TRANSPARENT')
    } else {
      lines.push(`DTSTART:${stamp(e.due_at)}`, `DTEND:${stamp(new Date(new Date(e.due_at).getTime() + 60 * 60000))}`)
    }
    lines.push(`SUMMARY:${escape(`${label}: ${title}`)}`)
    const before = Number(e.remind_minutes_before)
    if (before > 0) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escape(`${label}: ${title}`)}`, `TRIGGER:-PT${before}M`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
