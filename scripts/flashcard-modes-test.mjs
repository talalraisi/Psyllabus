/**
 * The deck modes. Mostly this is about being fair: a typo is not a wrong
 * answer, a blank you can read in the question is not a question, and a
 * test built from four cards must not offer the same option twice.
 */
import { checkWritten, makeBlank, buildTest, scoreTest } from '../lib/flashcard-modes.js'
import { AGAIN_CHOICES, requeue, shuffleCards } from '../lib/flashcards.js'

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

// ---- marking on meaning, not on spelling it the same way ------------------
const right = (g, e) => checkWritten(g, e).correct
const wrongMark = (g, e) => !checkWritten(g, e).correct && !checkWritten(g, e).close
check('"the" and "a" do not matter', right('a mitochondrion', 'the mitochondrion'))
check('punctuation does not matter', right('ATP!', 'ATP'))
check('plurals and tense', right('it accelerates', 'accelerating'))
check('word order', right('energy kinetic', 'kinetic energy'))
check('hyphens', right('cross section', 'cross-section'))
check('British and American spelling', right('ionize', 'ionise'))
check('a number is a number', right('0.5', '1/2'))
check('a number with its unit', right('9.81 m/s^2', '9.81'))
check('a wrong number is wrong', wrongMark('9.1', '9.81'))
check('a unit is not split into two answers', wrongMark('s', '10 m/s'))
check('the same idea in other words', right('temperature rises', 'temperature increases'))
check('a definition in your own words', right(
  'it is the rate at which velocity changes',
  'Acceleration is the rate of change of velocity'
))
check('the opposite is wrong', wrongMark('temperature decreases', 'temperature increases'))
check('increase is not decrease even though they look alike', wrongMark('decreases', 'increases'))
check('hypotonic is not hypertonic', wrongMark('hypotonic', 'hypertonic'))
check('a negation flips the answer', wrongMark('is not conserved', 'is conserved'))
check('an aside in brackets is optional', right('DNA polymerase', 'DNA polymerase (adds nucleotides)'))
check('words on the front are not asked for', right('newton', 'The SI unit of force is the newton') === false && checkWritten('newton', 'The SI unit of force is the newton', 'What is the SI unit of force?').correct)
check('half the key words is partial, not right', (() => {
  const r = checkWritten('kinetic energy', 'kinetic energy and momentum')
  return !r.correct && r.partial
})())
check('one word of a two-word answer is not right', !right('kinetic', 'kinetic energy'))
check('a list of every word you know is not an answer', !right(
  'mitosis meiosis osmosis diffusion respiration photosynthesis transpiration translocation velocity',
  'velocity'
))

// ---- coming back, and the order of a round --------------------------------
const q = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r']
const soon = AGAIN_CHOICES.find((c) => c.key === 'soon')
const end = AGAIN_CHOICES.find((c) => c.key === 'end')
check('"soon" lands within a few cards', [0, 0.5, 0.99].every((r) => {
  const at = requeue(q, 0, 'X', soon, () => r).indexOf('X')
  return at >= 2 && at <= 4
}))
check('"soon" is not always the same place', requeue(q, 0, 'X', soon, () => 0).indexOf('X') !== requeue(q, 0, 'X', soon, () => 0.99).indexOf('X'))
check('"at the end" goes last', requeue(q, 3, 'X', end).at(-1) === 'X')
check('requeue near the end does not fall off', requeue(['a', 'b'], 1, 'X', AGAIN_CHOICES[2]).at(-1) === 'X')
const shuffled = shuffleCards(q)
check('a shuffle keeps every card', shuffled.length === q.length && q.every((c) => shuffled.includes(c)))
check('shuffles differ', new Set(Array.from({ length: 6 }, () => shuffleCards(q).join(''))).size > 1)
check('a new round does not start on the card the last ended on', Array.from({ length: 30 }, () => shuffleCards(['a', 'b', 'c'], 'a')[0]).every((c) => c !== 'a'))

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
