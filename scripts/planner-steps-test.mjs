/**
 * The session's steps, checked for the two things that would show.
 *
 * A recipe that does not add up to the time it was given produces an evening
 * that overruns, and a student who planned forty minutes and is still going at
 * fifty stops trusting the number. And the recipe has to differ by status or
 * the whole idea is decoration: reading something you proved five weeks ago is
 * exactly the wrong use of a retest.
 */

import { stepsFor, buildSession, STEP } from '../lib/planner.js'

let failed = 0
const is = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`  FAIL  ${what}\n        got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
    failed++
  }
}

const STATUSES = ['in_progress', 'decaying', 'not_started', 'confident', 'proficient', 'mastered']

// --- every recipe spends exactly the time it was given ---------------------
for (const status of STATUSES) {
  for (const minutes of [10, 15, 22, 30, 45, 60]) {
    const steps = stepsFor({ status }, minutes)
    const total = steps.reduce((n, s) => n + s.minutes, 0)
    is(total, minutes, `${status} at ${minutes} min adds up`)
    if (steps.some((s) => s.minutes < 2)) is(true, false, `${status} at ${minutes} has a step under 2 min`)
  }
}

// --- fading is retested, not re-taught ------------------------------------
const fading = stepsFor({ status: 'decaying' }, 22).map((s) => s.kind)
is(fading.includes(STEP.read), false, 'fading does not start by reading')
is(fading[0], STEP.quiz, 'fading goes straight to questions')

// --- weak reads before it tests -------------------------------------------
const weak = stepsFor({ status: 'in_progress' }, 22).map((s) => s.kind)
is(weak[0], STEP.read, 'weak reads first')
is(weak.includes(STEP.quiz), true, 'weak still gets tested')

// --- untested reads before it is asked ------------------------------------
is(stepsFor({ status: 'not_started' }, 22)[0].kind, STEP.read, 'untested reads first')

// --- an unknown status still produces a usable plan -----------------------
const odd = stepsFor({ status: 'something_else' }, 30)
is(odd.reduce((n, s) => n + s.minutes, 0), 30, 'unknown status still fills the time')
is(odd.length > 0, true, 'unknown status still gets steps')

// --- the session divides the evening between its items --------------------
const queue = STATUSES.map((status, i) => ({
  subject: `Subject ${i % 3}`, subtopic: `s${i}`, status,
}))
for (const minutes of [40, 60, 90]) {
  const session = buildSession(queue, { minutes })
  const spent = session.items.reduce((n, i) => n + i.minutes, 0)
  is(session.minutes, spent, `${minutes}: reported total matches the items`)
  if (spent > minutes) is(true, false, `${minutes}: session overruns at ${spent}`)
  for (const item of session.items) {
    is(item.steps.reduce((n, s) => n + s.minutes, 0), item.minutes, `${minutes}: ${item.status} steps fill its slot`)
  }
}

console.log(failed ? `\n${failed} failed` : 'every recipe spends its time, and fading is retested rather than re-read')
process.exit(failed ? 1 : 0)
