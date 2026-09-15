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

export const COVERAGE_TONE = {
  good: 'var(--status-proficient)',
  part: 'var(--status-developing)',
  faint: 'var(--text-faint)',
}
