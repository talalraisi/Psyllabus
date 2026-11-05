/**
 * The forgetting curve, checked at every boundary.
 *
 * Decay is applied at read time on every screen that shows a status, so a
 * mistake here is not a bug in one page — it silently rewrites what every
 * student sees on all of them. It also cannot be noticed by looking: a wrong
 * boundary produces a plausible-looking map that is simply untrue.
 */

import { effectiveStatus, isDecayed, hasLapsed, daysOfFadeLeft, dropsTo, SCHEDULE } from '../lib/decay.js'

const DAY = 86400000
const NOW = Date.UTC(2026, 0, 1)
const ago = (d) => new Date(NOW - d * DAY).toISOString()

let failed = 0
const is = (got, want, what) => {
  if (got !== want) {
    console.log(`  FAIL  ${what}\n        got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
    failed++
  }
}

// --- the weeks as asked for: Mastered holds 4, fades 5-6, Developing 7, then Weak
is(effectiveStatus('mastered', ago(28), NOW), 'mastered', 'Mastered holds through week 4')
is(effectiveStatus('mastered', ago(29), NOW), 'decaying', 'Mastered fades from week 5')
is(effectiveStatus('mastered', ago(42), NOW), 'decaying', 'Mastered still fading at the end of week 6')
is(effectiveStatus('mastered', ago(43), NOW), 'confident', 'Mastered drops to Developing in week 7')
is(effectiveStatus('mastered', ago(49), NOW), 'confident', 'Developing to the end of week 7')
is(effectiveStatus('mastered', ago(50), NOW), 'in_progress', 'then Weak')

// --- every level, at every boundary of its own schedule ----------------------
for (const [status, s] of Object.entries(SCHEDULE)) {
  const fadeEnd = s.holds + s.fades
  const slipEnd = fadeEnd + s.slips
  for (let d = 0; d <= slipEnd + 10; d++) {
    const want = d <= s.holds ? status : d <= fadeEnd ? 'decaying' : d <= slipEnd ? 'confident' : 'in_progress'
    is(effectiveStatus(status, ago(d), NOW), want, `${status} on day ${d}`)
    if (isDecayed(status, ago(d), NOW) && hasLapsed(status, ago(d), NOW)) is(true, false, `${status} day ${d}: both fading and lapsed`)
  }
  is(daysOfFadeLeft(status, ago(s.holds + 1), NOW), s.fades - 1, `${status}: a fresh fade shows nearly the whole window`)
  is(daysOfFadeLeft(status, ago(fadeEnd), NOW), 0, `${status}: last fade day shows none left`)
  is(daysOfFadeLeft(status, ago(1), NOW), null, `${status}: not fading shows no countdown`)
}

// Stronger memories last longer.
is(SCHEDULE.mastered.holds > SCHEDULE.proficient.holds && SCHEDULE.proficient.holds > SCHEDULE.confident.holds, true, 'better known holds longer')
is(dropsTo('mastered'), 'confident', 'Mastered fades to Developing')
is(dropsTo('confident'), 'in_progress', 'Developing fades to Weak')

// Weak has nowhere to fall, and Untested is not a level to fall from.
for (const status of ['in_progress', 'not_started']) {
  is(effectiveStatus(status, ago(999), NOW), status, `${status} never decays`)
  is(isDecayed(status, ago(999), NOW), false, `${status} never reads as fading`)
  is(hasLapsed(status, ago(999), NOW), false, `${status} never lapses`)
}

// --- a row with no date is not evidence of forgetting ----------------------
is(effectiveStatus('mastered', null, NOW), 'mastered', 'no date leaves the status alone')
// --- proving it again clears everything ------------------------------------
is(effectiveStatus('mastered', ago(0), NOW), 'mastered', 'answering today restores it')

console.log(failed ? `\n${failed} failed` : 'forgetting holds: Mastered 4 weeks, Fading weeks 5-6, Developing week 7, then Weak')
process.exit(failed ? 1 : 0)
