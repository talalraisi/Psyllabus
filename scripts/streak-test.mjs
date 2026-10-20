// Run with: node scripts/streak-test.mjs
import assert from 'node:assert/strict'
import { computeStreak, runs, goalFor, restDaysFor } from '../lib/streak.js'

let n = 0
const check = (label, fn) => { fn(); n++; console.log('  ok ', label) }
const today = new Date(2026, 9, 20) // Tuesday 20 October 2026
const ago = (k) => { const d = new Date(today); d.setDate(d.getDate() - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const days = (spec) => Object.entries(spec).map(([k, value]) => ({ date: ago(Number(k)), value }))

check('nothing studied is no streak', () => {
  const s = computeStreak({ days: [], today })
  assert.equal(s.current, 0); assert.equal(s.longest, 0); assert.equal(s.atRisk, false)
})
check('today and the two days before make three', () => {
  assert.equal(computeStreak({ days: days({ 0: 5, 1: 30, 2: 12 }), today }).current, 3)
})
check('before studying today, the streak counts from yesterday and is at risk', () => {
  const s = computeStreak({ days: days({ 1: 30, 2: 12 }), today })
  assert.equal(s.current, 2); assert.equal(s.atRisk, true); assert.equal(s.studiedToday, false)
})
check('a missed day breaks it', () => {
  assert.equal(computeStreak({ days: days({ 0: 5, 2: 12, 3: 9 }), today }).current, 1)
})
check('a rest day bridges it without adding to it', () => {
  // 20 Oct 2026 is a Tuesday; 2 days ago is Sunday (0).
  const s = computeStreak({ days: days({ 0: 5, 1: 5, 3: 5 }), rest: new Set([0]), today })
  assert.equal(s.current, 3)
})
check('studying on a rest day still counts', () => {
  assert.equal(computeStreak({ days: days({ 0: 5, 1: 5, 2: 5 }), rest: new Set([0]), today }).current, 3)
})
check('under a minute is not study', () => {
  assert.equal(computeStreak({ days: days({ 0: 0.4, 1: 5 }), today }).current, 1)
})
check('longest remembers an older, longer run', () => {
  const s = computeStreak({ days: days({ 0: 5, 10: 5, 11: 5, 12: 5, 13: 5 }), today })
  assert.equal(s.current, 1); assert.equal(s.longest, 4)
})
check('the goal is met at the goal, not before', () => {
  assert.equal(computeStreak({ days: days({ 0: 19.6 }), goal: 20, today }).goalMet, true) // rounds to 20
  assert.equal(computeStreak({ days: days({ 0: 19 }), goal: 20, today }).goalMet, false)
})
check('the week has seven days ending today, each with a state', () => {
  const s = computeStreak({ days: days({ 0: 25, 1: 5, 3: 30 }), goal: 20, rest: new Set([0]), today })
  assert.deepEqual(s.week.map((d) => d.state), ['missed', 'missed', 'missed', 'goal', 'rest', 'studied', 'goal'])
  assert.equal(s.goalDays, 2)
})
check('milestones: the next one and how far', () => {
  const s = computeStreak({ days: days({ 0: 5, 1: 5, 2: 5, 3: 5, 4: 5 }), today })
  assert.equal(s.milestone.next, 7); assert.equal(s.milestone.prev, 3); assert.deepEqual(s.milestone.reached, [3])
})
check('the goal defaults to 20 and ignores nonsense', () => {
  assert.equal(goalFor({}), 20); assert.equal(goalFor({ plan_settings: { goal: 45 } }), 45); assert.equal(goalFor({ plan_settings: { goal: 'x' } }), 20); assert.equal(goalFor({ plan_settings: { goal: 9999 } }), 20)
})
check('rest days come from the plan: Friday by default', () => {
  assert.deepEqual([...restDaysFor({ session_minutes: 60 })], [5])
  assert.deepEqual([...restDaysFor({ plan_settings: { week: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } } })], [])
})
check('runs over a range agrees with the card', () => {
  const byDay = new Map(days({ 0: 5, 1: 5 }).map((d) => [d.date, d.value]))
  assert.deepEqual(runs(byDay, new Date(2026, 9, 1), today), { longest: 2, current: 2 })
})
console.log(`\n${n} checks passed`)
