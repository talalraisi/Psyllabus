/**
 * The study plan: what to study, on which day, and for how long.
 *
 * lib/planner.js answers one question — what to do tonight — by ranking
 * subtopics on fixed weights and giving each an equal share of one evening.
 * This answers the three a student actually has, across the next fortnight:
 *
 *   What      Each subtopic is valued by how far it moves the subject's
 *             predicted grade towards the student's target, per hour it takes.
 *             A subject already at target gets upkeep; one two grades short
 *             pulls hardest. "Easiest marks first", worked out rather than
 *             guessed.
 *   When      Days are filled from today forward within the minutes the
 *             student has said each weekday holds. Dated things land on their
 *             dates — mistakes due back, a retest three days after learning
 *             something, a test this week — and what is left is spread by
 *             value, mixing subjects or keeping one per day as they prefer.
 *   How long  A weak subtopic takes longer than a fading one, so each task is
 *             sized by what it needs rather than by dividing the evening
 *             equally, and split into steps in the order the student likes to
 *             work.
 *
 * Pure: no clock, no storage, no network. Everything it needs is passed in,
 * so the page decides what "today" is and the tests can pin it.
 *
 * Tested by scripts/study-plan-test.mjs.
 */

import { progressKey, topicSortKey } from './progress.js'
import { DECAY_DAYS, FADE_DAYS, daysSince } from './decay.js'
import { CURRICULA } from './curriculum.js'
import { accessibleSubjects } from './access.js'

export const HORIZON_DAYS = 14
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * How a student likes to work. Every one of these is a real difference in
 * how people study, and asking beats guessing.
 *
 *   rhythm     a work/break pattern from RHYTHMS, or 'custom' with
 *              style.custom = { work, rest } in minutes
 *   order      'auto' by what the evidence says (learn or revise before
 *              testing something you got wrong, test before revising
 *              something half-known), 'questions' always test first,
 *              'learn' always learn or revise first
 *   mix        'mixed' several subjects a day, 'focus' one or two a day —
 *              which ones the student may choose per weekday (focusDays),
 *              or leave to the plan
 *   methods    the techniques the student likes; tasks are built from them
 *
 * New topics are "learned" and anything seen before is "revised". It was
 * "read" for both, and nobody learns a topic for the first time by reading
 * it, or revises one by reading it again.
 */
export const METHODS = {
  questions: 'Practice questions',
  exam: 'Exam-style questions',
  flashcards: 'Flashcards',
  blurting: 'Blurting',
  summaries: 'Summaries and mind maps',
  teach: 'Teaching it back',
}

export const DEFAULT_STYLE = {
  rhythm: '25',
  order: 'auto',
  mix: 'mixed',
  methods: ['questions', 'flashcards'],
  focusDays: {},
  custom: { work: 40, rest: 10 },
}

export const RHYTHMS = {
  25: { work: 25, rest: 5, label: '25 / 5', hint: 'Pomodoro: short bursts' },
  45: { work: 45, rest: 15, label: '45 / 15', hint: 'A lesson, then a proper break' },
  50: { work: 50, rest: 10, label: '50 / 10', hint: 'Longer stretches' },
  52: { work: 52, rest: 17, label: '52 / 17', hint: 'Long focus, long rest' },
  90: { work: 90, rest: 20, label: '90 / 20', hint: 'Deep work' },
  long: { work: Infinity, rest: 0, label: 'No set breaks', hint: 'Stop when you need to' },
  custom: { custom: true, label: 'Your own', hint: 'Set both numbers' },
}

const clamp = (n, lo, hi, fallback) => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback
}

/** The work/break pattern a style describes. */
export function rhythmOf(style) {
  if (style?.rhythm === 'custom') {
    return {
      work: clamp(style.custom?.work, 10, 180, 40),
      rest: clamp(style.custom?.rest, 0, 60, 10),
    }
  }
  return RHYTHMS[style?.rhythm] || RHYTHMS[DEFAULT_STYLE.rhythm]
}

/**
 * The exam season each curriculum sits in, when the student has not given a
 * date. A first guess the student can correct per subject: IB May papers
 * start at the beginning of May, AP in its first full week, A-Levels around
 * the middle of the month.
 */
