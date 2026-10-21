/**
 * The free checks on generated questions. Each failing case is a mistake a
 * model actually made in testing; each passing case is one that must not be
 * thrown away by an over-eager rule.
 *
 *   node scripts/content-checks-test.mjs
 */
import { checkQuestion, checkLesson, sameValue } from './content/checks.mjs'
import { planCounts } from './content/formats.mjs'
import { slotsFor } from './content/prompts.mjs'

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}
const has = (problems, text) => problems.some((p) => p.includes(text))

const ms = (marks) => ({ command_term: 'Calculate', points: Array.from({ length: marks }, (_, i) => ({ point: `step ${i + 1}`, marks: 1 })), guidance: '' })
const none = { kind: 'none', alt: '' }

const mcq = {
  heat: 'medium', type: 'mcq', marks: 1, stem: 'A ball is dropped from rest from 5.0 m. What is its speed at the ground?', stimulus: '', figure: none,
  options: [
    { id: 'a', text: '7.0 m s^-1', why_wrong: 'Left out the factor of 1/2.' },
    { id: 'b', text: '9.9 m s^-1', why_wrong: '' },
    { id: 'c', text: '98 m s^-1', why_wrong: 'Forgot the square root.' },
    { id: 'd', text: '49 m s^-1', why_wrong: 'Used v = gh.' },
  ],
  correct_answer: 'b', accepted_answers: [], answer_kind: 'none', answer_hint: '', wrong_answers: [],
  hint: 'Equate the energy lost to the energy gained.', explanation: 'mgh = 1/2 mv^2', markscheme: ms(1),
}
const typed = {
  heat: 'hot', type: 'short_answer', marks: 2, stem: 'A 1500 kg car is pushed by a net force of 3000 N for 20 m from rest. Calculate its kinetic energy.', stimulus: '', figure: none,
  options: [], correct_answer: '', accepted_answers: ['60000', '6.0 x 10^4'], answer_kind: 'numeric', answer_hint: 'in J',
  wrong_answers: [{ answer: '3000', feedback: 'Gave the force.' }, { answer: '120000', feedback: 'Doubled the work.' }],
  hint: 'Work done by the net force becomes kinetic energy.', explanation: 'W = Fs = 60000 J', markscheme: ms(2),
}

// ---- passes ----------------------------------------------------------------
check('a good multiple-choice question passes', checkQuestion(mcq, { heat: 'medium', type: 'mcq' }).length === 0)
check('a good typed question passes', checkQuestion(typed, { heat: 'hot', type: 'short_answer' }).length === 0)
check('rounding variants are the same value', sameValue(1.835, 1.8) && sameValue(21.36, 21) && sameValue(22.5, 23))
check('rounding variants pass as accepted answers', checkQuestion({ ...typed, accepted_answers: ['1.835', '1.84', '1.8'] }).length === 0)

// ---- the mistakes from testing ----------------------------------------------
check('"60 kJ" accepted for 60000 J fails', has(checkQuestion({ ...typed, accepted_answers: ['60000', '60 kJ'] }), 'different value'))
check('multiple choice worth 2 marks fails', has(checkQuestion({ ...mcq, marks: 2, markscheme: ms(2) }), 'always 1'))
check('missing markscheme fails', has(checkQuestion({ ...typed, markscheme: { command_term: '', points: [], guidance: '' } }), 'no markscheme'))
check('markscheme marks must add up', has(checkQuestion({ ...typed, markscheme: ms(1) }), 'gives 1 marks for a 2-mark'))
check('an option with no feedback fails', has(checkQuestion({ ...mcq, options: mcq.options.map((o) => (o.id === 'c' ? { ...o, why_wrong: '' } : o)) }), 'option c has no feedback'))
check('feedback on the correct option fails', has(checkQuestion({ ...mcq, options: mcq.options.map((o) => (o.id === 'b' ? { ...o, why_wrong: 'Wrong because...' } : o)) }), 'correct option carries'))
check('two identical options fail', has(checkQuestion({ ...mcq, options: mcq.options.map((o) => (o.id === 'd' ? { ...o, text: '7.0 m s^-1' } : o)) }), 'same thing'))
check('a wrong answer that is right fails', has(checkQuestion({ ...typed, wrong_answers: [{ answer: '60000', feedback: 'x' }, { answer: '1', feedback: 'y' }] }), 'actually the right answer'))
check('fewer than 2 wrong typed answers fails', has(checkQuestion({ ...typed, wrong_answers: [{ answer: '1', feedback: 'x' }] }), 'fewer than 2'))
check('a hint with the answer fails', has(checkQuestion({ ...typed, hint: 'The answer is 60000 J.' }), 'hint contains the answer'))
check('the wrong heat fails', has(checkQuestion(mcq, { heat: 'burning', type: 'mcq' }), 'slot asked for burning'))
check('currency inside maths fails', has(checkQuestion({ ...typed, stem: 'A tax of $40$ per unit is imposed. Calculate the revenue.' }), 'currency'))

