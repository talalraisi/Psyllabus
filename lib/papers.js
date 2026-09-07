/**
 * Exam papers.
 *
 * A real subject is not examined as one undifferentiated pile of questions. It
 * is examined as two or three papers, each with its own shape: Paper 1 is
 * multiple choice, Paper 2 is written, Paper 3 only exists at HL. Practising
 * "20 mixed questions" is not practising for any of them.
 *
 * These definitions describe the shape of the real thing: how long it runs,
 * what kind of questions it holds, and which half of the course it draws from.
 * The paper a student actually sits here is assembled from the question bank
 * against that shape, and the app says plainly when the bank cannot fill it
 * rather than quietly serving a short paper and calling it Paper 1.
 *
 * ---------------------------------------------------------------------------
 * A warning worth keeping at the top of this file: the IB changed the science
 * subjects for first exams in 2025, and Paper 3 no longer exists for Biology,
 * Chemistry and Physics. Exam structures move. Anything here should be checked
 * against the current subject guide before it is trusted, and durations that
 * were not certain enough to state are left null on purpose: a paper with no
 * duration is timed from the questions it actually contains, which cannot be
 * wrong even when the guide changes.
 * ---------------------------------------------------------------------------
 */

/**
 * style   which question types the paper draws from
 * scope   'all' the whole course, 'hl' only the HL extension
 * minutes the real paper's duration, or null to time it from the questions
 */
const IB_SCIENCE = (hl) => [
  {
    id: 'p1',
    name: 'Paper 1',
    blurb: 'Multiple choice and data-based questions. No notes.',
    style: 'mcq',
    scope: 'all',
    minutes: hl ? 120 : 90,
    target: hl ? 40 : 30,
  },
  {
    id: 'p2',
    name: 'Paper 2',
    blurb: 'Short answer and extended response across the whole course.',
    style: 'written',
    scope: 'all',
    minutes: hl ? 150 : 90,
    target: hl ? 30 : 20,
  },
]

const IB_MATHS = (hl, calculatorFree) => {
  const papers = [
    {
      id: 'p1',
      name: 'Paper 1',
      blurb: calculatorFree
        ? 'No calculator. Short and extended response.'
        : 'Calculator allowed. Short and extended response.',
      style: 'mixed',
      scope: 'all',
      minutes: hl ? 120 : 90,
      target: hl ? 30 : 22,
    },
    {
      id: 'p2',
      name: 'Paper 2',
      blurb: 'Calculator allowed. Short and extended response.',
      style: 'mixed',
      scope: 'all',
      minutes: hl ? 120 : 90,
      target: hl ? 30 : 22,
    },
  ]
  if (hl) {
    papers.push({
      id: 'p3',
      name: 'Paper 3',
      blurb: 'Two long problem-solving questions. Higher level only.',
      style: 'written',
      scope: 'hl',
      minutes: 60,
      target: 12,
    })
  }
  return papers
}

/**
 * Subjects whose Paper 1 is multiple choice and which still have a Paper 3 at
 * HL. Durations differ enough between them to be left to the questions.
 */
const IB_APPLIED_SCIENCE = (hl) => {
  const papers = [
    {
      id: 'p1',
      name: 'Paper 1',
      blurb: 'Multiple choice across the core.',
      style: 'mcq',
      scope: 'all',
      minutes: null,
      target: hl ? 40 : 30,
    },
    {
      id: 'p2',
      name: 'Paper 2',
      blurb: 'Short answer and extended response.',
      style: 'written',
      scope: 'all',
      minutes: null,
      target: 20,
    },
  ]
  if (hl) {
    papers.push({
      id: 'p3',
      name: 'Paper 3',
      blurb: 'Higher level extension only.',
      style: 'written',
      scope: 'hl',
      minutes: null,
      target: 12,
    })
  }
  return papers
}

const IB_LANGUAGE_A = (hl) => [
  {
    id: 'p1',
    name: 'Paper 1',
    blurb: 'Guided analysis of unseen texts.',
    style: 'written',
    scope: 'all',
    minutes: hl ? 135 : 75,
    target: 12,
  },
  {
    id: 'p2',
    name: 'Paper 2',
    blurb: 'Comparative essay on the works you have studied.',
    style: 'written',
    scope: 'all',
    minutes: 105,
    target: 10,
  },
]

const IB_LANGUAGE_B = () => [
  {
    id: 'p1',
    name: 'Paper 1',
    blurb: 'Productive writing: one task from a choice of three.',
    style: 'written',
    scope: 'all',
    minutes: null,
    target: 10,
  },
  {
    id: 'p2',
    name: 'Paper 2',
    blurb: 'Receptive skills: listening and reading comprehension.',
    style: 'mixed',
    scope: 'all',
    minutes: null,
    target: 25,
  },
]

