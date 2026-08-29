/**
 * The five levels of knowledge.
 *
 * Statuses are quiz-verified only. There is no self-rating anywhere: a quiz
 * writes weak / developing / proficient / mastered based on accuracy, and decay
 * derives 'fading' at read time from how long ago mastery was last proved.
 *
 * Untested is deliberately not one of the five. It is the absence of a level
 * rather than a low one, so it stays neutral grey and never competes with the
 * colours that carry meaning.
 *
 * The stored keys are unchanged from the four-level version so no migration is
 * needed and existing rows keep working: in_progress is Weak, confident is
 * Developing, decaying is Fading. Only 'proficient' is new.
 */

export const STATUS_KEYS = {
  untested: 'not_started',
  fading: 'decaying',
  weak: 'in_progress',
  developing: 'confident',
  proficient: 'proficient',
  mastered: 'mastered',
}

/** Worst to best. Untested sits outside the ladder. */
export const STATUS_ORDER = [
  'not_started',
  'in_progress',
  'confident',
  'proficient',
  'mastered',
]

export const STATUS_LABELS = {
  not_started: 'Untested',
  decaying: 'Fading',
  in_progress: 'Weak',
  confident: 'Developing',
  proficient: 'Proficient',
  mastered: 'Mastered',
}

export const STATUS_COLORS = {
  not_started: 'bg-[var(--status-untested)]',
  decaying: 'bg-[var(--status-fading)]',
  in_progress: 'bg-[var(--status-weak)]',
  confident: 'bg-[var(--status-developing)]',
  proficient: 'bg-[var(--status-proficient)]',
  mastered: 'bg-[var(--status-mastered)]',
}

export const STATUS_TEXT_COLORS = {
  not_started: 'text-[var(--text-muted)]',
  decaying: 'text-[var(--status-fading)]',
  in_progress: 'text-[var(--status-weak)]',
  confident: 'text-[var(--status-developing)]',
  proficient: 'text-[var(--status-proficient)]',
  mastered: 'text-[var(--status-mastered)]',
}

/** One line explaining what each level means, used in legends and tooltips. */
export const STATUS_DESCRIPTIONS = {
  not_started: 'You have not been tested on this yet.',
  decaying: 'You had this, but it has been a while since you proved it.',
  in_progress: 'You got most of these wrong. Start here.',
  confident: 'Half right. You know some of it, not all of it.',
  proficient: 'Reliable, but not yet automatic.',
  mastered: 'You got nearly all of it right, recently.',
}

/* ---------------------------------------------------------------------------
   Mastery points

   Level used to come from accuracy on a single quiz, which meant five correct
   easy questions read as Mastered. That is not mastery, it is five easy
   questions.

   A subtopic is worth 20 points. Harder questions are worth more, points come
   only from correct answers, and only the first time a given question is
   answered correctly, so the same easy question cannot be farmed. Points
   accumulate across every attempt, so mastery is built rather than handed over
   by one lucky quiz.
   --------------------------------------------------------------------------- */

export const MASTERY_TARGET = 20

export const DIFFICULTY_POINTS = { easy: 0.25, medium: 0.5, hard: 1 }

/**
 * Questions store difficulty as a number, so it is banded here. The cut points
 * match the bands the test builder offers, so "hard" means the same thing when
 * choosing a test and when counting what it was worth.
 */
export function difficultyBand(difficulty) {
  const d = typeof difficulty === 'number' ? difficulty : 0.5
  if (d <= 0.35) return 'easy'
  if (d <= 0.65) return 'medium'
  return 'hard'
}

export function pointsForQuestion(difficulty) {
  return DIFFICULTY_POINTS[difficultyBand(difficulty)]
}

/** Points to level. Fading is not in this ladder: it is not earned by a score,
 *  it is what happens to points left alone. */
export const POINT_BANDS = [
  { min: 18, status: 'mastered' },
  { min: 15, status: 'proficient' },
  { min: 10, status: 'confident' },
  { min: 0, status: 'in_progress' },
]

export function statusFromPoints(points) {
  if (!points || points <= 0) return 'not_started'
  return POINT_BANDS.find((b) => points >= b.min)?.status ?? 'in_progress'
}

/** How far through the 20 points a subtopic is, 0 to 1. */
export function masteryFraction(points) {
  return Math.max(0, Math.min(1, (points || 0) / MASTERY_TARGET))
}

/** What reaching the next level would still take. */
export function pointsToNextLevel(points = 0) {
  const next = [...POINT_BANDS].reverse().find((b) => b.min > (points || 0))
  if (!next) return null
  return { status: next.status, points: +(next.min - (points || 0)).toFixed(2) }
}

export function progressKey(subject, subtopic) {
  return `${subject}::${subtopic}`
}

/**
 * How much of a subject is genuinely secure.
 *
 * Mastered counts fully and proficient counts most of the way, because a
 * subtopic you get seven out of ten on is not nothing, and counting only
 * mastered made the ring read as zero for a long time before it moved.
 */
const COMPLETION_WEIGHT = {
  mastered: 1,
  proficient: 0.75,
  decaying: 0.5,
  confident: 0.35,
  in_progress: 0,
  not_started: 0,
}

export function computeCompletionPercent(subtopics, progressMap, subject) {
  if (!subtopics.length) return 0
  const total = subtopics.reduce((sum, s) => {
    const status = progressMap[progressKey(subject, s.subtopic)] || 'not_started'
    return sum + (COMPLETION_WEIGHT[status] ?? 0)
  }, 0)
  return Math.round((total / subtopics.length) * 100)
}

export function buildProgressMap(progressRows) {
  return (progressRows || []).reduce((acc, p) => {
    acc[progressKey(p.subject, p.subtopic)] = p.status
    return acc
  }, {})
}

export function mergeSyllabusWithProgress(syllabusRows, progressMap) {
  return syllabusRows.map((row) => ({
    ...row,
    status: progressMap[progressKey(row.subject, row.subtopic)] || 'not_started',
  }))
}

export function groupBySubject(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.subject]) acc[item.subject] = []
    acc[item.subject].push(item)
    return acc
  }, {})
}

export function topicSortKey(topic) {
  const match = topic.match(/Topic\s+(\d+)/i)
  return match ? parseInt(match[1], 10) : 999
}

export function sortTopics(entries) {
  return entries.sort(([a], [b]) => topicSortKey(a) - topicSortKey(b))
}

export function groupByTopic(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.topic]) acc[item.topic] = []
    acc[item.topic].push(item)
    return acc
  }, {})
}
