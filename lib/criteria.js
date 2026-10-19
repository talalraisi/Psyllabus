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

export const KINDS = [
  { key: 'ia', label: 'IA' },
  { key: 'ee', label: 'Extended Essay' },
  { key: 'tok', label: 'TOK essay' },
]

/**
 * The rubric for a piece of work, or null when Syllabi should use the
 * criteria it knows for that subject (and say so).
 */
export function rubricFor(kind, subject = '') {
  if (kind === 'ee') return EE
  if (kind === 'tok') return TOK_ESSAY
  if (/^(Biology|Chemistry|Physics)\b/i.test(subject)) return SCIENCE_IA
  if (/^Math/i.test(subject)) return MATHS_IA
  return null
}

export const total = (criteria) => criteria.reduce((n, c) => n + (c.max || 0), 0)
