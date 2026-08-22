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
 * The subjects a student may actually open. Free accounts get the first one
 * only, and the core is always available because it is not an optional subject.
 */
export function accessibleSubjects(profile) {
  const subjects = profile?.subjects || []
  if (isPremium(profile)) return subjects
  return subjects.slice(0, FREE_SUBJECT_LIMIT)
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
