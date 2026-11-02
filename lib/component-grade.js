import BOUNDARIES from './grade-boundaries.js'

/**
 * A grade from marks, through the IB's own boundaries, instead of a model's
 * guess at one.
 *
 * The total is scaled to the boundary table's maximum where the two differ:
 * one Economics commentary of the three, one Paper 1 HL analysis of the two,
 * a 2027 EE (out of 30) against the last published boundaries (out of 34), a
 * TOK essay (10) against the TOK total (30, of which the essay is two thirds),
 * an IA whose new guide changed the total before new boundaries exist.
 *
 * Returns { grade, outOf, scaled, session } or null when there is no table.
 */

const LETTERS = ['A', 'B', 'C', 'D', 'E']

const baseOf = (subject = '') => subject.replace(/\s+(HL|SL)$/, '').trim()
const levelOf = (subject = '') => (subject.match(/\b(HL|SL)$/) || [])[1] || 'SL'

/** The boundary table for a subject, falling back from a Language A we have no table for to English A of the same course. */
function tableFor(subject) {
  const base = baseOf(subject)
  const bySubject = BOUNDARIES.subjects[base] || (/ A: /.test(base) ? BOUNDARIES.subjects[base.replace(/^\w+ A:/, 'English A:')] : null)
  if (!bySubject) return null
  return bySubject[levelOf(subject)] || bySubject.SL || bySubject.HL || null
}

export function componentGrade({ kind, subject, rubric, total }) {
  if (!rubric || typeof total !== 'number') return null
  const max = rubric.criteria.reduce((n, c) => n + c.max, 0)
  if (!max) return null

  if (kind === 'ee' || kind === 'tok') {
    const core = BOUNDARIES.core[kind === 'ee' ? 'Extended Essay' : 'Theory of Knowledge']
    const scaled = (total / max) * core.max
    const grade = LETTERS.find((l) => scaled >= core.mins[l]) || 'E'
    return { grade, outOf: core.max, scaled: Math.round(scaled * 10) / 10, session: core.session }
  }

  const table = tableFor(subject)
  const row = table && rubric.component && table[rubric.component]
  if (!row) return null
  const scaled = (total / max) * row.max
  let grade = 1
  row.mins.forEach((min, i) => {
    if (Math.round(scaled) >= min) grade = i + 1
  })
  return { grade: String(grade), outOf: row.max, scaled: Math.round(scaled * 10) / 10, session: BOUNDARIES.session }
}
