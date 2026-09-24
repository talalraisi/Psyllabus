/**
 * Every course the app knows about, per curriculum.
 *
 * This lived inside the onboarding page as a local const, which meant the one
 * authoritative list of what is covered was only readable by the screen that
 * asks you to pick from it. Anything else that wanted to say what is in here —
 * a subjects page, a count on the front page — had to write the number down by
 * hand and hope it stayed true.
 *
 * It is a module now, and the counts are derived from it rather than typed.
 */

import { IB_CORE_SUBJECTS } from './ib-points.js'

export const CURRICULUMS = {
  'IB': {
    groups: [
      {
        name: 'Group 1: Language A',
        required: 1,
        subjects: [
          'English A: Literature HL', 'English A: Literature SL',
          'English A: Language & Literature HL', 'English A: Language & Literature SL',
          'Arabic A: Literature HL', 'Arabic A: Literature SL',
          'French A: Literature HL', 'French A: Literature SL',
          'Spanish A: Literature HL', 'Spanish A: Literature SL',
        
          'Arabic A: Language & Literature HL',
          'Arabic A: Language & Literature SL',
          'French A: Language & Literature HL',
          'French A: Language & Literature SL',
          'Mandarin A: Language & Literature HL',
          'Mandarin A: Language & Literature SL',
          'Spanish A: Language & Literature HL',
          'Spanish A: Language & Literature SL',
          'Literature and Performance SL',
        ]
      },
      {
        name: 'Group 2: Language Acquisition',
        required: 1,
        subjects: [
          'English B HL', 'English B SL',
          'Arabic B HL', 'Arabic B SL',
          'French B HL', 'French B SL',
          'Spanish B HL', 'Spanish B SL',
          'English ab initio SL', 'French ab initio SL', 'Spanish ab initio SL',
        
          'Mandarin B HL',
          'Mandarin B SL',
          'Arabic ab initio SL',
          'Mandarin ab initio SL',
          'Classical Languages: Latin HL',
          'Classical Languages: Latin SL',
          'Classical Languages: Classical Greek HL',
          'Classical Languages: Classical Greek SL',
        ]
      },
      {
        name: 'Group 3: Individuals & Societies',
        required: 1,
        subjects: [
          'Economics HL', 'Economics SL',
          'History HL', 'History SL',
          'Geography HL', 'Geography SL',
          'Psychology HL', 'Psychology SL',
          'Business Management HL', 'Business Management SL',
          'Global Politics HL', 'Global Politics SL',
          'Philosophy HL', 'Philosophy SL',
          'Digital Society HL', 'Digital Society SL',
        
          'Social and Cultural Anthropology HL',
          'Social and Cultural Anthropology SL',
          'World Religions SL',
        ]
      },
      {
        name: 'Group 4: Sciences',
        required: 1,
        subjects: [
          'Biology HL', 'Biology SL',
          'Chemistry HL', 'Chemistry SL',
          'Physics HL', 'Physics SL',
          'Computer Science HL', 'Computer Science SL',
          'Design Technology HL', 'Design Technology SL',
          // One spelling each. The ampersand versions were still listed
          // beside these after the remap, so the group offered the same two
          // courses twice and which one a student clicked decided which of
          // two identical syllabuses their work was filed under.
          'Environmental Systems and Societies HL',
          'Environmental Systems and Societies SL',
          'Sports, Exercise, and Health Science HL',
          'Sports, Exercise, and Health Science SL',
        ]
      },
      {
        name: 'Group 5: Mathematics',
        required: 1,
        subjects: [
          'Math Analysis & Approaches HL',
          'Math Analysis & Approaches SL',
          'Math Applications & Interpretation HL',
          'Math Applications & Interpretation SL',
        ]
      },
      {
        name: 'Group 6: The Arts',
        required: 0,
        subjects: [
          'Visual Arts HL', 'Visual Arts SL',
          'Music HL', 'Music SL',
          'Theatre HL', 'Theatre SL',
          'Film HL', 'Film SL',
          'Dance HL', 'Dance SL',
        ]
      },
    ],
    grades: ['1','2','3','4','5','6','7'],
    maxSubjects: 6,
    // Added automatically for every IB student; never chosen from the groups.
    core: IB_CORE_SUBJECTS,
  },
  'AP': {
    groups: [
      {
        name: 'Math & Computer Science',
        required: 0,
        subjects: [
          'AP Calculus AB', 'AP Calculus BC', 'AP Precalculus',
          'AP Statistics', 'AP Computer Science A', 'AP Computer Science Principles',
        ]
      },
      {
        name: 'Sciences',
        required: 0,
        subjects: [
          'AP Biology', 'AP Chemistry', 'AP Physics 1: Algebra-Based',
          'AP Physics 2: Algebra-Based', 'AP Physics C: Mechanics',
          'AP Physics C: Electricity and Magnetism', 'AP Environmental Science',
        ]
      },
      {
        name: 'History & Social Sciences',
        required: 0,
        subjects: [
          'AP World History: Modern', 'AP United States History', 'AP European History',
          'AP United States Government and Politics', 'AP Comparative Government and Politics',
          'AP Macroeconomics', 'AP Microeconomics',
          'AP Psychology', 'AP Human Geography', 'AP African American Studies',
        ]
      },
      {
        name: 'English',
        required: 0,
        subjects: [
          'AP English Language and Composition',
          'AP English Literature and Composition',
        ]
      },
      {
        name: 'World Languages',
        required: 0,
        subjects: [
          'AP Spanish Language and Culture',
          'AP French Language and Culture',
          'AP Chinese Language and Culture',
          'AP German Language and Culture', 'AP Italian Language and Culture',
          'AP Japanese Language and Culture',
        ]
      },
      {
        name: 'Arts',
        required: 0,
        subjects: [
          'AP Art History', 'AP Music Theory',
          'AP 2-D Art and Design', 'AP 3-D Art and Design', 'AP Drawing',
        ]
      },
      {
        name: 'AP Capstone',
        required: 0,
        subjects: ['AP Seminar', 'AP Research']
      }
    ],
    grades: ['1','2','3','4','5'],
    maxSubjects: 10
  },
  'A-Level': {
    groups: [
      {
        name: 'Mathematics & Computer Science',
        required: 0,
        subjects: [
          'Mathematics', 'Further Mathematics', 'Statistics',
          'Computer Science', 'Information Technology (IT) / Applied ICT',
        ]
      },
      {
        name: 'Sciences',
        required: 0,
        subjects: [
          'Biology', 'Chemistry', 'Physics', 'Psychology',
          'Environmental Science / Environmental Management', 'Geology', 'Marine Science',
        ]
      },
      {
        name: 'Humanities & Social Sciences',
        required: 0,
        subjects: [
          'History', 'Geography', 'Economics',
          'Politics / Government and Politics', 'Sociology', 'Philosophy',
          'Law', 'Ancient History', 'Classical Civilisation / Classical Studies',
          'Religious Studies / Divinity',
        ]
      },
      {
        name: 'English',
        required: 0,
        subjects: [
          'English Language', 'English Literature',
          'English Language and Literature',
        ]
      },
      {
        name: 'Business & Technical',
        required: 0,
        subjects: [
          'Business Studies', 'Accounting',
          'Design and Technology (D&T)', 'Electronics',
          'Food Science and Nutrition', 'Travel and Tourism',
        ]
      },
      {
        name: 'Creative & Performing Arts',
        required: 0,
        subjects: [
          'Art and Design (Fine Art, Graphics, Photography, Textiles, 3D Design)', 'Drama and Theatre Studies',
          'Music', 'Music Technology', 'Film Studies',
          'Media Studies', 'Dance', 'Physical Education (PE) / Sports Science',
        ]
      },
      {
        name: 'Languages',
        required: 0,
        subjects: [
          'Spanish', 'French', 'German',
          'Chinese / Mandarin', 'Arabic',
        ]
      }
    ],
    grades: ['A*','A','B','C','D','E'],
    maxSubjects: 4
  }
}

