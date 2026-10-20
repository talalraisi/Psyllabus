/**
 * The marking criteria Syllabi reads a draft against.
 *
 * Written out here for the pieces where the criteria are fixed and known, so
 * the marks add up to the real total and the names match the subject guide.
 * For anything else Syllabi works from the criteria as it knows them, and the
 * page says so: a student should check those against their own guide.
 *
 * If the IB changes a guide, this is the one place to change.
 */

const SCIENCE_IA = {
  name: 'Scientific investigation',
  scale: '1-7',
  criteria: [
    { id: 'A', name: 'Research design', max: 6 },
    { id: 'B', name: 'Data analysis', max: 6 },
    { id: 'C', name: 'Conclusion', max: 6 },
    { id: 'D', name: 'Evaluation', max: 6 },
  ],
}

const MATHS_IA = {
  name: 'Mathematical exploration',
  scale: '1-7',
  criteria: [
    { id: 'A', name: 'Presentation', max: 4 },
    { id: 'B', name: 'Mathematical communication', max: 4 },
    { id: 'C', name: 'Personal engagement', max: 3 },
    { id: 'D', name: 'Reflection', max: 3 },
    { id: 'E', name: 'Use of mathematics', max: 6 },
  ],
}

const EE = {
  name: 'Extended Essay',
  scale: 'A-E',
  criteria: [
    { id: 'A', name: 'Framework for the essay', max: 6 },
    { id: 'B', name: 'Knowledge and understanding', max: 6 },
    { id: 'C', name: 'Analysis and line of argument', max: 6 },
    { id: 'D', name: 'Discussion and evaluation', max: 8 },
    { id: 'E', name: 'Engagement', max: 4 },
  ],
}

const TOK_ESSAY = {
  name: 'TOK essay',
  scale: 'A-E',
  criteria: [{ id: 'A', name: 'A clear, coherent and critical exploration of the title', max: 10 }],
}

// Exam papers: answers written under timed conditions, marked against the
// paper's own criteria. A paper needs the question it answers (and, for a
// Language A Paper 1, the extract), so these kinds ask for it.
const LANG_A_P1 = {
  name: 'Paper 1: guided textual analysis',
  scale: '1-7',
  criteria: [
    { id: 'A', name: 'Understanding and interpretation', max: 5 },
    { id: 'B', name: 'Analysis and evaluation', max: 5 },
    { id: 'C', name: 'Focus and organization', max: 5 },
    { id: 'D', name: 'Language', max: 5 },
  ],
}

const LANG_A_P2 = {
  name: 'Paper 2: comparative essay',
  scale: '1-7',
  criteria: [
    { id: 'A', name: 'Knowledge, understanding and interpretation', max: 10 },
    { id: 'B', name: 'Analysis and evaluation', max: 10 },
    { id: 'C', name: 'Focus and organization', max: 5 },
    { id: 'D', name: 'Language', max: 5 },
  ],
}

const LANG_B_P1 = {
  name: 'Paper 1: writing',
  scale: '1-7',
  criteria: [
    { id: 'A', name: 'Language', max: 12 },
    { id: 'B', name: 'Message', max: 12 },
    { id: 'C', name: 'Conceptual understanding', max: 6 },
  ],
}

const HISTORY_P2 = {
  name: 'Paper 2 essay',
  scale: '1-7',
  criteria: [{ id: 'A', name: 'Essay, marked against the markbands', max: 15 }],
}

const ECON_P1 = {
  name: 'Paper 1 extended response',
  scale: '1-7',
  criteria: [
    { id: 'A', name: 'Part (a)', max: 10 },
    { id: 'B', name: 'Part (b)', max: 15 },
  ],
}

export const KINDS = [
  { key: 'ia', label: 'IA' },
  { key: 'ee', label: 'Extended Essay' },
  { key: 'tok', label: 'TOK essay' },
  { key: 'p1', label: 'Paper 1' },
  { key: 'p2', label: 'Paper 2' },
]

/** Kinds that are exam answers, which need the question they answered. */
export const isPaper = (kind) => kind === 'p1' || kind === 'p2'

const languageA = (s) => /\bA:/.test(s) || /^(English|Arabic|French|Spanish|German|Chinese)\s+A\b/i.test(s)
const languageB = (s) => /\bB\b/.test(s) && !/ab initio/i.test(s) && !languageA(s)

/**
 * The rubric for a piece of work, or null when Syllabi should use the
 * criteria it knows for that subject (and say so).
 */
export function rubricFor(kind, subject = '') {
  if (kind === 'ee') return EE
  if (kind === 'tok') return TOK_ESSAY
  if (kind === 'p1') {
    if (languageA(subject)) return LANG_A_P1
    if (languageB(subject)) return LANG_B_P1
    if (/^Economics/i.test(subject)) return ECON_P1
    return null
  }
  if (kind === 'p2') {
    if (languageA(subject)) return LANG_A_P2
    if (/^History/i.test(subject)) return HISTORY_P2
    return null
  }
  if (/^(Biology|Chemistry|Physics)\b/i.test(subject)) return SCIENCE_IA
  if (/^Math/i.test(subject)) return MATHS_IA
  return null
}

export const total = (criteria) => criteria.reduce((n, c) => n + (c.max || 0), 0)