const DEFAULT_EXAM = { IB: [4, 1], 'A-Level': [4, 15], AP: [4, 5] }

/** How much of a subtopic the student holds, by status. Matches lib/prediction.js. */
const MASTERY = {
  mastered: 1,
  proficient: 0.8,
  decaying: 0.7,
  confident: 0.5,
  in_progress: 0.25,
  not_started: 0,
}

/**
 * What one well-spent sitting realistically does for a subtopic, and how long
 * it takes. `reach` is where it leaves you, not where you'd like it to.
 *
 * Getting something you got wrong to reliable is a read, a quiz and going over
 * the misses — forty minutes. A first pass at something new reaches
 * Developing, not Proficient, because one sitting does not make it stick.
 * Fading needs only a retest, and its value is mostly in what it saves: left
 * alone it drops to Weak (see decay.js), so that loss is counted as gain.
 */
const TASK = {
  in_progress: { kind: 'learn', reach: 0.8, minutes: 40 },
  not_started: { kind: 'learn', reach: 0.5, minutes: 35 },
  confident: { kind: 'learn', reach: 0.8, minutes: 25 },
  decaying: { kind: 'refresh', reach: 0.8, minutes: 15 },
  proficient: { kind: 'topup', reach: 1, minutes: 20 },
}

const RETEST_AFTER_DAYS = 3
const RETEST_MINUTES = 12
// Below this, what is left of an evening is not worth starting something in.
const MIN_LEFTOVER = 10

const pad = (n) => String(n).padStart(2, '0')
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000)
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5)

function parseDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return dateKey(date) === s ? date : null
}

/**
 * Free time as minutes from midnight, [[start, end], ...], tidied: inside the
 * day, at least five minutes long, sorted, and touching windows merged.
 */
export function normaliseSlots(list) {
  if (!Array.isArray(list)) return null
  const clean = list
    .map(([a, b]) => [clamp(a, 0, 1440, 0), clamp(b, 0, 1440, 0)])
    .filter(([a, b]) => b - a >= 5)
    .sort((x, y) => x[0] - y[0])
  const out = []
  for (const [a, b] of clean) {
    const last = out.at(-1)
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/**
 * A first guess at someone's free time, from minutes per day: after school
 * on school days, from mid-morning on Saturday. Only ever a starting point
 * on the grid for the student to paint over.
 */
export function slotsFromMinutes(week) {
  const out = {}
  for (let d = 0; d < 7; d++) {
    const m = Math.round((week?.[d] || 0) / 30) * 30
    const start = d === 6 ? 10 * 60 : 16 * 60
    out[d] = m > 0 ? [[start, Math.min(1440, start + m)]] : []
  }
  return out
}

/**
 * The student's settings, with sensible defaults for anything not set.
 *
 * The week is the free time painted on the week grid when there is any, and
 * otherwise minutes per day — defaulting to the old single "session minutes"
 * on school days, none on Friday and half as much again on Saturday: an Omani
 * week, which is who the pilot is. Anyone else changes it once.
 */
export function resolveSettings(profile) {
  const saved = profile?.plan_settings || {}
  const base = Number(profile?.session_minutes) > 0 ? Number(profile.session_minutes) : 60
  const week = {}
  const slots = {}
  for (let d = 0; d < 7; d++) {
    const painted = normaliseSlots(saved.slots?.[d])
    if (painted) {
      slots[d] = painted
      week[d] = painted.reduce((n, [a, b]) => n + (b - a), 0)
      continue
    }
    slots[d] = null
    const v = saved.week?.[d]
    const set = v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))
    week[d] = set
      ? Math.max(0, Math.min(600, Math.round(Number(v))))
      : d === 5
        ? 0
        : d === 6
          ? round5(base * 1.5)
          : base
  }
  const style = { ...DEFAULT_STYLE, ...(saved.style || {}) }
  if (!RHYTHMS[style.rhythm]) style.rhythm = DEFAULT_STYLE.rhythm
  // Settings saved before these existed.
  if (style.order === 'reading') style.order = 'learn'
  if (!Array.isArray(saved.style?.methods)) {
    style.methods = saved.style?.cards === false ? ['questions'] : [...DEFAULT_STYLE.methods]
  }
  style.methods = style.methods.filter((m) => METHODS[m])
  if (!style.focusDays || typeof style.focusDays !== 'object') style.focusDays = {}
  return { week, slots, style, taught: saved.taught || {}, exams: saved.exams || {} }
}

