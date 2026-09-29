/**
 * The forgetting rule, checked at every boundary.
 *
 * Decay is applied at read time on every screen that shows a status, so a
 * mistake here is not a bug in one page — it silently rewrites what every
 * student sees on all of them. It also cannot be noticed by looking: a wrong
 * boundary produces a plausible-looking map that is simply untrue.
 */

import {
  effectiveStatus,
  isDecayed,
  hasLapsed,
  daysOfFadeLeft,
  DECAY_DAYS,
  FADE_DAYS,
} from '../lib/decay.js'

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

const LAPSE = DECAY_DAYS + FADE_DAYS

// --- what fades, and what does not -----------------------------------------
for (const status of ['mastered', 'proficient', 'confident']) {
  is(effectiveStatus(status, ago(1), NOW), status, `${status} holds on day 1`)
  is(effectiveStatus(status, ago(DECAY_DAYS), NOW), status, `${status} holds on the last clear day`)
  is(effectiveStatus(status, ago(DECAY_DAYS + 1), NOW), 'decaying', `${status} fades the day after`)
  is(effectiveStatus(status, ago(LAPSE), NOW), 'decaying', `${status} still fading on the last fade day`)
  is(effectiveStatus(status, ago(LAPSE + 1), NOW), 'in_progress', `${status} lapses to Weak after the fade`)
}

// Weak has nowhere to fall, and Untested is not a level to fall from.
for (const status of ['in_progress', 'not_started']) {
  is(effectiveStatus(status, ago(999), NOW), status, `${status} never decays`)
  is(isDecayed(status, ago(999), NOW), false, `${status} never reads as fading`)
  is(hasLapsed(status, ago(999), NOW), false, `${status} never lapses`)
}

// --- a row with no date is not evidence of forgetting ----------------------
is(effectiveStatus('mastered', null, NOW), 'mastered', 'no date leaves the status alone')
is(isDecayed('mastered', null, NOW), false, 'no date does not read as fading')
is(hasLapsed('mastered', null, NOW), false, 'no date does not lapse')

// --- the two predicates never overlap -------------------------------------
for (let d = 0; d <= LAPSE + 20; d++) {
  const fading = isDecayed('mastered', ago(d), NOW)
  const lapsed = hasLapsed('mastered', ago(d), NOW)
  if (fading && lapsed) is(true, false, `day ${d}: both fading and lapsed`)
  const eff = effectiveStatus('mastered', ago(d), NOW)
  const want = d > LAPSE ? 'in_progress' : d > DECAY_DAYS ? 'decaying' : 'mastered'
  is(eff, want, `day ${d} resolves correctly`)
}

// --- the countdown a student is shown --------------------------------------
is(daysOfFadeLeft('mastered', ago(DECAY_DAYS + 1), NOW), FADE_DAYS - 1, 'fresh fade shows nearly the whole window')
is(daysOfFadeLeft('mastered', ago(LAPSE), NOW), 0, 'last day of the fade shows none left')
is(daysOfFadeLeft('mastered', ago(5), NOW), null, 'not fading yet shows no countdown')
is(daysOfFadeLeft('mastered', ago(LAPSE + 5), NOW), null, 'already lapsed shows no countdown')

// --- proving it again clears everything ------------------------------------
is(effectiveStatus('mastered', ago(0), NOW), 'mastered', 'answering today restores it')

console.log(
  failed
    ? `\n${failed} failed`
    : `forgetting holds: clear to day ${DECAY_DAYS}, fading to day ${LAPSE}, Weak after`
)
process.exit(failed ? 1 : 0)
