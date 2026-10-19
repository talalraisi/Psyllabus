// Run with: TZ=Asia/Muscat node scripts/ics-test.mjs
//
// Reading a student's calendar (lib/ics.js): repeats expanded, exceptions and
// skipped dates respected, time zones honoured, cancelled and far-off events
// left out, and tests spotted without mistaking a contest or a driving test.

import assert from 'node:assert/strict'
import { readCalendar, looksLikeTest } from '../lib/ics.js'

let n = 0
const check = (label, fn) => { fn(); n++; console.log('  ok ', label) }

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:Asia/Muscat
BEGIN:STANDARD
TZOFFSETFROM:+0400
TZOFFSETTO:+0400
TZNAME:+04
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:football@example
DTSTART;TZID=Asia/Muscat:20261019T170000
DTEND;TZID=Asia/Muscat:20261019T183000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
EXDATE;TZID=Asia/Muscat:20261021T170000
SUMMARY:Football training
LOCATION:School pitch
DESCRIPTION:Bring boots
END:VEVENT
BEGIN:VEVENT
UID:football@example
RECURRENCE-ID;TZID=Asia/Muscat:20261026T170000
DTSTART;TZID=Asia/Muscat:20261026T180000
DTEND;TZID=Asia/Muscat:20261026T193000
SUMMARY:Football training (late)
END:VEVENT
BEGIN:VEVENT
UID:phystest@example
DTSTART;VALUE=DATE:20261022
DTEND;VALUE=DATE:20261023
SUMMARY:Physics test
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
UID:cancelled@example
DTSTART:20261020T120000Z
DTEND:20261020T130000Z
SUMMARY:Cancelled meeting
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
UID:far@example
DTSTART:20270301T120000Z
DTEND:20270301T130000Z
SUMMARY:Too far ahead
END:VEVENT
END:VCALENDAR`

const from = new Date('2026-10-18T00:00:00+04:00')
const to = new Date(from.getTime() + 42 * 86400000)
const events = readCalendar(ICS, { from, to })
const football = events.filter((e) => e.title.startsWith('Football'))

check('a weekly timetable is expanded into each occurrence in the window', () => {
  // Mondays 19 Oct-23 Nov (6) and Wednesdays 28 Oct-25 Nov (5).
  assert.equal(football.length, 11)
})
check('a skipped date (EXDATE) is skipped', () => {
  assert.ok(!football.some((e) => e.starts_at === '2026-10-21T13:00:00.000Z'))
})
check('a moved occurrence is at its new time, with its new title', () => {
  const moved = football.find((e) => e.starts_at.startsWith('2026-10-26'))
  assert.equal(moved.starts_at, '2026-10-26T14:00:00.000Z')
  assert.equal(moved.title, 'Football training (late)')
})
check('5pm Muscat time is 5pm for the student, not 5pm UTC', () => {
  assert.equal(football[0].starts_at, '2026-10-19T13:00:00.000Z')
  assert.equal(football[0].ends_at, '2026-10-19T14:30:00.000Z')
})
check('all-day and "free" events are kept and marked', () => {
  const test = events.find((e) => e.title === 'Physics test')
  assert.ok(test.all_day && test.transparent)
})
check('an all-day event is its date, whatever time zone the server runs in', () => {
  const test = events.find((e) => e.title === 'Physics test')
  assert.equal(test.starts_at, '2026-10-22T00:00:00.000Z')
  assert.equal(test.ends_at, '2026-10-23T00:00:00.000Z')
})
check('cancelled events and events past the window are left out', () => {
  assert.ok(!events.some((e) => /Cancelled|Too far/.test(e.title)))
  assert.equal(events.length, 12)
})
check('nothing but start, end, title and flags is kept — no location or description', () => {
  assert.deepEqual(Object.keys(football[0]).sort(), ['all_day', 'ends_at', 'event_uid', 'starts_at', 'title', 'transparent'])
})
check('every occurrence has its own id', () => {
  assert.equal(new Set(events.map((e) => e.event_uid)).size, events.length)
})
check('something that is not a calendar is refused, not half-read', () => {
  assert.throws(() => readCalendar('<html>Sign in</html>'), /did not return a calendar/)
})

const subjects = ['Physics SL', 'Math Analysis & Approaches HL', 'Economics HL', 'English A: Language & Literature SL']
check('tests are spotted, with the subject when the title names it — abbreviations too', () => {
  assert.deepEqual(looksLikeTest({ title: 'Physics test' }, subjects), { kind: 'test', subject: 'Physics SL' })
  assert.deepEqual(looksLikeTest({ title: 'Maths quiz Friday' }, subjects), { kind: 'test', subject: 'Math Analysis & Approaches HL' })
  assert.deepEqual(looksLikeTest({ title: 'Econ mock exam' }, subjects), { kind: 'mock', subject: 'Economics HL' })
  assert.deepEqual(looksLikeTest({ title: 'Unit test' }, subjects), { kind: 'test', subject: null })
})
check('not every "test" is a test', () => {
  for (const title of ['Contest', 'Driving test', 'Testimony practice', 'Football training', 'Blood test']) {
    assert.equal(looksLikeTest({ title }, subjects), null, title)
  }
})

console.log(`\n${n} checks passed`)