export function examDateFor(subject, profile, settings) {
  const own = parseDay(settings?.exams?.[subject])
  if (own) return own
  const year = parseInt(profile?.grad_year, 10)
  if (!year) return null
  const [m, d] = DEFAULT_EXAM[profile?.curriculum] || DEFAULT_EXAM.IB
  return new Date(year, m, d)
}

/**
 * Minutes of study `minutes` of free time holds once its breaks are taken
 * out. `style` may be a style object or, as before, a rhythm key.
 */
export function studyMinutesFor(minutes, style) {
  const r = rhythmOf(typeof style === 'string' ? { rhythm: style } : style)
  if (!Number.isFinite(r.work) || minutes <= 0) return Math.max(0, minutes)
  return Math.floor((minutes * r.work) / (r.work + r.rest))
}

/**
 * How much a subject's work is worth, from the gap between its predicted
 * grade and the student's target.
 *
 * Below target, each grade short adds weight. At or above target the subject
 * still gets time — enough to stop it fading — but nothing below target ever
 * loses out to it. No target, or an unknown one, is neutral.
 */
export function subjectWeight(predicted, target, curriculum) {
  const scale = (CURRICULA[curriculum] || CURRICULA.IB).grades
  const t = scale.indexOf(String(target ?? ''))
  if (t < 0) return 1
  const p = predicted == null ? scale.length - 1 : scale.indexOf(String(predicted))
  const gap = (p < 0 ? scale.length - 1 : p) - t
  return gap > 0 ? 1 + gap : 0.4
}

/**
 * Each subject's topics in teaching order, 0 for the first.
 *
 * From the syllabus outline's position where rows carry one, so it works for
 * any curriculum's topic names; from the "Topic 3" number otherwise, which is
 * how older two-level maps were ordered.
 */
function topicRanks(items) {
  const first = new Map() // subject -> Map(topic -> sort key)
  for (const i of items) {
    if (!first.has(i.subject)) first.set(i.subject, new Map())
    const topics = first.get(i.subject)
    const k = i.position ?? topicSortKey(i.topic || '') * 1e6
    if (!topics.has(i.topic) || k < topics.get(i.topic)) topics.set(i.topic, k)
  }
  const ranks = new Map()
  for (const [subject, topics] of first) {
    const ordered = [...topics].sort((a, b) => a[1] - b[1]).map(([t]) => t)
    ranks.set(subject, new Map(ordered.map((t, n) => [t, n])))
  }
  return ranks
}

/**
 * One task per subtopic that needs anything, valued and sized.
 *
 * `predicted` maps subject to its predicted grade (lib/prediction.js), and
 * `subjectSizes` to how many subtopics it has, because one subtopic of
 * twenty moves a grade further than one of two hundred.
 */
