/**
 * The scratchpad filter has to catch the model talking to itself without
 * catching an explanation that simply explains something.
 */
import { readsLikeScratchpad, scratchpadTell } from '../lib/explanation-quality.js'

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

// The one that shipped.
const real =
  'ATC = TC/Q = 100/Q + 5 + Q. To find the minimum, take the derivative and set to zero: ' +
  'd(ATC)/dQ = -100/Q^2 + 1 = 0. So 100/Q^2 = 1, Q^2 = 100, Q = 10. Wait, I think I messed up. ' +
  "Let's do it again... But the accepted_answers is [5, 5.0]. That's not right. I need to fix this."
check('catches the one that shipped', !!readsLikeScratchpad({ explanation: real }))
check('names the tell it found', scratchpadTell(real) === 'wait,')

check('catches a leak in the hint', !!readsLikeScratchpad({ hint: "Hmm, let me fix this first." }))
check(
  'catches a leak in option feedback',
  !!readsLikeScratchpad({ option_feedback: { a: "That's not right, I need to fix this." } })
)
check('catches a leak in the stem', !!readsLikeScratchpad({ stem: "Wait, actually, let's change it." }))

// Ordinary teaching prose must survive, including the words that look close.
const fine = [
  'Marginal cost is the derivative of total cost with respect to quantity. At Q = 2, MC = 5.',
  'However, note that demand is inelastic here, so revenue rises when price rises.',
  'Wait until the reaction reaches equilibrium before taking the reading.',
  'The poet lets the line break fall mid-clause, which slows the reader down.',
  'Try substituting u = 2x + 1. Let u be the inner function.',
  'Actually measuring this requires a control group.',
]
for (const f of fine) {
  check(`leaves ordinary prose alone: "${f.slice(0, 44)}…"`, !readsLikeScratchpad({ explanation: f }))
}

check('empty is fine', !readsLikeScratchpad({}) && !readsLikeScratchpad(null) && !scratchpadTell(''))

console.log(failed ? `\n${failed} failing` : '\nthe filter catches the scratchpad and nothing else')
process.exit(failed ? 1 : 0)
