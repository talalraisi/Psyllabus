/**
 * Multi-Resource Hub: six categories for every subtopic, so no subtopic is ever
 * a dead end.
 *
 * These resolve to tightly-scoped searches on high-yield platforms rather than
 * hand-picked URLs. That is deliberate: it covers all 2,590 subtopics on day
 * one, and it links out to publishers instead of copying their material. When a
 * curated `resources` table exists, swap getResourcesForSubtopic to read it and
 * the drawer needs no changes.
 */

/** Channels worth biasing video searches toward, by subject area. */
const VIDEO_HINTS = [
  { match: /math/i, hint: 'Revision Village OR "Mitch Campbell" OR "Andrew Chambers"' },
  { match: /physics/i, hint: 'Physics Online OR "Chris Doner"' },
  { match: /chemistry/i, hint: 'Richard Thornley OR "Chemistry Guru"' },
  { match: /biology/i, hint: 'Alex Lee OR "Stephanie Castle"' },
  { match: /economics/i, hint: 'Jason Welker OR "Econplusdal"' },
  { match: /computer science/i, hint: '"Computer Science IB"' },
  { match: /business/i, hint: '"Business Management IB"' },
  { match: /theory of knowledge/i, hint: 'TOK' },
  { match: /extended essay/i, hint: '"extended essay" guide' },
]

function videoHint(subject) {
  return VIDEO_HINTS.find((v) => v.match.test(subject))?.hint || ''
}

const CATEGORIES = [
  {
    key: 'video',
    label: 'Video walkthrough',
    description: 'A focused explanation of the concept from teachers who cover this syllabus.',
    cta: 'Watch on YouTube',
    build: ({ subject, subtopic, curriculum }) => {
      const hint = videoHint(subject)
      const q = [curriculum, subject, subtopic, hint].filter(Boolean).join(' ')
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    },
  },
  {
    key: 'lesson',
    label: 'Guided lesson',
    description: 'Structured lessons and practice to relearn the idea from scratch.',
    cta: 'Learn on Khan Academy',
    build: ({ subtopic }) =>
      `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(subtopic)}`,
  },
  {
    key: 'notes',
    label: 'Revision notes',
    description: 'Condensed notes written against this specification.',
    cta: 'Open revision notes',
    build: ({ subject, subtopic }) =>
      `https://www.google.com/search?q=${encodeURIComponent(
        `${subject} ${subtopic} revision notes (site:savemyexams.com OR site:studynova.com OR site:ibdocs.re)`
      )}`,
  },
  {
    key: 'worked_example',
    label: 'Worked example',
    description: 'A full solution to a question of the type examiners actually set.',
    cta: 'See worked solutions',
    build: ({ curriculum, subject, subtopic }) =>
      `https://www.google.com/search?q=${encodeURIComponent(
        `${curriculum} ${subject} "${subtopic}" worked example step by step solution`
      )}`,
  },
  {
    key: 'mark_scheme',
    label: 'Mark scheme breakdown',
    description: 'How marks are awarded, so you write what the examiner is looking for.',
    cta: 'Study mark schemes',
    build: ({ curriculum, subject, subtopic }) =>
      `https://www.google.com/search?q=${encodeURIComponent(
        `${curriculum} ${subject} "${subtopic}" markscheme "how marks are awarded"`
      )}`,
  },
  {
    key: 'pitfalls',
    label: 'Common pitfalls',
    description: 'The mistakes examiner reports flag most often on this topic.',
    cta: 'Review common errors',
    build: ({ curriculum, subject, subtopic }) =>
      `https://www.google.com/search?q=${encodeURIComponent(
        `${curriculum} ${subject} "${subtopic}" common mistakes examiner report`
      )}`,
  },
]

export function getResourcesForSubtopic({ curriculum = 'IB', subject = '', subtopic = '' }) {
  const ctx = { curriculum, subject, subtopic }
  return CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description,
    cta: c.cta,
    href: c.build(ctx),
  }))
}

export const RESOURCE_COUNT = CATEGORIES.length
