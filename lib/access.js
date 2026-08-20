/**
 * Access tiers.
 *
 * Students linked to a school get everything free for as long as that school's
 * plan is active. Everyone else is on the free tier, which tracks one subject.
 * Gating is read-only here: one place decides, the UI just reflects it.
 */

export const TIER = {
  free: 'free',
  school: 'school',
  premium: 'premium',
}

export const FREE_SUBJECT_LIMIT = 1

export function getTier(profile, school) {
  if (school?.plan === 'school_free' || school?.plan === 'school_paid') return TIER.school
  if (profile?.plan === 'premium') return TIER.premium
  return TIER.free
}

export function tierLabel(tier, school) {
  if (tier === TIER.school) return school?.name ? `${school.name} · Full access` : 'School · Full access'
  if (tier === TIER.premium) return 'Premium'
  return 'Free plan'
}

/** Subjects the student may open. Free tier sees only their first subject. */
export function accessibleSubjects(profile, tier) {
  const subjects = profile?.subjects || []
  if (tier === TIER.free) return subjects.slice(0, FREE_SUBJECT_LIMIT)
  return subjects
}

export function isSubjectLocked(subject, profile, tier) {
  return !accessibleSubjects(profile, tier).includes(subject)
}

export function isStaff(profile) {
  return profile?.role === 'teacher' || profile?.role === 'admin'
}
