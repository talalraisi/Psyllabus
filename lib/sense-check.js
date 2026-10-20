/**
 * Is this a real piece of writing? Checked before a draft is sent to be
 * marked, for free, so keyboard mashing, one sentence pasted fifty times or
 * a page of random letters never costs a review or a student's allowance.
 *
 * Deliberately forgiving: it only turns away text no examiner could mark.
 * Works for any script; the vowel test applies to Latin letters only, so
 * Arabic, Chinese and the rest pass on the other checks alone.
 */

export const MIN_CHARS = 150

const LATIN = /^[a-z'’-]+$/i

/** null if it reads like writing, or a sentence saying why it does not. */
export function senseCheck(text) {
  const clean = String(text || '').trim()
  if (clean.length < MIN_CHARS) return `Paste at least ${MIN_CHARS} characters of your draft.`

  // Mostly letters: numbers and symbols alone are not writing.
  const visible = clean.replace(/\s/g, '')
  const letters = (visible.match(/\p{L}/gu) || []).length
  if (letters / visible.length < 0.6) return 'That is mostly symbols and numbers rather than writing.'

  const bare = clean
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => /\p{L}/u.test(w))

  // Keyboard mashing: Latin "words" with no vowels, runs of one letter, or
  // absurd lengths.
  const latin = bare.filter((w) => LATIN.test(w))
  const odd = latin.filter((w) => w.length > 2 && (!/[aeiouy]/.test(w) || /(.)\1{3,}/.test(w) || w.length > 24)).length
  if (latin.length >= 8 && odd / latin.length > 0.3) return 'That does not read as writing. Paste your actual draft.'
  if (bare.length && bare.every((w) => w.length > 24)) return 'That does not read as writing. Paste your actual draft.'

  // The same few words over and over.
  const unique = new Set(bare).size
  if (bare.length >= 12 && (unique / bare.length < 0.18 || unique < 5)) {
    return 'That repeats the same words too much to mark. Paste your actual draft.'
  }

  // The same sentence pasted many times.
  const sentences = clean
    .split(/(?<=[.!?。؟])\s+|\n+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.split(/\s+/).length >= 4)
  if (sentences.length >= 6) {
    const counts = new Map()
    for (const s of sentences) counts.set(s, (counts.get(s) || 0) + 1)
    const top = Math.max(...counts.values())
    if (top / sentences.length > 0.3) return 'That repeats the same sentence too many times to mark.'
  }

  return null
}
