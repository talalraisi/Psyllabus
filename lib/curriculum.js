/**
 * What a grade means, per curriculum.
 *
 * The prediction engine was written for the IB and had its rules baked in: a
 * 1 to 7 scale, a total out of 45, and a bonus from Theory of Knowledge and the
 * Extended Essay. An A-Level student saw a score out of 45 they can never get,
 * and an AP student was told about a core they do not have.
 *
 * Everything curriculum-specific now lives here, so a page asks what applies
 * rather than assuming the IB.
 */

export const CURRICULA = {
  IB: {
    id: 'IB',
    label: 'IB Diploma',
    // Best first: index 0 is the top grade.
    grades: ['7', '6', '5', '4', '3', '2', '1'],
    gradeLabel: 'grade',
    subjectCount: 6,
    // The Diploma is scored as a total, so a headline number makes sense.
    hasTotal: true,
    maxSubjectPoints: 42,
    maxTotal: 45,
    hasCore: true,
    coreComponents: ['Theory of Knowledge', 'Extended Essay'],
    coreGrades: ['A', 'B', 'C', 'D', 'E'],
    realismNote:
      'Keep it realistic. A row of 7s makes your predicted grade look permanently far off and the gap stops telling you anything. Aim a grade above where you are now, not five.',
  },

  'A-Level': {
    id: 'A-Level',
    label: 'A-Levels',
    grades: ['A*', 'A', 'B', 'C', 'D', 'E'],
    gradeLabel: 'grade',
    subjectCount: 3,
    // A-Levels are not added up. Universities read them as a set, so a total
    // out of anything would be a number nobody uses.
    hasTotal: false,
    hasCore: false,
    realismNote:
      'Keep it realistic. A*A*A* for everything makes the gap meaningless. Aim one grade above where you are now, and raise it when you get there.',
  },

  AP: {
    id: 'AP',
    label: 'AP',
    grades: ['5', '4', '3', '2', '1'],
    gradeLabel: 'score',
    subjectCount: 4,
    // Each AP exam stands alone, so there is no combined score either.
    hasTotal: false,
    hasCore: false,
    realismNote:
      'Keep it realistic. Setting a 5 on everything makes the gap meaningless. Most universities want a 4 or 5 on the subjects that matter for your course, so aim where it counts.',
  },
}

export function curriculumOf(profile) {
  return CURRICULA[profile?.curriculum] || CURRICULA.IB
}

/** Best grade first, so index 0 is the top. */
export function gradesFor(profile) {
  return curriculumOf(profile).grades
}

/**
 * A grade as a position on its scale, 1 for the top down to 0 for the bottom.
 * Lets one piece of code compare an A* and a 7 without knowing which is which.
 */
export function gradeToFraction(curriculum, grade) {
  const scale = (CURRICULA[curriculum] || CURRICULA.IB).grades
  const i = scale.indexOf(String(grade))
  if (i === -1) return null
  return scale.length === 1 ? 1 : (scale.length - 1 - i) / (scale.length - 1)
}

/** The reverse: a mastery fraction to the nearest grade on the scale. */
export function fractionToGrade(curriculum, fraction) {
  const scale = (CURRICULA[curriculum] || CURRICULA.IB).grades
  const f = Math.max(0, Math.min(1, fraction))
  const i = Math.round((1 - f) * (scale.length - 1))
  return scale[i]
}

export function hasCore(profile) {
  return curriculumOf(profile).hasCore
}

export function hasTotal(profile) {
  return curriculumOf(profile).hasTotal
}

export function realismNote(profile) {
  return curriculumOf(profile).realismNote
}
