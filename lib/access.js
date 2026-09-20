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

/** How long a free subject is held before it can be swapped again. */
export const FREE_SWITCH_DAYS = 30

/**
 * May this account change its free subject right now?
 *
 * Without a hold, a free account could quiz one subject, switch, quiz the next,
 * and work through the whole syllabus a subject at a time. Premium accounts are
 * never held because they have every subject anyway.
 */
export function canSwitchFreeSubject(profile, now = new Date()) {
  if (hasAllSubjects(profile)) return { allowed: true, daysLeft: 0 }
  const until = profile?.free_subject_locked_until
  if (!until) return { allowed: true, daysLeft: 0 }
  const ms = new Date(until) - now
  if (ms <= 0) return { allowed: true, daysLeft: 0 }
  return { allowed: false, daysLeft: Math.ceil(ms / 86400000) }
}

/** The timestamp to store when a free subject is chosen. */
export function freeSubjectLockUntil(now = new Date()) {
  return new Date(now.getTime() + FREE_SWITCH_DAYS * 86400000).toISOString()
}

export function isSubjectLocked(subject, profile) {
  if (hasAllSubjects(profile)) return false
  return !accessibleSubjects(profile).includes(subject)
}

/**
 * Can this account use this feature?
 *
 * Free is not crippled: it is the whole product for one subject. What it does
 * not have is the other five, and Syllabi. Naming the two things a plan buys
 * beats a list of twenty half-features nobody can hold in their head.
 */
export function canUse(feature, profile) {
  if (feature === 'syllabi') return hasSyllabi(profile)
  if (feature === 'allSubjects') return hasAllSubjects(profile)
  return true
}