export function buildCandidates({
  items = [],
  details = {},
  profile = null,
  settings = resolveSettings(profile),
  predicted = {},
  subjectSizes = {},
  events = [],
  covered = null,
  pace = 1,
  now = new Date(),
}) {
  const open = new Set(accessibleSubjects(profile))
  const curriculum = profile?.curriculum || 'IB'
  const targets = profile?.target_grades || {}
  const today = startOfDay(now)
  const paceFactor = Math.min(1.6, Math.max(0.6, Number(pace) || 1))

  const testSoon = {}
  for (const e of events) {
    if (!e?.subject || e.completed) continue
    const days = daysBetween(today, new Date(e.due_at))
    if (days < 0) continue
    if (testSoon[e.subject] === undefined || days < testSoon[e.subject].days) {
      testSoon[e.subject] = { days, title: e.title || 'Test' }
    }
  }

  const ranks = topicRanks(items)
  const rankOf = (subject, topic) => ranks.get(subject)?.get(topic) ?? Infinity

  const out = []
  for (const item of items) {
    if (open.size && !open.has(item.subject)) continue
    /**
     * Only topics the class has covered, when the student has said which.
     *
     * Schools do not teach in syllabus order — one starts physics in the
     * middle, another takes maths easiest-first — so this is the set of
     * topics ticked, in any order. An empty set means none chosen, which is
     * the same as everything. A single topic name is an older "up to" saving
     * and is read the way it was written.
     */
    const taught = settings.taught?.[item.subject]
    if (Array.isArray(taught)) {
      if (taught.length && !taught.includes(item.topic)) continue
    } else if (taught && rankOf(item.subject, item.topic) > rankOf(item.subject, taught)) continue
    const status = item.status || 'not_started'
    const spec = TASK[status]
    if (!spec) continue // mastered: nothing to do

    const key = progressKey(item.subject, item.subtopic)
    const quizzable = covered ? covered.has(key) : true
    const reasons = []

    let gain = spec.reach - (MASTERY[status] ?? 0)
    if (status === 'decaying') {
      // The detail map's updatedAt is the last correct answer (decay.js),
      // which is what fading runs on: a failed quiz is not proof of memory.
      const age = daysSince(details[key]?.updatedAt, now.getTime()) ?? DECAY_DAYS
      const into = Math.min(1, Math.max(0, (age - DECAY_DAYS) / FADE_DAYS))
      const daysLeft = Math.max(0, Math.round(FADE_DAYS - into * FADE_DAYS))
      gain += (MASTERY.decaying - MASTERY.in_progress) * (0.5 + 0.5 * into)
      reasons.push({
        kind: 'decaying',
        label: daysLeft <= 0 ? 'Fading — drops to Weak any day' : `Fading — drops to Weak in ${daysLeft} days`,
      })
    } else if (status === 'in_progress') reasons.push({ kind: 'weak', label: 'Weak — you got this wrong' })
    else if (status === 'not_started') reasons.push({ kind: 'untested', label: 'Not tested yet' })
    else if (status === 'confident') reasons.push({ kind: 'shaky', label: 'Developing — half of it is there' })
    else if (status === 'proficient') reasons.push({ kind: 'proficient', label: 'Nearly mastered' })

    const size = Math.max(1, subjectSizes[item.subject] || 1)
    const goal = subjectWeight(predicted[item.subject], targets[item.subject], curriculum)

    /**
     * A test in the calendar is a goal of its own, nearer than the exam.
     *
     * It used to multiply value by up to about two, which a subject already
     * on target never overcame: two days before an Economics mock, the plan
     * still led with Physics because Physics was further from its exam grade.
     * Inside a fortnight the test's subject now counts as at least neutral,
     * then scales up to four times as the date closes in — so a test in two
     * days outranks everything undated, and one in a week sits among the
     * subjects furthest from target rather than below them all.
     */
    const soon = testSoon[item.subject]
    const pressure = soon && soon.days <= 14 ? 1 + (3 * (14 - soon.days)) / 14 : 1
    const weight = pressure > 1 ? Math.max(goal, 1) * pressure : goal
    const minutes = quizzable ? round5(spec.minutes * paceFactor) : round5(Math.min(spec.minutes, 25) * paceFactor)

    let value = ((gain / size) * weight * 60) / minutes

    if (pressure > 1) {
      reasons.push({
        kind: 'event',
        label: soon.days === 0 ? `${soon.title} today` : `${soon.title} in ${soon.days} day${soon.days === 1 ? '' : 's'}`,
      })
    }
    const exam = examDateFor(item.subject, profile, settings)
    const toExam = exam ? daysBetween(today, exam) : null
    if (toExam !== null && toExam >= 0 && toExam <= 30) value *= 1.5

    if (rankOf(item.subject, item.topic) <= 1) {
      value *= 1.1
      reasons.push({ kind: 'foundation', label: 'Early topic — later ones build on it' })
    }
    if (item.hl_only) value *= 1.05
    // Something with no questions yet can still be read and learned, but a
    // plan should lead with what can be done properly.
    if (!quizzable) {
      value *= 0.4
      reasons.push({ kind: 'noquiz', label: 'No questions yet — learn it from the material' })
    }
    if (goal > 1) {
      reasons.push({
        kind: 'target',
        label: `${item.subject} is ${goal - 1} grade${goal - 1 === 1 ? '' : 's'} under your target of ${targets[item.subject]}`,
      })
    }

    out.push({
      id: key,
      key,
      kind: spec.kind,
      status,
      subject: item.subject,
      topic: item.topic,
      subtopic: item.subtopic,
      hl_only: Boolean(item.hl_only),
      goal,
      minutes,
      value,
      quizzable,
      reasons,
    })
  }
  return out.sort((a, b) => b.value - a.value || a.subtopic.localeCompare(b.subtopic))
}

