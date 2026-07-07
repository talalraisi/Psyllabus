export const STATUS_COLORS = {
  not_started: 'bg-gray-200',
  in_progress: 'bg-yellow-400',
  confident: 'bg-green-300',
  mastered: 'bg-[#2D6A4F]',
}

export const STATUS_BUTTON_COLORS = {
  not_started: 'bg-gray-200 text-gray-600',
  in_progress: 'bg-yellow-400 text-yellow-900',
  confident: 'bg-green-300 text-green-900',
  mastered: 'bg-[#2D6A4F] text-white',
}

export const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  confident: 'Confident',
  mastered: 'Mastered',
}

export const STATUS_VALUES = ['not_started', 'in_progress', 'confident', 'mastered']

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
