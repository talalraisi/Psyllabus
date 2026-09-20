/**
 * A course, and the level you take it at.
 *
 * The subject list is stored as one string per course-and-level — "Biology
 * HL", "Biology SL" — because that is what a syllabus is filed under. The
 * picker asks for them in the order a student actually knows them: which
 * course, then which level. So it needs them apart.
 */

/** "Biology HL" -> { base: 'Biology', level: 'HL' }. No level -> level null. */
export function splitLevel(name) {
  const m = String(name).match(/^(.*?)\s+(SL|HL)$/)
  return m ? { base: m[1], level: m[2] } : { base: name, level: null }
}

/**
 * The courses in a list, each with whichever levels it is offered at.
 *
 * Order is the order they were given in, so a group that was arranged by
 * hand stays arranged. A course offered at one level only — most of AP and
 * A-Level, and the Diploma core — comes back with `only` set and no levels,
 * and is offered as a single choice rather than a question with one answer.
 */
export function coursesOf(subjects) {
  const out = []
  const byBase = new Map()
  for (const full of subjects || []) {
    const { base, level } = splitLevel(full)
    if (!byBase.has(base)) {
      const entry = { base, levels: {}, only: null }
      byBase.set(base, entry)
      out.push(entry)
    }
    const entry = byBase.get(base)
    if (level) entry.levels[level] = full
    else entry.only = full
  }
  return out
}

/**
 * What to file somebody under when they do not know their level yet.
 *
 * SL, where there is a choice. HL contains SL, so guessing low can only ever
 * show them less than they take — guessing high would show them content that
 * is not on their course and mark them down for not knowing it.
 */
export function defaultLevel(course) {
  if (course.only) return course.only
  return course.levels.SL || course.levels.HL || null
}
