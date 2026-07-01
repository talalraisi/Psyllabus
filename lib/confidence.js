export const CONFIDENCE = {
  weak: 1,
  review: 3,
  solid: 5,
  mastered: 6,
}

export const CONFIDENCE_LEVELS = [
  { level: CONFIDENCE.weak, color: 'var(--weak)', label: 'Weak', title: 'Weak — need to study' },
  { level: CONFIDENCE.review, color: 'var(--review)', label: 'Review', title: 'Review — shaky' },
  { level: CONFIDENCE.solid, color: 'var(--solid)', label: 'Solid', title: 'Solid — confident' },
  { level: CONFIDENCE.mastered, color: 'var(--mastered)', label: 'Mastered', title: 'Fully mastered' },
]

export function dotColor(confidence) {
  const match = CONFIDENCE_LEVELS.find((l) => l.level === confidence)
  return match ? match.color : 'var(--border-strong)'
}
