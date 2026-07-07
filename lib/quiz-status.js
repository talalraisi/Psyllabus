/** Quiz-driven heatmap status — no self-rating */

export const STATUS = {
  untested: 'untested',
  weak: 'weak',
  shaky: 'shaky',
  solid: 'solid',
}

export const STATUS_LEVELS = [
  { status: STATUS.untested, color: 'var(--untested)', label: 'Untested' },
  { status: STATUS.weak, color: 'var(--weak)', label: 'Weak' },
  { status: STATUS.shaky, color: 'var(--review)', label: 'Shaky' },
  { status: STATUS.solid, color: 'var(--solid)', label: 'Solid' },
]

const WEAK_THRESHOLD = 0.5
const SOLID_THRESHOLD = 0.75

export function statusFromAccuracy(accuracy, attemptCount = 0) {
  if (!attemptCount || accuracy == null) return STATUS.untested
  if (accuracy < WEAK_THRESHOLD) return STATUS.weak
  if (accuracy < SOLID_THRESHOLD) return STATUS.shaky
  return STATUS.solid
}

export function dotColorForStatus(status) {
  const match = STATUS_LEVELS.find((l) => l.status === status)
  return match ? match.color : 'var(--untested)'
}

export function statusLabel(status) {
  const match = STATUS_LEVELS.find((l) => l.status === status)
  return match ? match.label : 'Untested'
}
