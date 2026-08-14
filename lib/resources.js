/**
 * Multi-Resource Hub — 5 curated resource categories per subtopic.
 * Until a hand-curated resources table is populated, links resolve to
 * tightly-scoped searches on high-yield platforms so every subtopic always
 * has all 5 categories available.
 */

const CATEGORIES = [
  {
    key: 'video',
    label: 'Video Walkthrough',
    description: 'A concise video explanation of the concept.',
    build: (q) => `https://www.youtube.com/results?search_query=${q('walkthrough')}`,
    cta: 'Watch on YouTube',
  },
  {
    key: 'worked_example',
    label: 'Worked Example',
    description: 'Step-by-step lessons and worked examples to relearn the concept.',
    build: (q, plain) =>
      `https://www.khanacademy.org/search?page_search_query=${plain()}`,
    cta: 'Learn on Khan Academy',
  },
  {
    key: 'mark_scheme',
    label: 'Mark Scheme Breakdown',
    description: 'Where the marks are actually awarded on real papers.',
    build: (q) => `https://www.google.com/search?q=${q('past paper mark scheme')}`,
    cta: 'Open mark schemes',
  },
  {
    key: 'summary_sheet',
    label: 'Active Recall Summary Sheet',
    description: 'High-density revision notes for self-testing.',
    build: (q) => `https://www.google.com/search?q=${q('revision notes site:savemyexams.com')}`,
    cta: 'Get summary notes',
  },
  {
    key: 'pitfalls',
    label: 'Common Pitfalls Guide',
    description: 'The mistakes past cohorts made most often on this node.',
    build: (q) => `https://www.google.com/search?q=${q('common mistakes examiner report')}`,
    cta: 'Review pitfalls',
  },
]

export function getResourcesForSubtopic({ curriculum = 'IB', subject, subtopic }) {
  const query = (suffix) =>
    encodeURIComponent(`${curriculum} ${subject} ${subtopic} ${suffix}`)
  // Khan Academy search works best on the bare concept name
  const plain = () => encodeURIComponent(subtopic)

  return CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description,
    href: c.build(query, plain),
    cta: c.cta,
  }))
}
