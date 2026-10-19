/** Short forms of subject names, for chips and small spaces. */

/** "Math Analysis & Approaches HL" → AA, "Computer Science SL" → CS, "Physics SL" → Ph. */
export function subjectCode(subject = '') {
  if (/^Math Analysis/i.test(subject)) return 'AA'
  if (/^Math Applications/i.test(subject)) return 'AI'
  if (/^Theory of Knowledge/i.test(subject)) return 'TOK'
  if (/^Extended Essay/i.test(subject)) return 'EE'
  if (/^(CAS\b|Creativity)/i.test(subject)) return 'CAS'
  const words = subject
    .replace(/\b(SL|HL|A:|B|ab initio)\b/gi, '')
    .split(/[\s:&,]+/)
    .filter((w) => /^[A-Za-z]/.test(w))
  if (words.length >= 2 && /^[A-Z]/.test(words[1])) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] || subject).slice(0, 2)
}

/** A name that fits under a node: "Math Analysis & Approaches HL" → "Maths AA". */
export function shortName(subject = '') {
  return subject
    .replace(/\s+(SL|HL)$/, '')
    .replace(/^Math Analysis & Approaches/i, 'Maths AA')
    .replace(/^Math Applications & Interpretation/i, 'Maths AI')
    .replace(/^Creativity,? Activity,? (and )?Service/i, 'CAS')
    .replace(/^English A: Language & Literature/i, 'English Lang & Lit')
    .replace(/^English A: Literature/i, 'English Lit')
    .replace(/^(\w+) A: Language & Literature/i, '$1 Lang & Lit')
}

export const levelOf = (subject = '') => (subject.match(/\b(SL|HL)\b/) || [])[1] || ''
