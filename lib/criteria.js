/**
 * The marking criteria Syllabi reads a draft against.
 *
 * Written out here for the pieces where the criteria are fixed and known, so
 * the marks add up to the real total and the names match the subject guide.
 * For anything else Syllabi works from the criteria as it knows them, and the
 * page says so: a student should check those against their own guide.
 *
 * If the IB changes a guide, this is the one place to change.
 *
 * Each rubric also names:
 *   key        its section in marking_rubrics: the full band descriptors and
 *              clarifications, cut from the guide by scripts/marking-rubrics.mjs
 *              and read only by the server (the guide text is never in this
 *              repository)
 *   component  its row in lib/grade-boundaries.json, so the grade comes from
 *              the total and the real boundaries rather than a guess
 */

const SCIENCE_IA = {
  name: 'Scientific investigation',
  component: 'Internal Assessment',
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
  component: 'Internal Assessment',
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
  key: 'ee',
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
  key: 'tok-essay',
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
  component: 'Paper 1',
  criteria: [
    { id: 'A', name: 'Understanding and interpretation', max: 5 },
    { id: 'B', name: 'Analysis and evaluation', max: 5 },
    { id: 'C', name: 'Focus and organization', max: 5 },
    { id: 'D', name: 'Language', max: 5 },
  ],
}

// The 2026 guide: B is two halves of five, textual features and comparison.
const LANG_A_P2 = {
  name: 'Paper 2: comparative essay',
  scale: '1-7',
  component: 'Paper 2',
  criteria: [
    { id: 'A', name: 'Knowledge, understanding and interpretation', max: 5 },
    { id: 'B', name: 'Analysis and evaluation (B1 textual features, B2 comparison)', max: 10 },
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

const LANG_A_ESSAY = {
  name: 'Higher level essay',
  scale: '1-7',
  component: 'Essay',
  criteria: [
    { id: 'A', name: 'Knowledge, understanding and interpretation', max: 5 },
    { id: 'B', name: 'Analysis and evaluation', max: 5 },
    { id: 'C', name: 'Focus, organization and development', max: 5 },
    { id: 'D', name: 'Language', max: 5 },
  ],
}

// One commentary of the three in the portfolio; criterion F (rubric
// requirements) is for the portfolio as a whole, so it is left out here.
const ECON_IA = {
  key: 'econ-ia',
  name: 'Economics commentary',
  scale: '1-7',
  component: 'Internal Assessment',
  portfolio: { pieces: 3, extra: 3 },
  criteria: [
    { id: 'A', name: 'Diagrams', max: 3 },
    { id: 'B', name: 'Terminology', max: 2 },
    { id: 'C', name: 'Application and analysis', max: 3 },
    { id: 'D', name: 'Key concept', max: 3 },
    { id: 'E', name: 'Evaluation', max: 3 },
  ],
}

const BUSINESS_IA = {
  key: 'business-ia',
  name: 'Business research project',
  scale: '1-7',
  component: 'Internal Assessment',
  criteria: [
    { id: 'A', name: 'Integration of a key concept', max: 5 },
    { id: 'B', name: 'Supporting documents', max: 4 },
    { id: 'C', name: 'Selection and application of tools and theories', max: 4 },
    { id: 'D', name: 'Analysis and evaluation', max: 5 },
    { id: 'E', name: 'Conclusions', max: 3 },
    { id: 'F', name: 'Structure', max: 2 },
    { id: 'G', name: 'Presentation', max: 2 },
  ],
}

const GEOGRAPHY_IA = {
  key: 'geography-ia',
  name: 'Fieldwork investigation',
  scale: '1-7',
  component: 'Internal Assessment',
  criteria: [
    { id: 'A', name: 'Fieldwork question and geographic context', max: 3 },
    { id: 'B', name: 'Method(s) of investigation', max: 3 },
    { id: 'C', name: 'Quality and treatment of information collected', max: 6 },
    { id: 'D', name: 'Written analysis', max: 8 },
    { id: 'E', name: 'Conclusion', max: 2 },
    { id: 'F', name: 'Evaluation', max: 3 },
  ],
}

const HISTORY_IA = {
  key: 'history-ia',
  name: 'Historical investigation',
  scale: '1-7',
  component: 'Internal Assessment',
  criteria: [
    { id: 'A', name: 'Historical inquiry question', max: 6 },
    { id: 'B', name: 'Sources and perspectives', max: 6 },
    { id: 'C', name: 'Synthesis and evaluation', max: 12 },
  ],
}

const PSYCHOLOGY_IA = {
  key: 'psychology-ia',
  name: 'Psychology research investigation',
  scale: '1-7',
  component: 'Internal Assessment',
  criteria: [
    { id: 'A', name: 'Introduction', max: 6 },
    { id: 'B', name: 'Research methodology', max: 6 },
    { id: 'C', name: 'Data collection', max: 6 },
    { id: 'D', name: 'Discussion', max: 6 },
  ],
}

const CS_IA = {
  key: 'cs-ia',
  name: 'Computational solution',
  scale: '1-7',
  component: 'Solution',
  criteria: [
    { id: 'A', name: 'Problem specification', max: 4 },
    { id: 'B', name: 'Planning', max: 4 },
    { id: 'C', name: 'System overview', max: 6 },
    { id: 'D', name: 'Development', max: 12 },
    { id: 'E', name: 'Evaluation', max: 4 },
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
  const course = /\bLiterature\b/.test(subject) && !/Language & Literature/.test(subject) ? 'lit' : 'langlit'
  const hl = /\bHL$/.test(subject)
  if (kind === 'p1') {
    if (languageA(subject)) return { ...LANG_A_P1, key: `${course}-p1-${hl ? 'hl' : 'sl'}` }
    if (languageB(subject)) return LANG_B_P1
    if (/^Economics/i.test(subject)) return ECON_P1
    return null
  }
  if (kind === 'p2') {
    if (languageA(subject)) return { ...LANG_A_P2, key: `${course}-p2` }
    if (/^History/i.test(subject)) return HISTORY_P2
    return null
  }
  // Coursework. For Language A that is the HL essay, the written piece.
  if (languageA(subject)) return { ...LANG_A_ESSAY, key: `${course}-hl-essay` }
  const science = subject.match(/^(Biology|Chemistry|Physics)\b/i)
  if (science) return { ...SCIENCE_IA, key: `science-ia:${science[1][0].toUpperCase()}${science[1].slice(1).toLowerCase()}` }
  if (/^Math/i.test(subject)) return { ...MATHS_IA, key: /Applications/i.test(subject) ? 'maths-ia:AI' : 'maths-ia:AA' }
  if (/^Economics/i.test(subject)) return ECON_IA
  if (/^Business/i.test(subject)) return BUSINESS_IA
  if (/^Geography/i.test(subject)) return GEOGRAPHY_IA
  if (/^History/i.test(subject)) return HISTORY_IA
  if (/^Psychology/i.test(subject)) return PSYCHOLOGY_IA
  if (/^Computer Science/i.test(subject)) return CS_IA
  return null
}

export const total = (criteria) => criteria.reduce((n, c) => n + (c.max || 0), 0)
