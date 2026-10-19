// Run with: node scripts/ics-write-test.mjs
//
// The subscribed calendar (lib/ics-write.js), read back with the same parser
// the app uses for students' own calendars — if ical.js can read it, so can
// Google, Apple and Outlook.

import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { buildFeed, fold } from '../lib/ics-write.js'

let n = 0
const check = (label, fn) => { fn(); n++; console.log('  ok ', label) }

const feed = {
  blocks: [
    { starts_at: '2026-10-19T12:05:00.000Z', ends_at: '2026-10-19T12:40:00.000Z', title: 'Physics SL — Learn: 2.2 Kinematics, graphs; and motion', subject: 'Physics SL', kind: 'learn' },
  ],
  events: [
    { id: 'a1', title: 'Unit test', kind: 'test', subject: 'Physics SL', due_at: '2026-10-21T20:00:00.000Z', all_day: true, remind_minutes_before: 1440 },
    { id: 'b2', title: 'Maths mock', kind: 'mock', subject: null, due_at: '2026-10-22T04:00:00.000Z', all_day: false, remind_minutes_before: null },
  ],
}
// All-day dates in Muscat: 2026-10-21T20:00Z is midnight on the 22nd there.
const allDayAt = (iso) => new Date(new Date(iso).getTime() + 4 * 3600000).toISOString().slice(0, 10).replace(/-/g, '')
const text = buildFeed(feed, { now: new Date('2026-10-19T10:00:00Z'), allDayAt })
const vevents = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent').map((v) => new ICAL.Event(v))

check('the file parses, with every block and event in it', () => {
  assert.equal(vevents.length, 3)
})
check('a study block keeps its exact time and its title, punctuation and all', () => {
  const b = vevents[0]
  assert.equal(b.startDate.toJSDate().toISOString(), '2026-10-19T12:05:00.000Z')
  assert.equal(b.summary, 'Physics SL — Learn: 2.2 Kinematics, graphs; and motion')
})
check("an all-day test is a date on the student's own day, not a midnight-to-midnight time", () => {
  const t = vevents[1]
  assert.ok(t.startDate.isDate)
  assert.equal(t.startDate.toString(), '2026-10-22')
  assert.equal(t.summary, 'Test: Unit test (Physics SL)')
})
check('reminders come with the event', () => {
  const alarm = vevents[1].component.getFirstSubcomponent('valarm')
  assert.equal(alarm.getFirstPropertyValue('trigger').toSeconds(), -86400, 'a day before')
  assert.equal(vevents[2].component.getFirstSubcomponent('valarm'), null)
})
check('UIDs are the same from one refresh to the next, so phones do not re-alert', () => {
  const again = buildFeed(feed, { now: new Date('2026-10-19T11:00:00Z'), allDayAt })
  const uids = (s) => s.match(/^UID:.*$/gm)
  assert.deepEqual(uids(again), uids(text))
})
check('long lines are folded at 75 bytes without splitting a character', () => {
  const long = 'SUMMARY:' + 'Ü'.repeat(60)
  const folded = fold(long)
  for (const line of folded.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75)
  assert.equal(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), long)
})
check('lines end in CRLF, as the standard requires', () => {
  assert.ok(!/[^\r]\n/.test(text))
})

console.log(`\n${n} checks passed`)
