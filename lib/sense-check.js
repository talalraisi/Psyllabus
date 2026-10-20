/**
 * Is this a real piece of writing? Checked before a draft is sent to be
 * marked, for free, so keyboard mashing, one sentence pasted fifty times or
 * a page of random letters never costs a review or a student's allowance.
 *
 * Deliberately forgiving: it only turns away text no examiner could mark.
 * Works for any script; the vowel test applies to Latin letters only, so
 * Arabic, Chinese and the rest pass on the other checks alone.
 */

export const MIN_WORDS = 150

const LATIN = /^[a-z'’-]+$/i

/** null if it reads like writing, or a sentence saying why it does not. */
export function senseCheck(text) {
  const clean = String(text || '').trim()
  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length < MIN_WORDS) return `Paste at least ${MIN_WORDS} words of your draft.`

  // Words with letters in them: numbers and symbols alone are not writing.
  const bare = words.map((w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter((w) => /\p{L}/u.test(w))
  if (bare.length < MIN_WORDS * 0.8) return 'That is mostly symbols and numbers rather than writing.'

  // Keyboard mashing: Latin "words" with no vowels, runs of one letter, or
  // absurd lengths.
  const latin = bare.filter((w) => LATIN.test(w))
  const odd = latin.filter((w) => w.length > 2 && (!/[aeiouy]/.test(w) || /(.)\1{3,}/.test(w) || w.length > 24)).length
  if (latin.length > 50 && odd / latin.length > 0.25) return 'That does not read as writing. Paste your actual draft.'

  // The same few words over and over.
  const unique = new Set(bare).size
  if (unique / bare.length < 0.18 || unique < 60) return 'That repeats the same words too much to mark. Paste your actual draft.'

  // The same sentence pasted many times.
  const sentences = clean
    .split(/(?<=[.!?。؟])\s+|\n+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.split(/\s+/).length >= 4)
  if (sentences.length >= 8) {
    const counts = new Map()
    for (const s of sentences) counts.set(s, (counts.get(s) || 0) + 1)
    const top = Math.max(...counts.values())
    if (top / sentences.length > 0.3) return 'That repeats the same sentence too many times to mark.'
  }

  return null
}
