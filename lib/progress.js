export const STATUS_COLORS = {
  not_started: 'bg-[#e5e7eb]',
  in_progress: 'bg-[#fbbf24]',
  confident: 'bg-[#86efac]',
  mastered: 'bg-[#2D6A4F]',
  decaying: 'bg-[#f59e0b]',
}

// Selected state for the syllabus status pills
export const STATUS_PILL_ACTIVE = {
  not_started: 'bg-gray-200 text-gray-600 border border-gray-300',
  in_progress: 'bg-[#fef3c7] text-[#d97706] border border-[#fde68a]',
  confident: 'bg-[#dcfce7] text-[#16a34a] border border-[#bbf7d0]',
  mastered: 'bg-[#2D6A4F] text-white border border-[#2D6A4F]',
}

export const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  confident: 'Confident',
  mastered: 'Mastered',
  decaying: 'Decaying',
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
