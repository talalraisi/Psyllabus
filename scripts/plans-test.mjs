/**
 * The pricing page says who gets what. This checks the app agrees.
 *
 * A page claiming Basic has no subject map while the app hands it over is not
 * generosity, it is a lying page — and the student who notices stops believing
 * the rest of it. So both halves of the page are asserted against the real
 * entitlement check:
 *
 *   the cards      a chosen few lines per plan, so they stay readable
 *   the table      every row, for every plan — the exhaustive list
 *
 * The cards are a subset by design, which is why nothing here infers "not
 * listed as missing, therefore included". Only the table carries that weight.
 */
import { canUse, getTier } from '../lib/access.js'
import { PLANS, COMPARISON } from '../lib/plans.js'

/** What a line printed on a card means in feature terms. */
const FEATURE_OF = {
  'Your other five subjects': 'allSubjects',
  'Timed papers': 'timedPapers',
  'Predicted grade': 'prediction',
  'Ready-made flashcard decks': 'presetDecks',
  'The subject map': 'subjectMap',
  Syllabi: 'syllabi',
}

/**
 * What a row of the table means in feature terms.
 *
 * `null` is a deliberate "nothing gates this" — it is in the table because a
 * student comparing plans wants to see it, not because it can be withheld.
 * An unmapped row fails, so adding one to the page forces a decision here.
 */
const ROW_FEATURE = {
  Subjects: 'allSubjects',
  'Full syllabus map': null,
  'Quizzes that set your levels': 'subtopicQuiz',
  'Redemption for wrong answers': 'redemption',
  'Study planner': 'planner',
  'Calendar and reminders': null,
  'Build a test': null,
  'Timed papers and exam mode': 'timedPapers',
  'Predicted grade out of 45': 'prediction',
  'Your own flashcards': 'ownFlashcards',
  'Ready-made decks': 'presetDecks',
  'The subject map': 'subjectMap',
  'Feedback on an IA, EE or TOK draft': 'syllabi',
  'Research question ideas': 'syllabi',
  'What to study, from your results': 'syllabi',
}

/** A cell can say a word rather than tick or dash. This is what it promises. */
const STRING_MEANS = { One: false, 'All six': true }

const PROFILE = {
  free: { plan: 'free', subjects: ['A', 'B'], free_subject: 'A' },
  basic: { plan: 'basic', subjects: ['A', 'B'] },
  premium: { plan: 'premium', subjects: ['A', 'B'] },
}

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

check(
  'tiers rank free < basic < premium',
  getTier(PROFILE.free) === 'free' &&
    getTier(PROFILE.basic) === 'basic' &&
    getTier(PROFILE.premium) === 'premium'
)

// The cards: every "not included" line is genuinely not included.
for (const plan of PLANS) {
  for (const line of plan.excludes) {
    const feature = FEATURE_OF[line]
    if (feature === undefined) {
      console.log(`FAIL  ${plan.name} lists "${line}" and nothing maps to it`)
      failed++
      continue
    }
    check(`${plan.name} really cannot use ${feature}`, canUse(feature, PROFILE[plan.id]) === false)
  }
}

// The table: every row, both ways round.
for (const section of COMPARISON) {
  for (const row of section.rows) {
    const feature = ROW_FEATURE[row.label]
    if (feature === undefined) {
      console.log(`FAIL  the table has a row "${row.label}" and nothing maps to it`)
      failed++
      continue
    }
    for (const id of ['free', 'basic', 'premium']) {
      const cell = row[id]
      const promised = typeof cell === 'string' ? STRING_MEANS[cell] : cell
      if (promised === undefined) {
        console.log(`FAIL  "${row.label}" says "${cell}" for ${id} and nothing maps to it`)
        failed++
        continue
      }
      if (feature === null) {
        // Nothing gates it, so the table may not claim anyone is without it.
        check(`"${row.label}" is open to ${id}, as the table says`, promised === true)
        continue
      }
      check(
        `${id} ${promised ? 'gets' : 'does not get'} ${feature}, as the table says`,
        canUse(feature, PROFILE[id]) === promised
      )
    }
  }
}

check(
  'a school code grants premium',
  canUse('syllabi', { plan: 'free', access_expires_at: new Date(Date.now() + 86400000).toISOString() })
)
check(
  'an expired code does not',
  canUse('syllabi', { plan: 'free', access_expires_at: new Date(Date.now() - 86400000).toISOString() }) ===
    false
)
check(
  'free keeps the core loop',
  ['subtopicQuiz', 'heatmap', 'redemption', 'ownFlashcards', 'planner', 'todo'].every((f) =>
    canUse(f, PROFILE.free)
  )
)

console.log(failed ? `\n${failed} failing` : '\nthe page and the app agree')
process.exit(failed ? 1 : 0)
