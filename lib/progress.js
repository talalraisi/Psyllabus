// Statuses are quiz-verified only. There is no self-rating anywhere:
// a quiz writes in_progress (weak) / confident (shaky) / mastered (solid)
// into progress based on accuracy, and decay derives 'decaying' at read time.
export const STATUS_COLORS = {
  not_started: 'bg-[#e5e7eb]',
  in_progress: 'bg-[#ef4444]',
  confident: 'bg-[#fbbf24]',
  mastered: 'bg-[#2D6A4F]',
  decaying: 'bg-[#f59e0b]',
}

export const STATUS_LABELS = {
  not_started: 'Untested',
  in_progress: 'Weak',
  confident: 'Shaky',
  mastered: 'Mastered',
  decaying: 'Decaying',
}

export const STATUS_TEXT_COLORS = {
  not_started: 'text-[#6b7280]',
  in_progress: 'text-[#dc2626]',
  confident: 'text-[#d97706]',
  mastered: 'text-[#2D6A4F]',
  decaying: 'text-[#d97706]',
}

export function progressKey(subject, subtopic) {
  return `${subject}::${subtopic}`
}

export function computeCompletionPercent(subtopics, progressMap, subject) {
  if (!subtopics.length) return 0
  const mastered = subtopics.filter(
    (s) => progressMap[progressKey(subject, s.subtopic)] === 'mastered'
  ).length
  return Math.round((mastered / subtopics.length) * 100)
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