// ---- figures ------------------------------------------------------------------
const circuit = { kind: 'circuit', alt: 'A 12 V cell, R1 in series, R2 and R3 in parallel.', source: '12 V', series: [{ type: 'resistor', label: 'R1 = 2.0 Ω' }], parallel: [[{ type: 'resistor', label: 'R2 = 6.0 Ω' }], [{ type: 'resistor', label: 'R3 = 3.0 Ω' }]] }
check('a good circuit passes', checkQuestion({ ...typed, stem: 'The circuit shows three resistors. Calculate the current in R2.', figure: circuit }).length === 0)
check('a figure the stem never mentions fails', has(checkQuestion({ ...typed, figure: circuit }), 'never refers'))
check('a single parallel branch fails', has(checkQuestion({ ...typed, stem: 'The circuit shows...', figure: { ...circuit, parallel: [[{ type: 'lamp', label: '' }]] } }), 'single'))
const forces = { kind: 'forces', alt: 'Block on a 30° slope.', surface: 'incline', angle_deg: 30, body: 'block', forces: [{ label: 'W', direction_deg: 270, size: 1 }, { label: 'R', direction_deg: 60, size: 0.85 }] }
check('a good forces diagram passes', checkQuestion({ ...typed, stem: 'The diagram shows a block on a slope. Calculate...', figure: forces }).length === 0)
check('an incline with no angle fails', has(checkQuestion({ ...typed, stem: 'The diagram shows...', figure: { ...forces, angle_deg: undefined } }), 'incline angle'))
check('an empty table fails', has(checkQuestion({ ...typed, stem: 'The table shows...', figure: { kind: 'table', alt: 'x', columns: [], rows: [] } }), 'too little data'))

// ---- planning -----------------------------------------------------------------
const planned = planCounts(
  [{ subtopic: 'a', hours: 8, siblings: 5 }, { subtopic: 'b', hours: 2, siblings: 4 }, { subtopic: 'c' }],
  'sciences'
)
check('more teaching hours, more questions', planned[0].total > planned[1].total)
check('no hours means the base count', planned[2].total === 30)
check('heats add up to the total', planned.every((p) => Object.values(p.heats).reduce((a, b) => a + b, 0) === p.total))
const slots = slotsFor(planned[2].heats, 'sciences')
check('slots cover every heat', ['low', 'medium', 'hot', 'extreme', 'burning'].every((h) => slots.some((s) => s.heat === h)))
check('the hardest questions are always typed', slots.filter((s) => s.heat === 'extreme' || s.heat === 'burning').every((s) => s.type === 'short_answer'))
const mcqShare = slots.filter((s) => s.type === 'mcq').length / slots.length
check('roughly half multiple choice for a science', mcqShare > 0.3 && mcqShare < 0.6)
check('maths is mostly typed', slotsFor({ low: 6, medium: 8, hot: 12, extreme: 3, burning: 2 }, 'maths').filter((s) => s.type === 'mcq').length <= 6)

// ---- lessons ------------------------------------------------------------------
const goodCheck = { type: 'mcq', stem: 'Which is conserved?', options: mcq.options, correct_answer: 'b', accepted_answers: [], answer_kind: 'none', feedback_right: 'Yes.', feedback_wrong: 'Energy is conserved.' }
const section = { heading: 'Energy', body: 'word '.repeat(90), figure: none, check: goodCheck }
const lesson = {
  intro: 'x', minutes: 10, sections: [section, section, section], worked_example: { problem: 'p', steps: ['s'], answer: 'a' },
  mistakes: ['m'], key_terms: [], outcomes: [{ statement: 'Calculate...', check: goodCheck }, { statement: 'b', check: goodCheck }, { statement: 'c', check: goodCheck }],
  cards: Array.from({ length: 15 }, (_, i) => ({ front: `f${i}`, back: `b${i}` })),
}
check('a good lesson passes', checkLesson(lesson).length === 0)
check('a lesson with 2 sections fails', has(checkLesson({ ...lesson, sections: [section, section] }), '2 sections'))
check('a lesson check with no feedback fails', has(checkLesson({ ...lesson, outcomes: [...lesson.outcomes.slice(1), { statement: 'x', check: { ...goodCheck, feedback_wrong: '' } }] }), 'no feedback'))

console.log(failed ? `\n${failed} failing` : '\nevery check catches what it should, and nothing else')
process.exit(failed ? 1 : 0)