/**
 * Group 3 durations differ subject by subject, so they are derived from the
 * questions rather than asserted. The shape, which does not differ, is stated.
 */
const IB_HUMANITIES = (hl) => {
  const papers = [
    {
      id: 'p1',
      name: 'Paper 1',
      blurb: 'Source or stimulus based questions.',
      style: 'written',
      scope: 'all',
      minutes: null,
      target: 15,
    },
    {
      id: 'p2',
      name: 'Paper 2',
      blurb: 'Essay questions across the core.',
      style: 'written',
      scope: 'all',
      minutes: null,
      target: 12,
    },
  ]
  if (hl) {
    papers.push({
      id: 'p3',
      name: 'Paper 3',
      blurb: 'Higher level extension only.',
      style: 'written',
      scope: 'hl',
      minutes: null,
      target: 12,
    })
  }
  return papers
}

/** Subjects with no written paper at all. Saying so beats offering a fake one. */
const COURSEWORK_ONLY = [
  'Visual Arts',
  'Music',
  'Theatre',
  'Dance',
  'Film',
  'Literature and Performance',
]

// Biology, Chemistry and Physics share the 2025 two-paper structure. The other
// group 4 subjects do not, so they are not lumped in with them.
const IB_SCIENCES = ['Biology', 'Chemistry', 'Physics']

const IB_APPLIED_SCIENCES = [
  'Sports, Exercise and Health Science',
  'Sports, Exercise, and Health Science',
  'Design Technology',
]

const IB_HUMANITIES_SUBJECTS = [
  'Business Management',
  'Digital Society',
  'Economics',
  'Geography',
  'Global Politics',
  'History',
  'Philosophy',
  'Psychology',
  'Social and Cultural Anthropology',
  'World Religions',
]

/** "Biology HL" → { base: 'Biology', hl: true } */
export function splitLevel(subject = '') {
  const m = /^(.*?)\s+(HL|SL)$/.exec(subject.trim())
  if (!m) return { base: subject.trim(), hl: false, level: null }
  return { base: m[1], hl: m[2] === 'HL', level: m[2] }
}

/**
 * The papers a subject is examined by. Empty when the subject has none, which
 * is a real answer rather than a gap.
 */
export function papersFor(subject, curriculum = 'IB') {
  const { base, hl } = splitLevel(subject)

  if (COURSEWORK_ONLY.some((s) => base.startsWith(s))) return []

  if (curriculum === 'AP') {
    return [
      {
        id: 'p1',
        name: 'Section I',
        blurb: 'Multiple choice.',
        style: 'mcq',
        scope: 'all',
        minutes: null,
        target: 40,
      },
      {
        id: 'p2',
        name: 'Section II',
        blurb: 'Free response.',
        style: 'written',
        scope: 'all',
        minutes: null,
        target: 8,
      },
    ]
  }

  if (curriculum === 'A-Level') {
    return [1, 2, 3].map((n) => ({
      id: `p${n}`,
      name: `Paper ${n}`,
      blurb: 'Full-length paper drawn from the whole specification.',
      style: 'mixed',
      scope: 'all',
      minutes: null,
      target: 25,
    }))
  }

  // IB
  if (/^Mathematics/.test(base)) {
    return IB_MATHS(hl, /Analysis and Approaches/.test(base))
  }
  if (IB_SCIENCES.some((s) => base.startsWith(s))) return IB_SCIENCE(hl)
  if (IB_APPLIED_SCIENCES.some((s) => base.startsWith(s))) return IB_APPLIED_SCIENCE(hl)
  // Computer Science and ESS are written throughout, with no multiple choice
  // paper, so the humanities shape is the closer fit than the science one.
  if (base.startsWith('Computer Science')) return IB_HUMANITIES(hl)
  if (base.startsWith('Environmental Systems')) {
    return IB_HUMANITIES(false) // ESS has two papers at both levels
  }
  if (/^[A-Za-z]+ A:/.test(base)) return IB_LANGUAGE_A(hl)
  if (/\bB$/.test(base) || /ab initio/.test(base) || /^Classical Languages/.test(base)) {
    return IB_LANGUAGE_B(hl)
  }
  if (IB_HUMANITIES_SUBJECTS.some((s) => base.startsWith(s))) return IB_HUMANITIES(hl)

  return IB_HUMANITIES(hl)
}

export function paperById(subject, curriculum, id) {
  return papersFor(subject, curriculum).find((p) => p.id === id) || null
}

/** Which question types a paper style will accept. */
export function typesForStyle(style) {
  if (style === 'mcq') return ['mcq']
  if (style === 'written') return ['short_answer', 'long_answer', 'paragraph']
  return null // mixed: everything
}
