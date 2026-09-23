/**
 * The ways to work a deck.
 *
 * Flipping a card and telling yourself you knew it is the weakest form of
 * revision there is — it measures recognition, and an exam asks for recall.
 * These are the modes that ask for more, kept as pure functions so the
 * screens stay presentational and the behaviour can be tested without a DOM.
 *
 *   write   see the front, type the back
 *   blank   a key term removed from the back, type the missing word
 *   test    a graded paper built out of the deck, marked at the end
 *
 * Nothing here talks to the database. Scheduling still belongs to
 * lib/flashcards.js; these decide what to ask, not what it means.
 */

import { normaliseText } from './grading.js'

/* Words too common to be worth hiding, and too common to be worth typing. */
const STOPWORDS = new Set(
  ('the a an of to in on for with and or is are was were be been being that this these those ' +
    'it its as at by from into than then when which who whom whose how what why where can could ' +
    'may might must shall should will would do does did not no nor if but so such very more most ' +
    'over under between about after before during each per one two both all any some')
    .split(' ')
)

/** How close a typed answer has to be. Levenshtein, cheap and good enough. */
function distance(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m || !n) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const row = [i]
    for (let j = 1; j <= n; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = row
  }
  return prev[n]
}

/**
 * Was that the answer?
 *
 * Three outcomes rather than two. A typo is not a wrong answer — marking
 * "photosythesis" wrong teaches spelling, not biology — but it is not a
 * clean right either, so it comes back as `close` and the screen can show
 * what was meant without taking the mark away.
 *
 * The expected side may offer alternatives separated by / or ;, because a
 * card whose back is "mitochondrion / mitochondria" has two right answers.
 */
export function checkWritten(given, expected) {
  const g = normaliseText(given)
  if (!g) return { correct: false, close: false }

  const alternatives = String(expected ?? '')
    .split(/[/;]| or /i)
    .map((x) => normaliseText(x))
    .filter(Boolean)
  if (!alternatives.length) return { correct: false, close: false }

  for (const want of alternatives) {
    if (g === want) return { correct: true, close: false }
    // Containment counts when the answer is a phrase: typing the key term of
    // a long definition is knowing it, not half-knowing it.
    if (want.length > 12 && (g.includes(want) || want.includes(g)) && g.length > 3) {
      return { correct: true, close: false }
    }
  }

  const best = Math.min(...alternatives.map((want) => distance(g, want) / Math.max(g.length, want.length)))
  if (best <= 0.25) return { correct: false, close: true, meant: alternatives[0] }
  return { correct: false, close: false, meant: alternatives[0] }
}

/**
 * The word worth hiding.
 *
 * The longest content word that is not already sitting on the front of the
 * card, because blanking a word the student can read in the question is not
 * a question. Returns null when the back has nothing worth hiding, and the
 * caller should fall back to asking for the whole thing.
 */
export function makeBlank(card) {
  const back = String(card?.back ?? '')
  const front = normaliseText(card?.front ?? '')
  const words = back.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []

  const candidates = words
    .filter((w) => !STOPWORDS.has(w.toLowerCase()))
    .filter((w) => !front.includes(normaliseText(w)))
    .sort((a, b) => b.length - a.length)

  const word = candidates[0]
  if (!word || back.length < 12) return null

  // Only the first occurrence, so the sentence still reads.
  const prompt = back.replace(word, '_'.repeat(Math.max(6, Math.min(14, word.length))))
  if (prompt === back) return null
  return { prompt, answer: word, front: card.front }
}

/** Fisher-Yates against a seeded generator, so a test paper is reproducible. */
function shuffle(list, seed = 1) {
  const out = [...list]
  let s = seed || 1
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * A paper built from the deck.
 *
 * Mixed on purpose. Multiple choice alone is recognition again; written
 * alone is punishing on a deck you have just started. The mix is what a
 * real paper does, and it is what makes the score mean something.
 *
 * Multiple choice needs three other cards to draw distractors from, so a
 * deck smaller than four is all written.
 */
export function buildTest(cards, { length = 10, seed = 1 } = {}) {
  const deck = (cards || []).filter((c) => c?.front && c?.back)
  if (!deck.length) return []

  const picked = shuffle(deck, seed).slice(0, Math.min(length, deck.length))
  const canChoose = deck.length >= 4

  return picked.map((card, i) => {
    const kind = !canChoose ? 'written' : i % 3 === 0 ? 'written' : i % 3 === 1 ? 'choice' : 'truefalse'

    if (kind === 'choice') {
      const others = shuffle(
        deck.filter((c) => c.id !== card.id && normaliseText(c.back) !== normaliseText(card.back)),
        seed + i
      ).slice(0, 3)
      const options = shuffle([card, ...others], seed + i + 7).map((c) => ({
        id: c.id ?? c.back,
        text: c.back,
      }))
      return { kind, card, prompt: card.front, options, answer: card.id ?? card.back }
    }

    if (kind === 'truefalse') {
      // Half the time it is shown with somebody else's answer.
      const lie = (seed + i) % 2 === 0
      const other = shuffle(deck.filter((c) => c.id !== card.id), seed + i + 3)[0]
      const shown = lie && other ? other.back : card.back
      return { kind, card, prompt: card.front, shown, answer: !lie || !other }
    }

    return { kind: 'written', card, prompt: card.front, answer: card.back }
  })
}

/** What the test screen says at the end. */
export function scoreTest(items, responses) {
  let correct = 0
  const marked = items.map((item, i) => {
    const given = responses[i]
    let ok = false
    if (item.kind === 'written') ok = checkWritten(given, item.answer).correct
    else if (item.kind === 'choice') ok = given === item.answer
    else ok = given === item.answer
    if (ok) correct++
    return { ...item, given, correct: ok }
  })
  return { marked, correct, total: items.length }
}
