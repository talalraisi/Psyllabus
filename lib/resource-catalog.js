/**
 * Curated resource catalog.
 *
 * Every URL here is a real destination page that was checked before it shipped,
 * not a search query. Entries are matched by subject first, then narrowed by
 * topic keywords, so a subtopic under "Calculus" gets calculus links rather than
 * the subject's generic ones.
 *
 * Rules for adding to this file:
 *   1. Link to the publisher. Never mirror, host, or paste their material.
 *   2. Free to open. No entry may sit behind a hard paywall on first click.
 *   3. Verify the URL loads before committing it.
 *
 * IB documents: only pages the IB publishes openly (subject briefs, the DP core
 * pages, "what is the DP") are linked. Syllabus PDFs, past papers, mark schemes
 * and the subject guides are the IB's copyright and are deliberately absent.
 */

/** kind → how the drawer labels and orders it. */
export const KINDS = {
  official: { label: 'Official', rank: 0 },
  lesson: { label: 'Guided lesson', rank: 1 },
  video: { label: 'Video', rank: 2 },
  notes: { label: 'Notes', rank: 3 },
  practice: { label: 'Practice', rank: 4 },
  reference: { label: 'Reference', rank: 5 },
}

const r = (kind, title, provider, url, note) => ({ kind, title, provider, url, note })

/* ------------------------------------------------------------------ *
 * Subject-level catalog. Keys are matched against the subject name.
 * ------------------------------------------------------------------ */

const MATH_COMMON = [
  r('lesson', 'Precalculus course', 'Khan Academy', 'https://www.khanacademy.org/math/precalculus', 'Free lessons with practice sets and instant marking.'),
  r('reference', 'Graphing calculator', 'Desmos', 'https://www.desmos.com/calculator', 'Sketch any function to check your working visually.'),
  r('notes', 'Full worked notes', "Paul's Online Math Notes", 'https://tutorial.math.lamar.edu/', 'University-level notes with every step shown.'),
  r('video', 'IB Maths channel', 'Revision Village', 'https://www.youtube.com/@RevisionVillage', 'Topic walkthroughs mapped to the IB syllabus.'),
  r('official', 'Mathematics subject briefs', 'IB', 'https://www.ibo.org/programmes/diploma-programme/curriculum/mathematics/', 'What the IB says the course covers and how it is assessed.'),
]

const SCIENCE_COMMON = [
  r('practice', 'Interactive simulations', 'PhET (Colorado)', 'https://phet.colorado.edu/', 'Run the experiment yourself instead of imagining it.'),
  r('official', 'Sciences subject briefs', 'IB', 'https://www.ibo.org/programmes/diploma-programme/curriculum/sciences/', 'Course outline and assessment structure, straight from the IB.'),
]

const ESSAY_COMMON = [
  r('reference', 'Citation and essay guide', 'Purdue OWL', 'https://owl.purdue.edu/owl/purdue_owl.html', 'The standard reference for referencing and academic structure.'),
]

