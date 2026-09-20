/**
 * Access tiers.
 *
 * Project Syllabus is a student tool. There are no teacher accounts and no cohort
 * dashboards; a school licence simply unlocks the full product for its
 * students via an access code.
 *
 *   free     one subject, subtopic quizzes, basic heatmap and planner
 *   premium  everything, whether paid individually or via a school code
 *
 * One place decides entitlement so the UI never has to guess.
 */

export const TIER = { free: 'free', basic: 'basic', premium: 'premium' }

/** Ranked, so a check can ask "at least basic" rather than list the tiers. */
const RANK = { free: 0, basic: 1, premium: 2 }

export const FREE_SUBJECT_LIMIT = 1

export const PREMIUM_FEATURES = {
  allSubjects: 'All subjects unlocked',
  topicQuizzes: 'Full-topic and full-subject quizzes',
  timedMocks: 'Exam-condition timed mocks',
  customTests: 'Custom multi-topic papers',
  decay: 'Dynamic mastery decay',
  mistakeBank: 'Redemption questions with spaced repetition',
  calibration: 'Confidence calibration score',
  smartPlanner: 'Smart algorithmic study planner',
  resourceHub: 'Full resource hub for every subtopic',
  readiness: 'Exam readiness score',
}

/**
 * A profile is premium when it has paid, been granted access by a school or
 * admin code, or is flagged as an admin account.
 */
export function getTier(profile) {
  if (!profile) return TIER.free
  if (profile.is_admin) return TIER.premium
  if (profile.plan === 'premium') return TIER.premium
  // A school licence grants premium and says where it came from, so it needs
  // no plan of its own.
  if (profile.access_expires_at && new Date(profile.access_expires_at) > new Date()) {
    return TIER.premium
  }
  if (profile.plan === 'basic') return TIER.basic
  return TIER.free
}

/** At least this tier. The only way anything in the app should ask. */
export function atLeast(profile, tier) {
  return RANK[getTier(profile)] >= RANK[tier]
}

/**
 * Every subject they take, rather than the one free subject.
 *
 * This is what most of the app was calling isPremium for, and the two stopped
 * meaning the same thing the moment there were three plans: Basic opens every
 * subject and has no Syllabi.
 */
export function hasAllSubjects(profile) {
  return atLeast(profile, TIER.basic)
}

/** Syllabi is the one thing Premium has and Basic does not. */
export function hasSyllabi(profile) {
  return atLeast(profile, TIER.premium)
}

export function isPremium(profile) {
  return getTier(profile) === TIER.premium
}

export function planLabel(profile) {
  if (profile?.is_admin) return 'Admin · full access'
  if (profile?.access_source) return `Unlocked by ${profile.access_source}`
  const tier = getTier(profile)
  if (tier === TIER.premium) return 'Premium'
  if (tier === TIER.basic) return 'Basic'
  return 'Free plan'
}

/**
 * The one subject a free account has open.
 *
 * Their explicit choice wins. Falling back to the first subject only matters
 * for accounts created before the picker existed, and for the moment between
 * finishing onboarding and choosing.
 */
export function freeSubject(profile) {
  const subjects = profile?.subjects || []
  if (!subjects.length) return null
  const chosen = profile?.free_subject
  return chosen && subjects.includes(chosen) ? chosen : subjects[0]
}

/**
 * The subjects a student may actually open. Free accounts get the one they
 * picked; the core is always available because it is not an optional subject.
 */
export function accessibleSubjects(profile) {
  const subjects = profile?.subjects || []
  if (hasAllSubjects(profile)) return subjects
  const chosen = freeSubject(profile)
  return chosen ? [chosen] : []
}

/**
 * May this account still choose its free subject?
 *
 * It used to be changeable every thirty days, which meant a patient free
 * account could read the whole course a subject at a time, and every locked
 * card carried a countdown explaining a rule nobody had asked about. The
 * choice is made once — at the end of onboarding, or here for accounts that
 * predate the picker — and after that the way to open another subject is to
 * open all of them.
 */
export function canSwitchFreeSubject(profile) {
  if (hasAllSubjects(profile)) return { allowed: true }
  return { allowed: !profile?.free_subject }
}

export function isSubjectLocked(subject, profile) {
  if (hasAllSubjects(profile)) return false
  return !accessibleSubjects(profile).includes(subject)
}

/**
 * Can this account use this feature?
 *
 * The pricing page lists what each plan misses, so this list and that list are
 * the same list. A page that claims Basic has no subject map while the app
 * hands it over anyway is not a generous product, it is a lying page — and the
 * student who notices stops believing the rest of it.
 *
 * Free keeps the core loop whole for one subject: map it, sit quizzes, prove
 * levels, redeem what you got wrong. Everything a free account cannot reach is
 * something it would only want once it had all six subjects anyway.
 */
const FEATURE_TIER = {
  // Free.
  subtopicQuiz: TIER.free,
  heatmap: TIER.free,
  redemption: TIER.free,
  ownFlashcards: TIER.free,
  planner: TIER.free,
  todo: TIER.free,

  // Basic.
  allSubjects: TIER.basic,
  timedPapers: TIER.basic,
  prediction: TIER.basic,
  presetDecks: TIER.basic,

  // Premium.
  subjectMap: TIER.premium,
  syllabi: TIER.premium,
}

export function canUse(feature, profile) {
  const needed = FEATURE_TIER[feature]
  if (!needed) return true
  return atLeast(profile, needed)
}
