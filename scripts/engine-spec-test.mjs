/**
 * The spec and the code, checked against each other.
 *
 * docs/adaptive-engine.md records every threshold that decides what colour a
 * subtopic is, what an answer is worth and when something starts slipping. A
 * document like that is worth having exactly as long as it is true, and it
 * stops being true the first time somebody edits a constant without opening it.
 *
 * So this reads the numbers out of the markdown and compares them to the
 * numbers in the modules. Change one side and this fails, which is the only
 * mechanism that keeps a spec honest. A wrong threshold does not throw at
 * runtime — it renders, for every student, quietly.
 */

import fs from 'node:fs'
import { POINT_BANDS, MASTERY_TARGET, HEAT_LEVELS, statusFromPoints } from '../lib/progress.js'
import { DECAY_DAYS, FADE_DAYS } from '../lib/decay.js'
import { SUBTOPIC_QUESTION_COUNT } from '../lib/quiz.js'

const doc = fs.readFileSync(new URL('../docs/adaptive-engine.md', import.meta.url), 'utf8')

let failed = 0
const is = (got, want, what) => {
  if (got !== want) {
    console.log(`  FAIL  ${what}\n        code says ${JSON.stringify(got)}, the spec says ${JSON.stringify(want)}`)
    failed++
  }
}

/** Pull a number the doc states, so the doc is the thing being read. */
function stated(re, what) {
  const m = doc.match(re)
  if (!m) {
    console.log(`  FAIL  the spec no longer states ${what}`)
    failed++
    return null
  }
  return Number(m[1])
}

// --- §1 points per heat ----------------------------------------------------
for (const [label, key] of [
  ['Low', 'low'],
  ['Medium', 'medium'],
  ['Hot', 'hot'],
  ['Extremely hot', 'extreme'],
  ['Burning', 'burning'],
]) {
  const row = new RegExp(`\\| ${label} \\| [0-9.]+ \\| \\*\\*([0-9.]+)\\*\\*`)
  const want = stated(row, `${label} points`)
  if (want !== null) is(HEAT_LEVELS.find((h) => h.key === key).points, want, `${label} points`)
}

// --- §2 the ladder ---------------------------------------------------------
is(MASTERY_TARGET, stated(/`MASTERY_TARGET` is \*\*(\d+)\*\*/, 'MASTERY_TARGET'), 'MASTERY_TARGET')
for (const [status, re] of [
  ['mastered', /\| (\d+)\+ \| Mastered \|/],
  // The lower bound of each band is the threshold, so capture the first
  // number in "7–9", not the second. Getting this backwards is what the test
  // caught on its first run, which is a fair advertisement for having it.
  ['proficient', /\| (\d+)–\d+ \| Proficient \|/],
  ['confident', /\| (\d+)–\d+ \| Developing \|/],
]) {
  const want = stated(re, `${status} threshold`)
  if (want !== null) is(POINT_BANDS.find((b) => b.status === status).min, want, `${status} threshold`)
}

// --- §3 forgetting ---------------------------------------------------------
is(DECAY_DAYS, stated(/`DECAY_DAYS = (\d+)`/, 'DECAY_DAYS'), 'DECAY_DAYS')
is(FADE_DAYS, stated(/`FADE_DAYS = (\d+)`/, 'FADE_DAYS'), 'FADE_DAYS')
is(
  DECAY_DAYS + FADE_DAYS,
  stated(/\| (\d+)\+ \| \*\*Weak\*\*/, 'the day a subtopic lapses'),
  'the lapse boundary matches DECAY_DAYS + FADE_DAYS'
)

// --- §6 quizzes ------------------------------------------------------------
is(
  SUBTOPIC_QUESTION_COUNT,
  stated(/`SUBTOPIC_QUESTION_COUNT = (\d+)`/, 'SUBTOPIC_QUESTION_COUNT'),
  'SUBTOPIC_QUESTION_COUNT'
)

// --- the two claims the spec makes about behaviour, not constants ----------
is(statusFromPoints(0), 'not_started', 'zero points reads as Untested, not Weak')
// "Ten Low questions is 5 points, which is Developing."
is(statusFromPoints(10 * HEAT_LEVELS[0].points), 'confident', 'an all-Low run tops out at Developing')

console.log(
  failed ? `\n${failed} failed — the spec and the code disagree` : 'the spec and the code agree on every number'
)
process.exit(failed ? 1 : 0)
