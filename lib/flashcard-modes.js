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

import { normaliseText, parseNumber, numbersMatch } from './grading.js'

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

/* Words that mean the same thing in an answer, folded to one stem. Kept
   small and general: the point is "rises" and "increases", not a thesaurus. */
const SAME = {
  ris: 'increas', grow: 'increas', gain: 'increas', rais: 'increas', higher: 'increas', more: 'increas',
  fall: 'decreas', drop: 'decreas', reduc: 'decreas', lower: 'decreas', declin: 'decreas', less: 'decreas', fewer: 'decreas',
  big: 'larg', great: 'larg', bigger: 'larg', larger: 'larg', greater: 'larg',
  littl: 'smal', tiny: 'smal', smaller: 'smal',
  quick: 'fast', rapid: 'fast', faster: 'fast', quicker: 'fast',
  mak: 'produc', made: 'produc', creat: 'produc', generat: 'produc', form: 'produc',
  emit: 'releas', giv: 'releas',
  caus: 'lead', result: 'lead',
  everi: 'all', each: 'all',
}

const NEGATION = /\b(not|no|never|cannot|cant|isnt|doesnt|dont|wont|without)\b/

/** Text as the marking sees it: no case, no punctuation, one spelling. */
function clean(text) {
  return normaliseText(
    String(text ?? '')
      .replace(/&/g, ' and ')
      .replace(/(?<=[a-z])[-–](?=[a-z])/gi, ' ')
      .replace(/(?<=[a-z])'(?=[a-z])/gi, '')
  )
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A rough stem: enough that "accelerates", "accelerated" and "accelerating" meet. */
function stem(word) {
  let w = word.replace(/yze$/, 'yse').replace(/ize/g, 'ise').replace(/our$/, 'or')
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && (w.endsWith('ied') || w.endsWith('ies'))) w = `${w.slice(0, -3)}y`
  else if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 4 && /(ss|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1)
  return SAME[w] || w
}

function stems(text, { content = true } = {}) {
  const words = clean(text).split(' ').filter(Boolean)
  const kept = content ? words.filter((w) => !STOPWORDS.has(w)) : words
  return (kept.length ? kept : words).map(stem)
}

/**
 * Are these the same word? 'exact' for equal stems, 'typo' for a slipped key
 * in a long word, false otherwise. A typo has to start the same way, because
 * the words that differ only at the front ("increases" and "decreases",
 * "exothermic" and "endothermic") are opposites, not misspellings.
 */
function sameWord(a, b) {
  if (a === b) return 'exact'
  const n = Math.min(a.length, b.length)
  if (n < 5 || a.slice(0, 2) !== b.slice(0, 2)) return false
  return distance(a, b) <= (n >= 10 ? 2 : 1) ? 'typo' : false
}

/**
 * The answers a card's back allows. The whole back always; for a short back,
 * each side of a / ; or "or"; and the back without anything in brackets,
 * which is usually an aside rather than part of the answer.
 */
function alternativesOf(expected) {
  const raw = String(expected ?? '').trim()
  if (!raw) return []
  const out = [raw]
  const bare = raw.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').trim()
  if (bare && bare !== raw) out.push(bare)
  if (raw.split(/\s+/).length <= 8) {
    for (const part of raw.split(/\s+\/\s+|(?<=[a-z]{3})\/(?=[a-z]{3})|;|\s+or\s+/i)) {
      if (part.trim() && part.trim() !== raw) out.push(part.trim())
    }
  }
  return [...new Set(out)]
}

/** How much of what the back says is in what was typed. */
function coverage(given, want, front) {
  const asked = new Set(front ? stems(front) : [])
  const all = [...new Set(stems(want))]
  // Words already on the front are the question, not the answer.
  const fresh = all.filter((w) => !asked.has(w))
  const wanted = fresh.length ? fresh : all
  const typed = [...new Set(stems(given))]
  if (!wanted.length || !typed.length) return { recall: 0, precision: 0, wanted: wanted.length }
  let typos = 0
  const hits = wanted.filter((w) => {
    const how = typed.map((t) => sameWord(w, t))
    if (how.includes('exact')) return true
    if (how.includes('typo')) return ++typos
    return false
  }).length
  const used = typed.filter((t) => wanted.some((w) => sameWord(w, t))).length
  return { recall: hits / wanted.length, precision: used / typed.length, wanted: wanted.length, typos }
}

/**
 * Was that the answer?
 *
 * Marked on meaning as far as a rule can manage it, because an answer that
 * says the right thing in other words is a right answer. Case, punctuation,
 * "the" and "a", plurals and tense, word order, British or American
 * spelling and a short list of everyday synonyms all fall away. A number is
 * read as a number, so "0.5" and "1/2" agree. A longer answer counts when it
 * carries most of the back's key words.
 *
 * Four outcomes:
 *   correct   it is the answer
 *   close     the answer misspelt; counted, and the spelling shown
 *   partial   some of the key words but not enough; the student decides
 *   neither   wrong
 *
 * Words that are already on the front of the card are not asked for: to
 * "What is the SI unit of force?", "newton" is the whole answer even when
 * the back spells out "The SI unit of force is the newton".
 *
 * A rule cannot catch every way of saying something, so the screens also let
 * the student overrule a wrong mark. They have the answer in front of them.
 */
export function checkWritten(given, expected, front = '') {
  const g = clean(given)
  if (!g) return { correct: false, close: false }

  const alternatives = alternativesOf(expected)
  if (!alternatives.length) return { correct: false, close: false }
  const meant = alternatives[0]

  let partial = false
  let close = false
  for (const want of alternatives) {
    const w = clean(want)
    if (!w) continue
    if (g === w) return { correct: true, close: false }

    // A number is a number, whatever was typed around it.
    if (parseNumber(want) != null && parseNumber(given) != null) {
      if (numbersMatch(parseNumber(given), parseNumber(want), 0.02)) return { correct: true, close: false }
      continue
    }

    const gs = stems(given, { content: false })
    const ws = stems(want, { content: false })
    if (gs.length === ws.length && [...gs].sort().join(' ') === [...ws].sort().join(' ')) {
      return { correct: true, close: false }
    }

    // "is not" is not "is".
    if (NEGATION.test(g) !== NEGATION.test(w)) continue

    const { recall, precision, wanted, typos } = coverage(given, want, front)
    const enough = wanted <= 3 ? 1 : wanted <= 6 ? 0.75 : 0.6
    // An essay that happens to contain the words is not an answer either.
    const focused = precision >= 0.3 || stems(given).length <= wanted + 4
    if (recall >= enough && focused) {
      if (!typos) return { correct: true, close: false }
      close = true
    } else if (recall >= 0.5 && wanted >= 2) partial = true
  }

  if (close) return { correct: false, close: true, meant }
  return { correct: false, close: false, partial, meant }
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
    if (item.kind === 'written') {
      const r = checkWritten(given, item.answer, item.prompt)
      ok = r.correct || r.close
    }
    else if (item.kind === 'choice') ok = given === item.answer
    else ok = given === item.answer
    if (ok) correct++
    return { ...item, given, correct: ok }
  })
  return { marked, correct, total: items.length }
}
