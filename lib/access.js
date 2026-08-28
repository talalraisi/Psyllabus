/**
 * Access tiers.
 *
 * PSyllabus is a student tool. There are no teacher accounts and no cohort
 * dashboards; a school licence simply unlocks the full product for its
 * students via an access code.
 *
 *   free     one subject, subtopic quizzes, basic heatmap and planner
 *   premium  everything, whether paid individually or via a school code
 *
 * One place decides entitlement so the UI never has to guess.
 */

export const TIER = { free: 'free', premium: 'premium' }

export const FREE_SUBJECT_LIMIT = 1

export const PREMIUM_FEATURES = {
  allSubjects: 'All subjects unlocked',
  topicQuizzes: 'Full-topic and full-subject quizzes',
  timedMocks: 'Exam-condition timed mocks',
  customTests: 'Custom multi-topic papers',
  decay: 'Dynamic mastery decay',
  mistakeBank: 'Mistake bank with spaced repetition',
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
  if (profile.access_expires_at && new Date(profile.access_expires_at) > new Date()) {
    return TIER.premium
  }
  return TIER.free
}

export function isPremium(profile) {
  return getTier(profile) === TIER.premium
}

export function planLabel(profile) {
  if (profile?.is_admin) return 'Admin · full access'
  if (isPremium(profile)) {
    return profile?.access_source ? `Unlocked by ${profile.access_source}` : 'Premium'
  }
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
  if (isPremium(profile)) return subjects
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
  if (isPremium(profile)) return { allowed: true, daysLeft: 0 }
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
  if (isPremium(profile)) return false
  return !accessibleSubjects(profile).includes(subject)
}

/** Features gated behind premium. Used to show locks rather than hide things. */
export function canUse(feature, profile) {
  if (isPremium(profile)) return true
  return feature === 'subtopicQuiz' || feature === 'basicHeatmap' || feature === 'basicPlanner'
}
