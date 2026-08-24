/**
 * Resources for a subtopic.
 *
 * Curated destination pages come first: real lessons, notes and videos that
 * were checked before shipping (see lib/resource-catalog.js). Targeted searches
 * come after as a fallback, clearly labelled as searches, so that a subtopic
 * with no hand-picked match is still never a dead end.
 *
 * Nothing here reproduces a publisher's material; every entry links out.
 */

import { curatedFor, KINDS, hasCurated } from './resource-catalog'

/** Channels worth biasing video searches toward, by subject area. */
const VIDEO_HINTS = [
  { match: /math/i, hint: 'Revision Village OR "Mitch Campbell" OR "Andrew Chambers"' },
  { match: /physics/i, hint: '"Doner Physics" OR "Physics Online"' },
  { match: /chemistry/i, hint: '"Richard Thornley" OR "Chemistry Guru"' },
  { match: /biology/i, hint: '"Alex Lee" OR "Stephanie Castle"' },
  { match: /economics/i, hint: '"Jason Welker" OR EconplusDal' },
  { match: /computer science/i, hint: '"Computer Science IB"' },
  { match: /business/i, hint: '"Business Management IB"' },
  { match: /theory of knowledge/i, hint: 'TOK' },
  { match: /extended essay/i, hint: '"extended essay" guide' },
]

function videoHint(subject) {
  return VIDEO_HINTS.find((v) => v.match.test(subject))?.hint || ''
}

/**
 * Searches that stay useful no matter how obscure the subtopic is.
 * These are the long tail, the catalog cannot hand-pick 2,590 pages.
 */
const SEARCHES = [
  {
    key: 'video',
    kind: 'video',
    title: 'Video walkthrough of this subtopic',
    provider: 'YouTube search',
    note: 'Scoped to the channels that cover this syllabus.',
    build: ({ subject, subtopic, curriculum }) => {
      const q = [curriculum, subject, subtopic, videoHint(subject)].filter(Boolean).join(' ')
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
    },
  },
  {
    key: 'worked_example',
    kind: 'practice',
    title: 'Worked example for this subtopic',
    provider: 'Search',
    note: 'A full solution to a question of the type examiners set.',
    build: ({ curriculum, subject, subtopic }) =>
      `https://www.google.com/search?q=${encodeURIComponent(
        `${curriculum} ${subject} "${subtopic}" worked example step by step solution`
      )}`,
  },
  {
    key: 'pitfalls',
    kind: 'notes',
    title: 'Common mistakes on this subtopic',
    provider: 'Search',
    note: 'What examiner reports flag most often here.',
    build: ({ curriculum, subject, subtopic }) =>
      `https://www.google.com/search?q=${encodeURIComponent(
        `${curriculum} ${subject} "${subtopic}" common mistakes examiner report`
      )}`,
  },
]

/**
 * @returns {Array<{key, kind, kindLabel, title, provider, note, href, curated}>}
 */
export function getResourcesForSubtopic({
  curriculum = 'IB',
  subject = '',
  subtopic = '',
  topic = '',
}) {
  const ctx = { curriculum, subject, subtopic, topic }

  const curated = curatedFor({ subject, topic, subtopic }).map((item, i) => ({
    key: `c${i}`,
    kind: item.kind,
    kindLabel: KINDS[item.kind]?.label || 'Resource',
    title: item.title,
    provider: item.provider,
    note: item.note,
    href: item.url,
    curated: true,
  }))

  const searches = SEARCHES.map((s) => ({
    key: s.key,
    kind: s.kind,
    kindLabel: KINDS[s.kind]?.label || 'Resource',
    title: s.title,
    provider: s.provider,
    note: s.note,
    href: s.build(ctx),
    curated: false,
  }))

  return [...curated, ...searches]
}

export { hasCurated }

/** Lower bound on what any subtopic offers, used for copy, not for layout. */
export const RESOURCE_COUNT = SEARCHES.length
