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

import { topicSortKey } from './progress.js'
import { DECAY_DAYS, daysSince } from './decay.js'
import { accessibleSubjects } from './access.js'

/**
 * Minutes a student should expect to spend recovering one subtopic.
 *
 * This was 8, which is how long it takes to answer ten multiple-choice
 * questions and nothing else. Actually recovering a subtopic means reading it,
 * sitting the quiz, and then going back over what you got wrong, and that is
 * twenty-odd minutes. Eight made the planner promise five subtopics in forty
 * minutes, which nobody has ever done, so every session ended looking failed.
 */
const MINUTES_PER_ITEM = 22
export const DEFAULT_SESSION_MINUTES = 60

const STATUS_WEIGHT = {
  in_progress: 100, // weak: proven wrong
  decaying: 80, // fading: was solid, slipping
  confident: 55, // developing: half of it is there
  not_started: 35, // unknown
  proficient: 20, // reliable, worth topping up but not urgent
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

  if (status === 'in_progress') reasons.push({ kind: 'weak', label: 'Weak, needs work' })
  if (status === 'confident') reasons.push({ kind: 'shaky', label: 'Developing, not secure yet' })
  if (status === 'not_started') reasons.push({ kind: 'untested', label: 'Not tested yet' })
  if (status === 'proficient')
    reasons.push({ kind: 'proficient', label: 'Nearly there, a few more points' })

  // Decay: the longer past the window, the more urgent, capped so it never
  // outranks a subtopic you are actively getting wrong.
  if (status === 'decaying') {
    const age = daysSince(detail?.updatedAt, now) ?? DECAY_DAYS
    const overdue = Math.max(0, age - DECAY_DAYS)
    score += Math.min(30, overdue)
    reasons.push({ kind: 'decaying', label: `Fading, last practised ${age} days ago` })
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
  covered = null,
}) {
  const daysLeft = daysUntilExam(profile)
  const nextBySubject = nextEventBySubject(events, now)

  /**
   * Only subjects this account can actually open.
   *
   * A free account has one subject unlocked and the planner was ranking all
   * six: a student whose free subject was maths was told to start with an
   * environmental systems subtopic, and the button took them to a lock. A plan
   * has to be made of things the student can do.
   */
  const open = new Set(accessibleSubjects(profile))

  return items
    .filter((i) => open.size === 0 || open.has(i.subject))
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
      // Whether a quiz on this exists at all. Null means nobody told us, in
      // which case everything is treated as available and the ranking is
      // exactly what it was.
      const quizzable = covered ? covered.has(key) : true
      return { ...item, score, reasons, quizzable }
    })
    /**
     * Anything you can sit, before anything you cannot.
     *
     * Scoring is about what a student most needs to learn, and on a bank that
     * covers 64 of 6,583 subtopics the answer is almost always something with
     * no questions behind it. The plan would then open with a subtopic whose
     * only button leads to "Questions coming soon" — urgent, correct, and
     * useless. A plan is a list of things you can actually do today.
     *
     * Demoted rather than dropped, so a subject with nothing in it still
     * shows a plan, and so a subtopic rejoins the queue in its proper place
     * the moment questions are generated for it.
     */
    .sort(
      (a, b) =>
        Number(b.quizzable) - Number(a.quizzable) ||
        b.score - a.score ||
        a.subtopic.localeCompare(b.subtopic)
    )
}

/**
 * Today's session: the top of the queue, capped by available minutes and
 * spread across subjects so a single weak subject cannot fill the whole day.
 */
/**
 * What to actually do with a subtopic, not just which one to open.
 *
 * The session named subtopics and left the rest to you, which is the part
 * students are worst at. "Circular motion, 22 minutes" is a subject line;
 * knowing whether to read it first or go straight at the questions is the
 * actual skill, and it depends on why the subtopic is in the plan at all.
 *
 * Something you got wrong needs reading before it needs testing. Something
 * that is fading does not — you knew it five weeks ago, so re-reading it
 * wastes the evening and what it needs is the retest that proves the memory is
 * still there. Something never attempted needs the material first. Something
 * proficient needs topping up, not teaching.
 *
 * So the mix is chosen by what the evidence says about you, which is the same
 * argument as the rest of the product. Other planners ask you to pick your mix
 * of notes, questions and past papers; asking a student to choose is asking
 * them to know the answer to the question they came here with.
 */
export const STEP = {
  read: 'read',
  quiz: 'quiz',
  review: 'review',
  cards: 'cards',
}

const RECIPE = {
  // Proven wrong. Read it, then test it, then go back over the misses.
  in_progress: [
    [STEP.read, 'Read it through', 7],
    [STEP.quiz, 'Ten questions', 11],
    [STEP.review, 'Go over what you missed', 4],
  ],
  // Was proved, has slipped. Re-reading is the wrong instinct: the memory is
  // in there and what it needs is retrieving, which is what fixes it.
  decaying: [
    [STEP.quiz, 'Straight to questions', 13],
    [STEP.review, 'Only what you got wrong', 9],
  ],
  // Never attempted. The material comes first or the quiz is a guess.
  not_started: [
    [STEP.read, 'Read it through', 10],
    [STEP.quiz, 'First questions on it', 12],
  ],
  // Half of it is there. Test to find which half, then read that half.
  confident: [
    [STEP.quiz, 'Ten questions', 12],
    [STEP.review, 'Read up on the gaps', 10],
  ],
  // Reliable. Keep it warm rather than teach it again.
  proficient: [
    [STEP.quiz, 'Quick check', 12],
    [STEP.cards, 'Flashcards to keep it warm', 10],
  ],
  mastered: [[STEP.quiz, 'Top-up questions', 22]],
}

/**
 * The steps for one planned subtopic, scaled to the time it has been given.
 *
 * Scaling rather than truncating, because a session of four items in forty
 * minutes gives each item ten, and a three-step recipe that assumes
 * twenty-two would run the evening to twice its length.
 */
export function stepsFor(item, minutes = MINUTES_PER_ITEM) {
  const recipe = RECIPE[item?.status] || RECIPE.not_started
  const base = recipe.reduce((n, [, , m]) => n + m, 0)
  const scale = minutes / base

  const steps = recipe.map(([kind, label, m]) => ({
    kind,
    label,
    minutes: Math.max(2, Math.round(m * scale)),
  }))

  // Rounding each step independently drifts off the total, and a session that
  // says forty minutes and adds up to forty-three is a session that overruns.
  const drift = minutes - steps.reduce((n, s) => n + s.minutes, 0)
  if (drift !== 0) {
    const longest = steps.reduce((a, b) => (b.minutes > a.minutes ? b : a))
    longest.minutes = Math.max(2, longest.minutes + drift)
  }

  return steps
}

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

  /* Each item is given an equal share of the evening, and its steps are
     scaled to that share rather than to a fixed twenty-two minutes. */
  const each = session.length ? Math.floor(minutes / session.length) : MINUTES_PER_ITEM
  const planned = session.map((item) => ({ ...item, steps: stepsFor(item, each), minutes: each }))

  return {
    items: planned,
    minutes: planned.reduce((n, i) => n + i.minutes, 0),
    perItemMinutes: each,
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
