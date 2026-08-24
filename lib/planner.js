/**
 * Study planner scoring.
 *
 * Turns raw progress into an ordered queue answering "what should I do now".
 * Four inputs, in the order they matter:
 *
 *   1. Verified weakness   a subtopic you got wrong outranks one you never tried
 *   2. Decay               something mastered long ago is slipping away
 *   3. Foundation          early topics unlock later ones, so they go first
 *   4. Time to exam        as exams approach, breadth beats depth
 *
 * Everything here is pure so it can be reasoned about and tested directly.
 */

import { topicSortKey } from './progress'
import { DECAY_DAYS, daysSince } from './decay'

/** Minutes a student should expect to spend recovering one subtopic. */
const MINUTES_PER_ITEM = 8
export const DEFAULT_SESSION_MINUTES = 40

const STATUS_WEIGHT = {
  in_progress: 100, // weak: proven wrong
  decaying: 80, // was mastered, slipping
  confident: 55, // shaky
  not_started: 35, // unknown
  mastered: 0,
}

/** IB exams sit in May of the graduation year. */
export function examDateFor(profile, now = new Date()) {
  const year = parseInt(profile?.grad_year, 10)
  if (Number.isNaN(year)) return null
  return new Date(Date.UTC(year, 4, 1)) // 1 May
}

export function daysUntilExam(profile, now = new Date()) {
  const exam = examDateFor(profile)
  if (!exam) return null
  return Math.max(0, Math.round((exam - now) / 86400000))
}

/**
 * The soonest upcoming, incomplete event per subject.
 * Events with no subject are ignored here, they cannot rank a subtopic.
 */
export function nextEventBySubject(events = [], now = Date.now()) {
  const out = {}
  for (const e of events) {
    if (!e.subject || e.completed) continue
    const due = new Date(e.due_at).getTime()
    if (due < now) continue
    const current = out[e.subject]
    if (!current || due < new Date(current.due_at).getTime()) out[e.subject] = e
  }
  return out
}

/**
 * Score a single subtopic. Higher means study sooner.
 * `detail` carries the raw progress row so decay can be measured.
 */
export function scoreItem(
  item,
  { detail, subjectMastery = 0, daysLeft = null, now = Date.now(), nextEvent = null }
) {
  const status = item.status || 'not_started'
  if (status === 'mastered') return { score: 0, reasons: [] }

  let score = STATUS_WEIGHT[status] ?? 35
  const reasons = []

  // A dated test in this subject beats everything undated. The closer it is,
  // the harder it pulls, so the week before a mock reorders the whole queue.
  if (nextEvent) {
    const days = Math.max(0, Math.round((new Date(nextEvent.due_at) - now) / 86400000))
    if (days <= 21) {
      score += Math.round(60 * (1 - days / 21))
      reasons.push({
        kind: 'event',
        label: days === 0 ? `${nextEvent.title} today` : `${nextEvent.title} in ${days} days`,
      })
    }
  }

  if (status === 'in_progress') reasons.push({ kind: 'weak', label: 'Answered incorrectly' })
  if (status === 'confident') reasons.push({ kind: 'shaky', label: 'Shaky on the last attempt' })
  if (status === 'not_started') reasons.push({ kind: 'untested', label: 'Not tested yet' })

  // Decay: the longer past the window, the more urgent, capped so it never
  // outranks a subtopic you are actively getting wrong.
  if (status === 'decaying') {
    const age = daysSince(detail?.updatedAt, now) ?? DECAY_DAYS
    const overdue = Math.max(0, age - DECAY_DAYS)
    score += Math.min(30, overdue)
    reasons.push({ kind: 'decaying', label: `Mastered ${age} days ago` })
  }

  // Foundation: topic 1 before topic 5, because later work depends on it.
  const topicIndex = topicSortKey(item.topic)
  if (topicIndex <= 2) {
    score += 12
    reasons.push({ kind: 'foundation', label: 'Foundational for later topics' })
  } else if (topicIndex <= 4) {
    score += 5
  }

  // Weakest subjects first, so effort lands where the grade moves most.
  score += Math.round((100 - subjectMastery) * 0.12)

  // Close to exams, untested breadth becomes more urgent than perfecting.
  if (daysLeft !== null && daysLeft < 90 && status === 'not_started') {
    score += 15
    reasons.push({ kind: 'exam', label: 'Still untested with exams close' })
  }

  // Nudge HL content up: more marks ride on it.
  if (item.hl_only) score += 4

  return { score, reasons }
}

/**
 * Build a ranked queue from merged syllabus + progress rows.
 * Returns every non-mastered item, most urgent first.
 */
export function buildQueue({
  items = [],
  details = {},
  subjectMastery = {},
  profile = null,
  events = [],
  now = Date.now(),
}) {
  const daysLeft = daysUntilExam(profile)
  const nextBySubject = nextEventBySubject(events, now)

  return items
    .filter((i) => (i.status || 'not_started') !== 'mastered')
    .map((item) => {
      const key = `${item.subject}::${item.subtopic}`
      const { score, reasons } = scoreItem(item, {
        detail: details[key],
        subjectMastery: subjectMastery[item.subject] ?? 0,
        daysLeft,
        now,
        nextEvent: nextBySubject[item.subject] || null,
      })
      return { ...item, score, reasons }
    })
    .sort((a, b) => b.score - a.score || a.subtopic.localeCompare(b.subtopic))
}

/**
 * Today's session: the top of the queue, capped by available minutes and
 * spread across subjects so a single weak subject cannot fill the whole day.
 */
export function buildSession(queue, { minutes = DEFAULT_SESSION_MINUTES, maxPerSubject = 3 } = {}) {
  const capacity = Math.max(1, Math.floor(minutes / MINUTES_PER_ITEM))
  const perSubject = new Map()
  const session = []

  for (const item of queue) {
    if (session.length >= capacity) break
    const used = perSubject.get(item.subject) || 0
    if (used >= maxPerSubject) continue
    perSubject.set(item.subject, used + 1)
    session.push(item)
  }

  // If diversity limits left room, top up from whatever remains.
  if (session.length < capacity) {
    for (const item of queue) {
      if (session.length >= capacity) break
      if (!session.includes(item)) session.push(item)
    }
  }

  return {
    items: session,
    minutes: session.length * MINUTES_PER_ITEM,
    perItemMinutes: MINUTES_PER_ITEM,
  }
}

/** Group a queue by subject, preserving rank order within each. */
export function groupBySubjectRanked(queue) {
  const groups = new Map()
  for (const item of queue) {
    if (!groups.has(item.subject)) groups.set(item.subject, [])
    groups.get(item.subject).push(item)
  }
  return [...groups.entries()]
    .map(([subject, items]) => ({
      subject,
      items,
      topScore: items[0]?.score ?? 0,
    }))
    .sort((a, b) => b.topScore - a.topScore)
}
