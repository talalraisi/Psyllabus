/**
 * How much of each subject actually has questions in it.
 *
 * Every subject in the picker looks identical, and 166 of the 173 have nothing
 * in them. A student choosing their six will pick four empty ones and conclude
 * the product is broken — which, for those four, it is. Saying so before they
 * choose costs one round trip and is the difference between a beta that
 * produces feedback and one that produces shrugs.
 *
 * Cached for the session, because it changes when questions are generated, not
 * while somebody is filling in a form.
 */

let cache = null
let inFlight = null

export async function getCoverage(supabase) {
  if (cache) return cache
  if (inFlight) return inFlight

  inFlight = supabase
    .rpc('subject_coverage')
    .then(({ data, error }) => {
      inFlight = null
      if (error) return {}
      const map = {}
      for (const row of data || []) {
        map[row.subject] = {
          subtopics: row.subtopics,
          covered: row.covered,
          questions: row.questions,
        }
      }
      cache = map
      return map
    })
    .catch(() => {
      inFlight = null
      return {}
    })

  return inFlight
}

/**
 * What to say about a subject on a picker.
 *
 * Deliberately not a percentage. "3% covered" reads as a defect; "ready to
 * quiz" and "no questions yet" are the two facts a student is actually deciding
 * between, and the middle case is worth naming because a subject with a third
 * of its subtopics covered is genuinely usable.
 */
export function coverageLabel(entry) {
  if (!entry || !entry.questions) return { label: 'No questions yet', tone: 'faint' }
  const share = entry.subtopics ? entry.covered / entry.subtopics : 0
  if (share >= 0.6) return { label: `${entry.questions} questions`, tone: 'good' }
  if (share >= 0.15) return { label: `${entry.questions} questions, partial`, tone: 'part' }
  return { label: `${entry.questions} questions so far`, tone: 'faint' }
}

/**
 * The set of subtopics that actually have questions, as "subject::subtopic".
 *
 * The planner uses it to rank things a student can sit above things they
 * cannot. Cached like the subject counts, and for the same reason: it changes
 * when questions are generated, not while somebody is using the app.
 */
let subtopicCache = null
let subtopicInFlight = null

export async function getCoveredSubtopics(supabase) {
  if (subtopicCache) return subtopicCache
  if (subtopicInFlight) return subtopicInFlight

  subtopicInFlight = supabase
    .rpc('subtopic_coverage')
    .then(({ data, error }) => {
      subtopicInFlight = null
      // An empty set would demote everything equally, which is the same as
      // no opinion — so a failure here costs the ordering, not the page.
      if (error) return null
      const set = new Set((data || []).map((r) => `${r.subject}::${r.subtopic}`))
      subtopicCache = set
      return set
    })
    .catch(() => {
      subtopicInFlight = null
      return null
    })

  return subtopicInFlight
}

/**
 * The coverage to show for a course whose level has not been chosen yet.
 *
 * The picker shows one entry per course now, so it has to say something
 * about "English A: Literature" before it knows whether that means SL or HL.
 * Reading the first level in the list meant reading HL, which has nothing in
 * it, and printing "No questions yet" over a course with a hundred and sixty
 * questions at SL. The best of the levels is the honest answer to "is there
 * anything here", which is the question the label exists to answer.
 */
export function bestCoverage(coverage, names) {
  let best = null
  for (const name of names) {
    const entry = coverage?.[name]
    if (!entry) continue
    if (!best || (entry.questions || 0) > (best.questions || 0)) best = entry
  }
  return best
}

export const COVERAGE_TONE = {
  good: 'var(--status-proficient)',
  part: 'var(--status-developing)',
  faint: 'var(--text-faint)',
}
