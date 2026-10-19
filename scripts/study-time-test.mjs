// Run with: TZ=Asia/Muscat node scripts/study-time-test.mjs
import assert from 'node:assert/strict'
import { studyIntervals, minutesPerDay } from '../lib/study-time.js'

const at = (s) => new Date(s).toISOString()
const day = (rows, key) => Math.round((rows.find((r) => r.date === key)?.value ?? 0) * 100) / 100
let n = 0
const check = (label, fn) => { fn(); n++; console.log('  ok ', label) }

check('a quiz inside a timer run counts once', () => {
  const rows = minutesPerDay(studyIntervals({
    sessions: [{ started_at: at('2026-10-19T18:00:00+04:00'), ended_at: at('2026-10-19T18:40:00+04:00') }],
    attempts: [{ completed_at: at('2026-10-19T18:30:00+04:00'), elapsed_seconds: 20 * 60 }],
  }))
  assert.equal(day(rows, '2026-10-19'), 40)
})

check('a quiz half outside the run adds only the part outside', () => {
  const rows = minutesPerDay(studyIntervals({
    sessions: [{ started_at: at('2026-10-19T18:00:00+04:00'), ended_at: at('2026-10-19T18:40:00+04:00') }],
    attempts: [{ completed_at: at('2026-10-19T18:50:00+04:00'), elapsed_seconds: 20 * 60 }],
  }))
  assert.equal(day(rows, '2026-10-19'), 50)
})

check('separate stretches add up', () => {
  const rows = minutesPerDay(studyIntervals({
    sessions: [
      { started_at: at('2026-10-19T08:00:00+04:00'), ended_at: at('2026-10-19T08:25:00+04:00') },
      { started_at: at('2026-10-19T20:00:00+04:00'), ended_at: at('2026-10-19T20:40:00+04:00') },
    ],
  }))
  assert.equal(day(rows, '2026-10-19'), 65)
})

check('a run across midnight is split between the two local days', () => {
  const rows = minutesPerDay(studyIntervals({
    sessions: [{ started_at: at('2026-10-19T23:40:00+04:00'), ended_at: at('2026-10-20T00:30:00+04:00') }],
  }))
  assert.equal(day(rows, '2026-10-19'), 20)
  assert.equal(day(rows, '2026-10-20'), 30)
})

check('11pm in Muscat stays on that day, not UTC tomorrow', () => {
  const rows = minutesPerDay(studyIntervals({
    attempts: [{ completed_at: at('2026-10-19T23:10:00+04:00'), elapsed_seconds: 5 * 60 }],
  }))
  assert.equal(day(rows, '2026-10-19'), 5)
  assert.equal(rows.length, 1)
})

check('touching stretches merge without a gap or double count', () => {
  const rows = minutesPerDay(studyIntervals({
    sessions: [
      { started_at: at('2026-10-19T10:00:00+04:00'), ended_at: at('2026-10-19T10:30:00+04:00') },
      { started_at: at('2026-10-19T10:30:00+04:00'), ended_at: at('2026-10-19T11:00:00+04:00') },
    ],
  }))
  assert.equal(day(rows, '2026-10-19'), 60)
})

check('junk rows are ignored, not counted', () => {
  const rows = minutesPerDay(studyIntervals({
    attempts: [{ completed_at: null, elapsed_seconds: 300 }, { completed_at: at('2026-10-19T10:00:00+04:00'), elapsed_seconds: 0 }],
    sessions: [{ started_at: at('2026-10-19T10:00:00+04:00'), ended_at: at('2026-10-19T09:00:00+04:00') }, { started_at: 'nonsense', ended_at: 'x' }],
  }))
  assert.equal(rows.length, 0)
})

console.log(`\n${n} checks passed`)