/**
 * The steps of a task, in the order the student prefers, built from the
 * techniques they like, sized to its minutes.
 *
 * A new topic is learned; anything seen before is revised. Every task ends in
 * something you can see — a finished quiz, or where there are no questions
 * yet, something you made from memory — so being done is visible rather than
 * a box you tick.
 */
const RECALL = {
  blurting: 'Blurt it: write everything you remember',
  flashcards: 'Make flashcards from it',
  summaries: 'Sum it up on one page',
  teach: 'Explain it out loud, as if teaching it',
}

export function stepsFor(task, style = DEFAULT_STYLE) {
  const methods = style.methods || DEFAULT_STYLE.methods
  const q = task.quizzable
  const fresh = task.status === 'not_started'
  const recallMethod = ['blurting', 'flashcards', 'summaries', 'teach'].find((m) => methods.includes(m))
  const recall = RECALL[recallMethod] || 'Write three lines from memory'
  const questions = methods.includes('exam') ? 'Exam-style questions' : 'Practice questions'
  const learn = fresh ? ['learn', 'Learn it', 0] : ['revise', 'Revise it', 0]

  let shape
  if (task.kind === 'review') shape = [['review', 'Clear the mistakes due back', 1]]
  else if (task.kind === 'retest') shape = [['quiz', 'Quick retest: did it stick?', 1]]
  else if (!q) shape = [[learn[0], learn[1], 0.6], ['recall', recall, 0.4]]
  else if (task.kind === 'refresh') shape = [['quiz', `${questions}, straight away`, 0.6], ['review', 'Only what you got wrong', 0.4]]
  else if (task.kind === 'topup') {
    shape = recallMethod
      ? [['quiz', 'Quick check', 0.6], [recallMethod === 'flashcards' ? 'cards' : 'recall', recallMethod === 'flashcards' ? 'Flashcards to keep it warm' : recall, 0.4]]
      : [['quiz', 'Quick check', 1]]
  } else if (style.order === 'questions' && !fresh) {
    shape = [['quiz', `${questions} first`, 0.45], ['review', 'Go over what you missed', 0.3], ['revise', 'Revise the gaps', 0.25]]
  } else if (style.order === 'learn' || task.status === 'in_progress' || fresh) {
    shape = fresh
      ? [['learn', 'Learn it', 0.45], ['quiz', questions, 0.55]]
      : [['revise', 'Revise it', 0.35], ['quiz', questions, 0.45], ['review', 'Go over what you missed', 0.2]]
  } else {
    shape = [['quiz', 'Test first, to find the gaps', 0.55], ['revise', 'Revise those gaps', 0.45]]
  }

  const steps = shape.map(([kind, label, share]) => ({ kind, label, minutes: Math.max(3, Math.round(task.minutes * share)) }))
  const drift = task.minutes - steps.reduce((n, s) => n + s.minutes, 0)
  if (drift) {
    const longest = steps.reduce((a, b) => (b.minutes > a.minutes ? b : a))
    longest.minutes = Math.max(3, longest.minutes + drift)
  }
  return steps
}

/** Spread one day's tasks so the same subject does not sit back to back when it need not. */
function interleave(tasks, after = null) {
  const bySubject = new Map()
  for (const t of tasks) {
    if (!bySubject.has(t.subject)) bySubject.set(t.subject, [])
    bySubject.get(t.subject).push(t)
  }
  const out = []
  let last = after
  while (out.length < tasks.length) {
    // Most valuable remaining head that is not the subject just placed.
    let pick = null
    for (const [subject, list] of bySubject) {
      if (!list.length || subject === last) continue
      if (!pick || list[0].value > pick[1][0].value) pick = [subject, list]
    }
    if (!pick) pick = [...bySubject].find(([, list]) => list.length)
    out.push(pick[1].shift())
    last = pick[0]
  }
  return out
}

