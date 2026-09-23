/**
 * The deck modes. Mostly this is about being fair: a typo is not a wrong
 * answer, a blank you can read in the question is not a question, and a
 * test built from four cards must not offer the same option twice.
 */
import { checkWritten, makeBlank, buildTest, scoreTest } from '../lib/flashcard-modes.js'

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

// ---- written answers -------------------------------------------------------
check('exact', checkWritten('photosynthesis', 'photosynthesis').correct)
check('case and spacing do not matter', checkWritten('  Photosynthesis ', 'photosynthesis').correct)
check('a typo is close, not wrong', (() => {
  const r = checkWritten('photosythesis', 'photosynthesis')
  return !r.correct && r.close
})())
check('a different word is wrong, not close', (() => {
  const r = checkWritten('respiration', 'photosynthesis')
  return !r.correct && !r.close
})())
check('alternatives separated by a slash', checkWritten('mitochondria', 'mitochondrion / mitochondria').correct)
check('alternatives separated by "or"', checkWritten('velocity', 'speed or velocity').correct)
check('the key term of a long definition counts', checkWritten(
  'the rate of change of velocity',
  'acceleration is the rate of change of velocity'
).correct)
check('empty is wrong and not close', (() => {
  const r = checkWritten('', 'anything')
  return !r.correct && !r.close
})())
check('nothing to match against is wrong', !checkWritten('x', '').correct)

// ---- fill in the blank -----------------------------------------------------
const blank = makeBlank({
  front: 'What process converts light energy into chemical energy?',
  back: 'Photosynthesis in the chloroplast',
})
check('blanks a word', !!blank && blank.prompt.includes('_'))
check('and does not blank a word already on the front', !!blank && blank.answer.toLowerCase() !== 'energy')
check('the answer is a real word from the back', !!blank && /^[A-Za-z'-]+$/.test(blank.answer))
check('a back too short to hide anything returns null', makeBlank({ front: 'a', back: 'x' }) === null)
check('a back of only stopwords returns null', makeBlank({ front: 'q', back: 'of the and to' }) === null)

// ---- test papers -----------------------------------------------------------
const deck = Array.from({ length: 8 }, (_, i) => ({
  id: `c${i}`,
  front: `Front ${i}`,
  back: `Back ${i}`,
}))
const paper = buildTest(deck, { length: 6, seed: 3 })
check('builds the length asked for', paper.length === 6)
check('mixes the kinds', new Set(paper.map((p) => p.kind)).size >= 2)
check('every item has a prompt', paper.every((p) => !!p.prompt))
check('choices offer four distinct options', paper
  .filter((p) => p.kind === 'choice')
  .every((p) => p.options.length === 4 && new Set(p.options.map((o) => o.text)).size === 4))
check('the right answer is among the options', paper
  .filter((p) => p.kind === 'choice')
  .every((p) => p.options.some((o) => o.id === p.answer)))
check('the same seed builds the same paper', JSON.stringify(buildTest(deck, { length: 6, seed: 3 })) === JSON.stringify(paper))
check('a different seed does not', JSON.stringify(buildTest(deck, { length: 6, seed: 9 })) !== JSON.stringify(paper))

const tiny = buildTest(deck.slice(0, 3), { length: 3, seed: 1 })
check('a deck too small for distractors is all written', tiny.every((p) => p.kind === 'written'))
check('an empty deck builds nothing', buildTest([], {}).length === 0 && buildTest(null, {}).length === 0)

// ---- scoring ---------------------------------------------------------------
const answers = paper.map((p) =>
  p.kind === 'written' ? p.answer : p.kind === 'choice' ? p.answer : p.answer
)
const perfect = scoreTest(paper, answers)
check('a perfect paper scores full marks', perfect.correct === paper.length)
const none = scoreTest(paper, paper.map(() => 'nonsense'))
check('nonsense scores nothing', none.correct === 0)
check('scoring returns every item marked', perfect.marked.length === paper.length)

console.log(failed ? `\n${failed} failing` : '\nthe modes ask fairly and mark fairly')
process.exit(failed ? 1 : 0)
