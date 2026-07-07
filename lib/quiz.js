import { statusFromAccuracy } from './quiz-status'

export const QUIZ_TYPES = {
  subtopic: 'subtopic',
  topic: 'topic',
  subject: 'subject',
}

export const SUBTOPIC_QUESTION_COUNT = 10

export function gradeAnswer(selected, correct) {
  if (selected == null || correct == null) return false
  return String(selected) === String(correct)
}

export function computeAccuracy(correctCount, total) {
  if (!total) return null
  return correctCount / total
}

export function buildProgressUpdate({ accuracy, attemptCount }) {
  return {
    accuracy,
    attempt_count: attemptCount,
    status: statusFromAccuracy(accuracy, attemptCount),
    last_tested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function shuffleQuestions(questions) {
  const copy = [...questions]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pickQuestions(questions, count = SUBTOPIC_QUESTION_COUNT) {
  return shuffleQuestions(questions).slice(0, Math.min(count, questions.length))
}