const CATALOG = [
  /* ---------------- Mathematics ---------------- */
  {
    subject: /Mathematics: Analysis and Approaches/i,
    items: [
      ...MATH_COMMON,
      r('video', 'Essence of calculus', '3Blue1Brown', 'https://www.youtube.com/@3blue1brown', 'Builds the intuition behind the rules you are asked to apply.'),
    ],
    topics: [
      { match: /number|algebra|sequence|series|proof|complex|binomial/i, items: [
        r('lesson', 'Algebra 2', 'Khan Academy', 'https://www.khanacademy.org/math/algebra2', 'Sequences, series, logarithms and the binomial theorem.'),
      ]},
      { match: /function/i, items: [
        r('lesson', 'Functions and graphs', 'Khan Academy', 'https://www.khanacademy.org/math/precalculus', 'Transformations, rational functions and inverses.'),
      ]},
      { match: /geometry|trigonometr/i, items: [
        r('lesson', 'Trigonometry', 'Khan Academy', 'https://www.khanacademy.org/math/trigonometry', 'Unit circle, identities and triangle problems.'),
      ]},
      { match: /statistic|probabilit/i, items: [
        r('lesson', 'Statistics and probability', 'Khan Academy', 'https://www.khanacademy.org/math/statistics-probability', 'Distributions, regression and conditional probability.'),
        r('lesson', 'Probability', 'Khan Academy', 'https://www.khanacademy.org/math/probability', 'Focused probability drills.'),
      ]},
      { match: /calculus|differentiat|integrat|derivativ/i, items: [
        r('lesson', 'Differential calculus', 'Khan Academy', 'https://www.khanacademy.org/math/differential-calculus', 'Limits, rules of differentiation, applications.'),
        r('lesson', 'Integral calculus', 'Khan Academy', 'https://www.khanacademy.org/math/integral-calculus', 'Techniques of integration and areas under curves.'),
      ]},
    ],
  },
  {
    subject: /Mathematics: Applications and Interpretation/i,
    items: [
      ...MATH_COMMON,
      r('reference', 'Data and charts', 'Our World in Data', 'https://ourworldindata.org/', 'Real datasets to model, which is handy for the IA.'),
    ],
    topics: [
      { match: /statistic|probabilit/i, items: [
        r('lesson', 'Statistics and probability', 'Khan Academy', 'https://www.khanacademy.org/math/statistics-probability', 'Distributions, regression and hypothesis testing.'),
      ]},
      { match: /calculus/i, items: [
        r('lesson', 'Differential calculus', 'Khan Academy', 'https://www.khanacademy.org/math/differential-calculus', 'The calculus AI actually assesses.'),
      ]},
      { match: /geometry|trigonometr/i, items: [
        r('lesson', 'Trigonometry', 'Khan Academy', 'https://www.khanacademy.org/math/trigonometry', 'Non-right triangles, bearings and 3D shapes.'),
      ]},
    ],
  },

  /* ---------------- Sciences ---------------- */
  {
    subject: /Physics/i,
    items: [
      ...SCIENCE_COMMON,
      r('lesson', 'Physics course', 'Khan Academy', 'https://www.khanacademy.org/science/physics', 'Mechanics through to modern physics, with practice.'),
      r('video', 'IB Physics walkthroughs', 'Doner Physics', 'https://www.youtube.com/@DonerPhysics', 'Syllabus-by-syllabus video coverage for IB Physics.'),
      r('reference', 'HyperPhysics concept map', 'Georgia State University', 'https://hyperphysics.gsu.edu/hbase/hframe.html', 'Every formula, linked to the concept it comes from.'),
      r('notes', 'Physics revision notes', 'Physics & Maths Tutor', 'https://www.physicsandmathstutor.com/', 'Condensed notes and question sets by topic.'),
      r('practice', 'Physics problem collections', 'ComPADRE', 'https://www.compadre.org/', 'Open problem banks from physics educators.'),
    ],
  },
  {
    subject: /Chemistry/i,
    items: [
      ...SCIENCE_COMMON,
      r('lesson', 'Chemistry course', 'Khan Academy', 'https://www.khanacademy.org/science/chemistry', 'From atomic structure to equilibrium, with practice.'),
      r('video', 'IB Chemistry playlists', 'Richard Thornley', 'https://www.youtube.com/@RichardThornley', 'The long-standing IB Chemistry video series.'),
      r('notes', 'Chemistry explained', 'ChemGuide', 'https://www.chemguide.co.uk/', 'Clear written explanations of mechanisms and theory.'),
      r('video', 'Organic chemistry drills', 'The Organic Chemistry Tutor', 'https://www.youtube.com/@OrganicChemistryTutor', 'Worked problems, one after another.'),
      r('reference', 'Periodic table and data', 'Royal Society of Chemistry', 'https://www.rsc.org/', 'Reliable data and periodic trends.'),
    ],
  },
  {
    subject: /Biology/i,
    items: [
      ...SCIENCE_COMMON,
      r('lesson', 'Biology course', 'Khan Academy', 'https://www.khanacademy.org/science/biology', 'Cells, genetics, ecology and physiology.'),
      r('notes', 'IB Biology notes', 'BioNinja', 'https://www.bioninja.com.au/', 'Notes written directly against the IB Biology syllabus.'),
      r('video', 'Biology explainers', 'Amoeba Sisters', 'https://www.youtube.com/@AmoebaSisters', 'Short, clear videos on the hard-to-picture processes.'),
      r('video', 'IB Biology walkthroughs', 'Stephanie Castle', 'https://www.youtube.com/@StephanieCastle', 'IB-specific coverage including the IA.'),
      r('practice', 'AP Biology practice', 'Khan Academy', 'https://www.khanacademy.org/science/ap-biology', 'Overlapping content with marked practice questions.'),
    ],
  },
  {
    subject: /Environmental Systems/i,
    items: [
      ...SCIENCE_COMMON,
      r('reference', 'Environmental data', 'Our World in Data', 'https://ourworldindata.org/', 'Charts and datasets for case studies and the IA.'),
      r('notes', 'Geography topic notes', 'Internet Geography', 'https://www.internetgeography.net/topics/', 'Overlaps heavily with the ESS systems topics.'),
    ],
  },
  {
    subject: /Sports, Exercise/i,
    items: [
      ...SCIENCE_COMMON,
      r('lesson', 'Human anatomy and physiology', 'Khan Academy', 'https://www.khanacademy.org/science/ap-biology', 'Systems physiology underpinning the course.'),
    ],
  },
  {
    subject: /Computer Science/i,
    items: [
      r('lesson', 'CS50: Introduction to Computer Science', 'Harvard', 'https://cs50.harvard.edu/x/2025/', 'The best free CS course there is. Free to audit.'),
      r('lesson', 'Computing courses', 'Khan Academy', 'https://www.khanacademy.org/computing', 'Algorithms, data structures and programming basics.'),
      r('video', 'Computer science explainers', 'CrashCourse', 'https://www.youtube.com/@crashcourse', 'Architecture, networks and theory in short episodes.'),
      r('official', 'Sciences subject briefs', 'IB', 'https://www.ibo.org/programmes/diploma-programme/curriculum/sciences/', 'Course outline and assessment structure.'),
    ],
  },

  /* ---------------- Individuals and Societies ---------------- */
  {
    subject: /Economics/i,
    items: [
      r('lesson', 'Economics and finance', 'Khan Academy', 'https://www.khanacademy.org/economics-finance-domain', 'Micro and macro with diagrams and practice.'),
      r('video', 'Exam-technique economics', 'EconplusDal', 'https://www.youtube.com/@EconplusDal', 'Diagram-first videos aimed at written exams.'),
      r('lesson', 'Economics videos and courses', 'Marginal Revolution University', 'https://mru.org/', 'Short university-made videos on every core model.'),
      r('notes', 'Economics revision notes', 'tutor2u', 'https://www.tutor2u.net/economics', 'Topic notes, definitions and evaluation points.'),
      r('reference', 'Real-world data', 'Our World in Data', 'https://ourworldindata.org/', 'Evidence for real-world examples in Paper 1 and 2.'),
      r('notes', 'Model explanations', 'Economics Online', 'https://www.economicsonline.co.uk/', 'Written walkthroughs of each diagram.'),
    ],
  },
  {
    subject: /Business Management/i,
    items: [
      r('notes', 'Business revision notes', 'tutor2u', 'https://www.tutor2u.net/business', 'Topic notes and case studies for every unit.'),
      r('reference', 'Company and market data', 'Our World in Data', 'https://ourworldindata.org/', 'Data for the IA and real-world examples.'),
    ],
  },
  {
    subject: /Psychology/i,
    items: [
      r('notes', 'Psychology topic notes', 'tutor2u', 'https://www.tutor2u.net/psychology', 'Studies, evaluation and exam-ready structure.'),
      r('notes', 'Studies and theories explained', 'Simply Psychology', 'https://www.simplypsychology.org/', 'Named studies written up in usable detail.'),
      r('lesson', 'Behaviour and behavioural science', 'Khan Academy', 'https://www.khanacademy.org/test-prep/mcat/behavior', 'Biological and cognitive foundations.'),
      r('video', 'Psychology series', 'CrashCourse', 'https://www.youtube.com/@crashcourse', 'Fast overviews of each approach.'),
    ],
  },
  {
    subject: /Geography/i,
    items: [
      r('notes', 'Geography topics', 'Internet Geography', 'https://www.internetgeography.net/topics/', 'Case studies and process explanations by topic.'),
      r('notes', 'Geography revision', 'tutor2u', 'https://www.tutor2u.net/geography', 'Notes and exam technique.'),
      r('reference', 'Global datasets', 'Our World in Data', 'https://ourworldindata.org/', 'Population, development and climate data.'),
    ],
  },
  {
    subject: /History/i,
    items: [
      r('lesson', 'World history', 'Khan Academy', 'https://www.khanacademy.org/humanities/world-history', 'Context and causation across the prescribed periods.'),
      r('video', 'World history series', 'CrashCourse', 'https://www.youtube.com/@crashcourse', 'Useful for orientation before you read deeply.'),
      r('reference', 'Academic sources', 'JSTOR', 'https://www.jstor.org/', 'Historiography for Paper 3 and the IA.'),
      ...ESSAY_COMMON,
    ],
  },
  {
    subject: /Global Politics|Philosophy|Anthropology|World Religions|Digital Society/i,
    items: [
      r('reference', 'Academic sources', 'JSTOR', 'https://www.jstor.org/', 'Peer-reviewed material for essays and the IA.'),
      r('reference', 'Scholarly search', 'Google Scholar', 'https://scholar.google.com/', 'Find the paper behind the claim.'),
      ...ESSAY_COMMON,
    ],
  },

  /* ---------------- Languages and Literature ---------------- */
  {
    subject: /Literature|Language and Literature/i,
    items: [
      r('notes', 'Text guides and analysis', 'LitCharts', 'https://www.litcharts.com/', 'Theme, structure and device analysis per text.'),
      ...ESSAY_COMMON,
      r('reference', 'Definitions and terms', 'Oxford Reference', 'https://www.oxfordreference.com/', 'Precise literary terminology.'),
    ],
  },
  {
    subject: /\bB \(SL\/HL\)|ab initio|Classical Languages/i,
    items: [
      r('reference', 'Dictionary and usage', 'Oxford Reference', 'https://www.oxfordreference.com/', 'Check register and idiom before you commit to it.'),
      ...ESSAY_COMMON,
    ],
  },

  /* ---------------- DP core ---------------- */
  {
    subject: /Theory of Knowledge/i,
    items: [
      r('official', 'Theory of Knowledge', 'IB', 'https://www.ibo.org/programmes/diploma-programme/curriculum/dp-core/theory-of-knowledge/', 'What TOK is and how the exhibition and essay are assessed.'),
      r('reference', 'Scholarly search', 'Google Scholar', 'https://scholar.google.com/', 'Real evidence beats invented examples.'),
      ...ESSAY_COMMON,
    ],
  },
  {
    subject: /Extended Essay/i,
    items: [
      r('official', 'Extended Essay', 'IB', 'https://www.ibo.org/programmes/diploma-programme/curriculum/dp-core/extended-essay/', 'Requirements, criteria and the research process.'),
      r('reference', 'Academic sources', 'JSTOR', 'https://www.jstor.org/', 'Where a strong EE gets its sources.'),
      r('reference', 'Scholarly search', 'Google Scholar', 'https://scholar.google.com/', 'Trace citations back to primary research.'),
      ...ESSAY_COMMON,
    ],
  },
  {
    subject: /Creativity/i,
    items: [
      r('official', 'Creativity, Activity, Service', 'IB', 'https://www.ibo.org/programmes/diploma-programme/curriculum/dp-core/creativity-activity-service/', 'The seven learning outcomes and what evidence counts.'),
    ],
  },

  /* ---------------- The Arts ---------------- */
  {
    subject: /Visual Arts|Film|Music|Theatre|Dance/i,
    items: [
      r('reference', 'Terminology and movements', 'Oxford Reference', 'https://www.oxfordreference.com/', 'Get the vocabulary of the form right.'),
      ...ESSAY_COMMON,
    ],
  },
]

/** Every student gets these, whatever they study. */
const UNIVERSAL = [
  r('official', 'DP curriculum overview', 'IB', 'https://www.ibo.org/programmes/diploma-programme/curriculum/', 'The official description of how the Diploma fits together.'),
]

/**
 * Curated resources for a subtopic, most specific first.
 * Topic-matched entries lead, then subject-wide, then universal.
 */
export function curatedFor({ subject = '', topic = '', subtopic = '' }) {
  const entry = CATALOG.find((c) => c.subject.test(subject))
  if (!entry) return []

  const haystack = `${topic} ${subtopic}`
  const topical = (entry.topics || [])
    .filter((t) => t.match.test(haystack))
    .flatMap((t) => t.items)

  const seen = new Set()
  return [...topical, ...entry.items, ...UNIVERSAL].filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

export function hasCurated(subject) {
  return CATALOG.some((c) => c.subject.test(subject))
}
