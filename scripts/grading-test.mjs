/**
 * Reading a typed number. A student's right answer has to be read as right
 * however they type it, and a different number never.
 *
 *   node scripts/grading-test.mjs
 */
import { parseNumber, gradeShortAnswer, feedbackFor } from '../lib/grading.js'

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}
const reads = (text, want) => {
  const got = parseNumber(text)
  return want === null ? got === null : got != null && Math.abs(got - want) <= Math.abs(want) * 1e-9 + 1e-12
}

check('a plain number', reads('9.81', 9.81))
check('a negative number', reads('-1.5', -1.5))
check('a real minus sign', reads('−1.5', -1.5))
check('a fraction', reads('1/2', 0.5))
check('scientific with x', reads('6.02 x 10^23', 6.02e23))
check('scientific with a real times sign', reads('1.0 × 10^2', 100))
check('scientific with a dot', reads('6.02 · 10^23', 6.02e23))
check('e notation', reads('3e8', 3e8))
check('thousands separators', reads('60,000', 60000))
check('an IB unit with spaces and powers', reads('9.8 m s^-2', 9.8))
check('a compound unit', reads('4.2 kJ kg^-1 K^-1', 4.2))
check('an old-style unit', reads('20 m/s', 20))
check('ohms', reads('6.0 Ω', 6))
check('degrees', reads('25 °C', 25))
check('a percentage', reads('64 %', 64))
check('scientific with a unit', reads('2.0 × 10^4 J', 20000))
check('"about" before the number', reads('about 40', 40))
check('two numbers is not one answer', reads('9.8 and 10', null))
check('words are not a number', reads('mitochondria', null))
check('empty is nothing', reads('', null))

const q = { question_type: 'short_answer', accepted_answers: ['21.4', '21'], answer_kind: 'numeric' }
check('right with a unit is right', gradeShortAnswer(q, '21.4 m s^-1').correct)
check('a rounding variant is right', gradeShortAnswer(q, '21').correct)
check('a different value is wrong', !gradeShortAnswer(q, '19.8').correct)

const typedQ = {
  question_type: 'short_answer',
  accepted_answers: ['9.9'],
  wrong_answer_feedback: [
    { answer: '98', feedback: 'You found v^2 and forgot the square root.' },
    { answer: '320', feedback: 'You left out gravity.' },
    { answer: 'kinetic energy', feedback: 'That is what it becomes, not where it comes from.' },
  ],
}
check('a known wrong number gets its feedback', feedbackFor(typedQ, '98')?.includes('square root'))
check('the same mistake rounded differently still matches', feedbackFor(typedQ, '318')?.includes('gravity'))
check('with a unit too', feedbackFor(typedQ, '98 m s^-1')?.includes('square root'))
check('a known wrong term matches', feedbackFor(typedQ, 'Kinetic energy')?.includes('becomes'))
check('an unknown wrong answer has no feedback', feedbackFor(typedQ, '42') === null)
check('multiple choice reads its option', feedbackFor({ question_type: 'mcq', option_feedback: { c: 'Forgot the root.' } }, 'c') === 'Forgot the root.')

console.log(failed ? `\n${failed} failing` : '\nevery way of typing a number reads the same')
process.exit(failed ? 1 : 0)
