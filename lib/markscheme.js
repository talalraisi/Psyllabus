/**
 * How much a subject is marked on a scheme rather than on an answer.
 *
 * "More markscheme for humanities, fewer for languages, fewer still for the
 * arts" is the right instinct and it is worth writing down why, because it
 * decides what the generator should produce.
 *
 * A history or economics answer is marked against a list of points: name the
 * factor, explain the mechanism, give the example. That list is knowable in
 * advance, which is what makes a mark scheme useful — a student can check
 * their own answer against it honestly.
 *
 * A language A essay is marked on criteria (understanding, analysis,
 * organisation, language) where the descriptors are about quality, not
 * content. A mark scheme there is a band description, not a checklist, and a
 * generated checklist would be a lie about how the paper is marked.
 *
 * The arts are marked on a portfolio, a performance or an exhibition. There is
 * no written answer to mark at all, so the questions are for recall and
 * understanding, and a mark scheme would be decoration.
 */

export const MARKSCHEME_STYLE = {
  /** A list of marking points. The student can tick them off. */
  points: 'points',
  /** Criteria bands, quoted rather than itemised. */
  criteria: 'criteria',
  /** No mark scheme: right or wrong, with an explanation. */
  none: 'none',
}

const HUMANITIES =
  /History|Geography|Economics|Business|Global Politics|Psychology|Anthropology|Digital Society|Philosophy|Religions|Environmental/i
const SCIENCES = /Physics|Chemistry|Biology|Computer Science|Sports|Design Technology|Mathematics|Math /i
const LANGUAGE_A = /Language & Literature|Language and literature|: Literature|Literature and Performance/i
const LANGUAGE_B = / B (SL|HL)| ab initio|Classical Languages/i
const ARTS = /Visual Arts|Music|Theatre|Dance|Film/i

/**
 * How written answers in this subject should be marked, and how much of the
 * paper should be written rather than multiple choice.
 *
 * `written` is a target share, used by the generator when it decides the mix.
 */
export function markschemeProfile(subject = '') {
  if (HUMANITIES.test(subject)) {
    return { style: MARKSCHEME_STYLE.points, written: 0.6, maxMarks: 8 }
  }
  if (SCIENCES.test(subject)) {
    return { style: MARKSCHEME_STYLE.points, written: 0.4, maxMarks: 4 }
  }
  if (LANGUAGE_A.test(subject)) {
    return { style: MARKSCHEME_STYLE.criteria, written: 0.3, maxMarks: 3 }
  }
  if (LANGUAGE_B.test(subject)) {
    return { style: MARKSCHEME_STYLE.criteria, written: 0.25, maxMarks: 3 }
  }
  if (ARTS.test(subject)) {
    return { style: MARKSCHEME_STYLE.none, written: 0.15, maxMarks: 2 }
  }
  return { style: MARKSCHEME_STYLE.points, written: 0.35, maxMarks: 4 }
}

/** Total marks a scheme accounts for, for checking it against the question. */
export function marksInScheme(markscheme) {
  if (!markscheme?.points?.length) return 0
  return markscheme.points.reduce((sum, p) => sum + (Number(p.marks) || 0), 0)
}

/**
 * Is this mark scheme worth showing?
 *
 * One point worth one mark on a one-mark question tells a student nothing they
 * did not just read in the explanation.
 */
export function isUsefulScheme(markscheme, marks = 1) {
  if (!markscheme?.points?.length) return false
  if (markscheme.points.length < 2 && marks < 3) return false
  return true
}