/**
 * Clock times for a day's tasks inside the student's free windows.
 *
 * Tasks go in order from the start of the first window. A break is taken
 * before any task that would carry a stretch of work past the rhythm's block,
 * and a task that will not fit what is left of a window starts the next one —
 * the gap between windows is a break of its own. Tasks are not split across
 * windows: getting halfway through a topic and stopping for football is not a
 * plan anyone would write. Anything that fits nowhere is marked `overflow`,
 * for "if you have time".
 */
export function layoutDay(tasks, slots, rhythm) {
  const timeline = []
  let w = 0
  let cursor = slots[0]?.[0] ?? 0
  let worked = 0
  for (const t of tasks) {
    let placed = false
    while (w < slots.length) {
      const [from, to] = slots[w]
      if (cursor < from) {
        cursor = from
        worked = 0
      }
      const needsBreak = Number.isFinite(rhythm.work) && worked > 0 && worked + t.minutes > rhythm.work
      const start = needsBreak ? cursor + rhythm.rest : cursor
      if (start + t.minutes <= to) {
        if (needsBreak && rhythm.rest > 0) timeline.push({ type: 'break', start: cursor, end: start })
        if (needsBreak) worked = 0
        t.start = start
        t.end = start + t.minutes
        timeline.push({ type: 'task', id: t.id, start: t.start, end: t.end })
        cursor = t.end
        worked += t.minutes
        placed = true
        break
      }
      w++
      worked = 0
    }
    if (!placed) t.overflow = true
  }
  return timeline
}

/**
 * The plan for the next `horizon` days.
 *
 * `adjustments` are the student's own edits — skip something today, move it
 * to another day, pin it to one, or mark it done — and they win over the
 * plan's opinion. `keepToday` is the plan the student already saw for today:
 * passed back in, today stays as it was rather than reshuffling under them
 * the moment a quiz changes a status.
 */
