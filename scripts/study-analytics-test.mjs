// Run with: TZ=Asia/Muscat node scripts/study-analytics-test.mjs
import assert from 'node:assert/strict'
import { intervalsFrom, attribute, analyse, RANGES, UNASSIGNED, hm } from '../lib/study-analytics.js'

let n = 0
const check = (label, fn) => { fn(); n++; console.log('  ok ', label) }
const at = (s) => new Date(s).toISOString()
const sum = (pieces) => pieces.reduce((m, p) => m + (p.end - p.start) / 60000, 0)

check('a quiz inside an unnamed timer run takes its own minutes, the rest stays the timer', () => {
  const pieces = attribute(intervalsFrom({
    sessions: [{ started_at: at('2026-10-19T18:00:00+04:00'), ended_at: at('2026-10-19T18:40:00+04:00') }],
    attempts: [{ completed_at: at('2026-10-19T18:30:00+04:00'), elapsed_seconds: 600, subject: 'Physics SL', subtopic: 'SHM' }],
  }))
  assert.equal(Math.round(sum(pieces)), 40)
  assert.equal(Math.round(sum(pieces.filter((p) => p.subject === 'Physics SL'))), 10)
  assert.equal(Math.round(sum(pieces.filter((p) => !p.subject))), 30)
})
check('two subjects overlapping never count the same minute twice', () => {
  const pieces = attribute(intervalsFrom({
    sessions: [
      { started_at: at('2026-10-19T10:00:00Z'), ended_at: at('2026-10-19T11:00:00Z'), subject: 'Biology HL' },
      { started_at: at('2026-10-19T10:30:00Z'), ended_at: at('2026-10-19T11:30:00Z'), subject: 'Economics HL' },
    ],
  }))
  assert.equal(Math.round(sum(pieces)), 90)
})
check('subjects add up to the total, and per day', () => {
  const now = Date.parse('2026-10-21T12:00:00+04:00')
  const r = analyse({
    now,
    range: RANGES[0],
    sessions: [
      { started_at: at('2026-10-20T16:00:00+04:00'), ended_at: at('2026-10-20T17:00:00+04:00'), subject: 'Physics SL' },
      { started_at: at('2026-10-21T08:00:00+04:00'), ended_at: at('2026-10-21T08:30:00+04:00') },
    ],
    attempts: [{ completed_at: at('2026-10-21T08:20:00+04:00'), elapsed_seconds: 600, subject: 'Biology HL', subtopic: 'Enzymes', total_questions: 5, score: 4 }],
  })
  assert.equal(Math.round(r.total), 90)
  assert.equal(Math.round(r.subjects.reduce((m, s) => m + s.minutes, 0)), 90)
  assert.deepEqual(r.subjects.map((s) => [s.name, Math.round(s.minutes)]), [['Physics SL', 60], [UNASSIGNED, 20], ['Biology HL', 10]])
  assert.equal(Math.round(r.buckets.reduce((m, b) => m + b.total, 0)), 90)
  assert.equal(r.studiedDays, 2)
  assert.equal(r.quizzes.answered, 5)
  assert.equal(r.quizzes.accuracy, 0.8)
  assert.equal(r.focus.count, 2)
  assert.equal(Math.round(r.focus.longest), 60)
})
check('filtering to one subject keeps only its minutes', () => {
  const now = Date.parse('2026-10-21T12:00:00+04:00')
  const r = analyse({
    now,
    range: RANGES[0],
    subject: 'Physics SL',
    sessions: [
      { started_at: at('2026-10-20T16:00:00+04:00'), ended_at: at('2026-10-20T17:00:00+04:00'), subject: 'Physics SL' },
      { started_at: at('2026-10-20T18:00:00+04:00'), ended_at: at('2026-10-20T19:00:00+04:00'), subject: 'Biology HL' },
    ],
  })
  assert.equal(Math.round(r.total), 60)
})
check('a run across midnight lands on both days', () => {
  const now = Date.parse('2026-10-21T12:00:00+04:00')
  const r = analyse({ now, range: RANGES[0], sessions: [{ started_at: at('2026-10-20T23:30:00+04:00'), ended_at: at('2026-10-21T00:30:00+04:00'), subject: 'Physics SL' }] })
  assert.equal(Math.round(r.days['2026-10-20']), 30)
  assert.equal(Math.round(r.days['2026-10-21']), 30)
})
check('the change against the period before', () => {
  const now = Date.parse('2026-10-21T12:00:00+04:00')
  const r = analyse({
    now,
    range: RANGES[0],
    sessions: [
      { started_at: at('2026-10-20T10:00:00+04:00'), ended_at: at('2026-10-20T12:00:00+04:00') },
      { started_at: at('2026-10-12T10:00:00+04:00'), ended_at: at('2026-10-12T11:00:00+04:00') },
    ],
  })
  assert.equal(r.change, 1)
})
check('every range buckets without gaps', () => {
  const now = Date.parse('2026-10-21T12:00:00+04:00')
  for (const range of RANGES) {
    const r = analyse({ now, range })
    for (let i = 1; i < r.buckets.length; i++) assert.equal(r.buckets[i].start, r.buckets[i - 1].end, range.key)
    assert.equal(r.buckets[0].start, r.from)
    assert.equal(r.buckets.at(-1).end, r.end)
  }
})
check('hours and minutes read naturally', () => {
  assert.equal(hm(40), '40m')
  assert.equal(hm(60), '1h')
  assert.equal(hm(85), '1h 25m')
})
console.log(`\n${n} checks passed`)