/**
 * Courses rather than entries.
 *
 * The list holds one entry per level, so Physics HL and Physics SL are two
 * lines. A student choosing subjects wants to see both; somebody asking
 * whether their course is covered is asking about Physics. Stripping the
 * trailing level and de-duplicating gives the second number, which is the one
 * worth printing.
 */
export function coursesIn(curriculum) {
  const groups = CURRICULUMS[curriculum]?.groups || []
  const seen = new Set()
  for (const g of groups) {
    for (const name of g.subjects) seen.add(name.replace(/\s+(HL|SL)$/, '').trim())
  }
  return seen.size
}

/** Every entry, levels included. */
export function entriesIn(curriculum) {
  return (CURRICULUMS[curriculum]?.groups || []).reduce((n, g) => n + g.subjects.length, 0)
}

/** The groups, each with its courses collapsed to one line per course and the
 *  levels that course is offered at. */
export function groupsOf(curriculum) {
  return (CURRICULUMS[curriculum]?.groups || []).map((g) => {
    const byCourse = new Map()
    for (const name of g.subjects) {
      const m = /^(.*?)\s+(HL|SL)$/.exec(name)
      const course = m ? m[1].trim() : name
      const level = m ? m[2] : null
      if (!byCourse.has(course)) byCourse.set(course, new Set())
      if (level) byCourse.get(course).add(level)
    }
    return {
      name: g.name,
      required: g.required,
      courses: [...byCourse].map(([course, levels]) => ({
        course,
        levels: ['HL', 'SL'].filter((l) => levels.has(l)),
      })),
    }
  })
}