export function buildPlan({
  candidates = [],
  settings,
  mistakes = [],
  adjustments = [],
  keepToday = null,
  horizon = HORIZON_DAYS,
  now = new Date(),
}) {
  const today = startOfDay(now)
  const todayKey = dateKey(today)
  const style = settings.style
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const days = Array.from({ length: horizon }, (_, d) => {
    const date = addDays(today, d)
    const weekday = date.getDay()
    let slots = settings.slots?.[weekday] || null
    let late = false
    /**
     * Today counts only the free time still ahead. Opened at seven, a 4-6pm
     * window has gone, and planning it would put the evening's work in the
     * past. If today's time has all gone, the plan still says what it would
     * have been — without clock times — rather than going blank.
     */
    if (d === 0 && slots) {
      const from = Math.ceil(nowMinute / 5) * 5
      const ahead = normaliseSlots(slots.map(([a, b]) => [Math.max(a, from), b]))
      if (ahead.reduce((n, [a, b]) => n + (b - a), 0) >= MIN_LEFTOVER) slots = ahead
      else late = slots.length > 0
    }
    const minutes = slots ? slots.reduce((n, [a, b]) => n + (b - a), 0) : settings.week[weekday] ?? 0
    // Each window takes its own breaks, so a day of two short windows holds
    // less study than one long one of the same total.
    const study = slots
      ? slots.reduce((n, [a, b]) => n + studyMinutesFor(b - a, style), 0)
      : studyMinutesFor(minutes, style)
    return { date: dateKey(date), weekday, minutes, study, slots, late, tasks: [] }
  })
  const dayIndex = new Map(days.map((d, i) => [d.date, i]))
  const byId = new Map(candidates.map((c) => [c.id, c]))

  const skipped = new Set()
  const doneOn = new Map()
  const placedBy = new Map() // id -> date the student put it on
  for (const a of adjustments) {
    if (a.kind === 'skip') skipped.add(`${a.on_date}|${a.task_id}`)
    if (a.kind === 'done') doneOn.set(a.task_id, a.on_date)
    if ((a.kind === 'move' || a.kind === 'pin') && a.to_date) placedBy.set(a.task_id, a.to_date)
  }

  const used = new Set()
  const place = (i, task, { fixed = false } = {}) => {
    days[i].tasks.push({ ...task, fixed })
    used.add(task.id)
  }
  /** The first day from `i` that has any study time; null past the horizon. */
  const firstOpen = (i) => {
    for (let j = Math.max(0, i); j < days.length; j++) if (days[j].study > 0) return j
    return null
  }

  // Today as already shown, if we have it — minus anything the student has
  // since skipped today or moved to another day, which is the one way today
  // is allowed to change under them.
  if (keepToday?.date === todayKey && Array.isArray(keepToday.tasks)) {
    for (const t of keepToday.tasks) {
      if (skipped.has(`${todayKey}|${t.id}`)) continue
      if (placedBy.has(t.id) && placedBy.get(t.id) !== todayKey) continue
      const fresh = byId.get(t.id)
      place(0, fresh ? { ...t, ...fresh, minutes: t.minutes, kind: t.kind } : t, { fixed: true })
    }
  }

  // The student's own placements.
  for (const [id, to] of placedBy) {
    const i = dayIndex.get(to)
    const task = byId.get(id)
    if (i === undefined || !task || used.has(id)) continue
    place(i, task, { fixed: true })
  }

  // Mistakes on the day they are due back, one review per subject per day.
  const reviews = new Map()
  for (const m of mistakes) {
    if (!m?.subject || !m.next_review_at) continue
    const due = Math.max(0, daysBetween(today, new Date(m.next_review_at)))
    const i = firstOpen(due)
    if (i === null) continue
    const id = `review::${m.subject}::${days[i].date}`
    reviews.set(id, { i, subject: m.subject, count: (reviews.get(id)?.count || 0) + 1 })
  }
  for (const [id, r] of reviews) {
    if (used.has(id)) continue
    place(r.i, {
      id,
      key: id,
      kind: 'review',
      status: null,
      subject: r.subject,
      topic: null,
      subtopic: null,
      minutes: Math.min(20, Math.max(5, round5(r.count * 2))),
      value: Infinity,
      quizzable: true,
      reasons: [{ kind: 'review', label: `${r.count} mistake${r.count === 1 ? '' : 's'} due back` }],
    }, { fixed: true })
  }

  // Everything else, by value, day by day.
  const pool = candidates.filter((c) => !used.has(c.id))
  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    let spent = day.tasks.reduce((n, t) => n + t.minutes, 0)
    const bySubject = new Map()
    for (const t of day.tasks) bySubject.set(t.subject, (bySubject.get(t.subject) || 0) + t.minutes)

    // Focus days take the subjects of the two most valuable things left.
    // Focus days take the subjects the student chose for that weekday, when
    // they chose any that still have work; otherwise the two most valuable.
    let focus = null
    if (style.mix === 'focus') {
      const chosen = (style.focusDays?.[day.weekday] || []).filter((s) =>
        pool.some((c) => c.subject === s && !used.has(c.id))
      )
      if (chosen.length) focus = new Set(chosen)
      else {
        focus = new Set()
        for (const c of pool) {
          if (used.has(c.id) || skipped.has(`${day.date}|${c.id}`)) continue
          focus.add(c.subject)
          if (focus.size === 2) break
        }
      }
    }

    const open = (c) => {
      if (used.has(c.id)) return false
      if (skipped.has(`${day.date}|${c.id}`)) return false
      const done = doneOn.get(c.id)
      if (done && daysBetween(parseDay(done), parseDay(day.date)) < 7) return false
      if (focus && !focus.has(c.subject)) return false
      return true
    }
    const fits = (c, limit = day.study) => {
      if (spent + c.minutes > limit) return false
      if (style.mix === 'mixed') {
        const share = (bySubject.get(c.subject) || 0) + c.minutes
        if (share > Math.max(c.minutes, day.study * 0.5)) return false
      }
      return true
    }
    const take = (c, { first = false } = {}) => {
      place(i, first ? { ...c, first: true } : c)
      spent += c.minutes
      bySubject.set(c.subject, (bySubject.get(c.subject) || 0) + c.minutes)

      // Learned something: check it stuck a few days later.
      if (c.kind === 'learn' && c.quizzable) {
        const j = firstOpen(i + RETEST_AFTER_DAYS)
        if (j !== null) {
          const id = `retest::${c.key}`
          if (!used.has(id)) {
            place(j, {
              ...c,
              id,
              kind: 'retest',
              minutes: RETEST_MINUTES,
              value: c.value,
              reasons: [{ kind: 'retest', label: `Learned on ${WEEKDAYS[days[i].weekday]} — check it stuck` }],
            }, { fixed: true })
          }
        }
      }
    }

    /**
     * Progress before upkeep.
     *
     * Valued purely per hour, a pile of quick fading retests beats one
     * forty-minute weak topic every time, and a day could fill with upkeep
     * while the subject furthest from its target got no actual learning at
     * all. So before anything else, the subjects not yet at target each get
     * their most valuable piece of real learning — furthest behind first, at
     * most two of them, within about sixty per cent of the day — and the rest
     * of the day is then filled by value as before.
     */
    const firstLearn = new Map()
    for (const c of pool) {
      if (c.kind === 'learn' && c.goal >= 1 && open(c) && !firstLearn.has(c.subject)) firstLearn.set(c.subject, c)
    }
    const behind = [...firstLearn.values()].sort((a, b) => b.goal - a.goal || b.value - a.value).slice(0, 2)
    behind.forEach((c, n) => {
      if (day.study - spent < MIN_LEFTOVER) return
      // The subject furthest behind only has to fit in the day. Its own
      // retest or mistakes may already be on it, and the half-a-day rule that
      // keeps subjects mixed must not be what stops it learning anything.
      if (n === 0 ? spent + c.minutes <= day.study : fits(c, Math.floor(day.study * 0.6))) take(c, { first: true })
    })

    for (const c of pool) {
      if (day.study - spent < MIN_LEFTOVER) break
      if (!open(c) || !fits(c)) continue
      take(c)
    }
  }

  for (const day of days) {
    // Mistakes first — short, due, a quick win to start on — then the day's
    // main piece of learning while you are fresh, then the rest, carrying on
    // from whichever subject came last so the join is not a repeat either.
    const opening = [...day.tasks.filter((t) => t.kind === 'review'), ...day.tasks.filter((t) => t.first)]
    const rest = day.tasks.filter((t) => t.kind !== 'review' && !t.first)
    const ordered =
      style.mix === 'mixed'
        ? interleave(rest, opening.at(-1)?.subject ?? null)
        : rest.sort((a, b) => a.subject.localeCompare(b.subject) || b.value - a.value)
    day.tasks = [...opening, ...ordered].map((t) => ({
      ...t,
      steps: stepsFor(t, style),
      done: t.kind !== 'review' && doneOn.get(t.id) === day.date,
    }))
    day.planned = day.tasks.reduce((n, t) => n + t.minutes, 0)
    const r = rhythmOf(style)
    day.breaks = Number.isFinite(r.work) && day.planned > 0 ? Math.floor((day.planned - 1) / r.work) : 0
    day.timeline = day.slots && !day.late ? layoutDay(day.tasks, day.slots, r) : null
    if (day.timeline) day.breaks = day.timeline.filter((x) => x.type === 'break').length
  }

  return {
    days,
    today: days[0],
    unscheduled: candidates.filter((c) => !used.has(c.id)).length,
  }
}

/**
 * The soonest thing the student is working towards: a dated test from the
 * calendar or an exam, whichever comes first.
 */
export function nextDeadline({ events = [], profile, settings, subjects = [], now = new Date() }) {
  const today = startOfDay(now)
  const options = []
  for (const e of events) {
    if (e?.completed) continue
    const days = daysBetween(today, new Date(e.due_at))
    if (days >= 0) options.push({ kind: 'test', title: e.title || 'Test', subject: e.subject || null, days })
  }
  for (const subject of subjects) {
    const exam = examDateFor(subject, profile, settings)
    if (!exam) continue
    const days = daysBetween(today, exam)
    if (days >= 0) options.push({ kind: 'exam', title: `${subject} exam`, subject, days })
  }
  return options.sort((a, b) => a.days - b.days)[0] || null
}
