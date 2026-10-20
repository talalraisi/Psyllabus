/**
 * Everything the study plan needs, loaded and planned in one place.
 *
 * The study plan page and the dashboard both say what to study next. When
 * they each worked it out their own way (the dashboard on lib/planner.js)
 * they could disagree, and a student told two different "next" things by
 * the same app trusts neither. Both now load through here and plan through
 * here, and the dashboard reads the same day the plan page keeps.
 */

import { getSyllabus } from '@/lib/cache'
import { progressKey } from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { predictSubject } from '@/lib/prediction'
import { accessibleSubjects } from '@/lib/access'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { getCoveredSubtopics } from '@/lib/coverage'
import { resolveSettings, buildCandidates, buildPlan, nextDeadline, dateKey } from '@/lib/study-plan'

/* ---------- Today, kept as first shown ---------- */

const SNAPSHOT = (id) => `psyllabus:plan-today:${id}`

export function readSnapshot(id) {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT(id)) || 'null')
  } catch {
    return null
  }
}

export function writeSnapshot(id, snap) {
  try {
    if (snap) localStorage.setItem(SNAPSHOT(id), JSON.stringify(snap))
    else localStorage.removeItem(SNAPSHOT(id))
  } catch {
    /* today will simply re-plan on the next visit */
  }
}

/** The snapshot to keep for today's plan, or null if the one held is current. */
export function snapshotFor(plan, held) {
  const today = plan?.days?.[0]
  if (!today || held?.date === today.date) return null
  return { date: today.date, tasks: today.tasks.map(({ steps, done, ...t }) => t) }
}

/** Timed, busy events from the student's own calendars, as the engine wants them. */
export const toBusy = (rows) =>
  (rows || []).filter((r) => !r.all_day && !r.transparent).map((r) => ({ start: r.starts_at, end: r.ends_at }))

/* ---------- Loading ---------- */

/**
 * Read what the plan is made from. `at` is the student's now, read once on
 * the client. `progressRows` and `events` can be passed in by a page that has
 * already fetched them, so nothing is read twice.
 */
export async function loadPlanInputs(supabase, { userId, profile, at, progressRows, events }) {
  const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate())
  const weekAgo = dateKey(new Date(at.getFullYear(), at.getMonth(), at.getDate() - 7))
  const horizonEnd = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 15).toISOString()

  // Free accounts plan only against the subject they can actually open.
  const usable = accessibleSubjects(profile)

  const [syllabusRows, progressResult, mistakesResult, eventsResult, adjustmentsResult, todayResult, busyResult, connectionsResult, covered] =
    await Promise.all([
      getSyllabus(supabase, usable),
      progressRows ? { data: progressRows } : supabase.from('progress').select('*').eq('user_id', userId),
      supabase.from('mistakes').select('subject, next_review_at').eq('user_id', userId).lte('next_review_at', horizonEnd),
      events ? { data: events } : supabase.from('calendar_events').select('*').eq('user_id', userId).eq('completed', false),
      supabase.from('plan_adjustments').select('task_id, kind, on_date, to_date').eq('user_id', userId).gte('on_date', weekAgo),
      // What was quizzed today: finishing a task's quiz is what marks it done.
      supabase.from('quiz_attempts').select('subject, subtopic').eq('user_id', userId).gte('completed_at', midnight.toISOString()),
      // The student's own calendars: busy time comes out of their free time.
      supabase
        .from('calendar_busy')
        .select('starts_at, ends_at, all_day, transparent')
        .gte('ends_at', midnight.toISOString())
        .lte('starts_at', horizonEnd),
      supabase.from('calendar_connections').select('id, last_synced_at'),
      getCoveredSubtopics(supabase),
    ])

  const rows = progressResult?.data || []
  const effective = buildEffectiveProgressMap(rows)
  return {
    items: (syllabusRows || []).map((row) => ({ ...row, status: effective[progressKey(row.subject, row.subtopic)] || 'not_started' })),
    effective,
    details: buildProgressDetailMap(rows),
    events: eventsResult?.data || [],
    mistakes: mistakesResult?.data || [],
    adjustments: adjustmentsResult?.data || [],
    quizzedToday: new Set((todayResult?.data || []).filter((a) => a.subtopic).map((a) => progressKey(a.subject, a.subtopic))),
    busy: toBusy(busyResult?.data),
    connections: connectionsResult?.data || [],
    covered,
  }
}

/** Re-read the student's own calendars after a sync. */
export async function loadBusy(supabase, at) {
  const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate())
  const horizonEnd = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 15).toISOString()
  const { data } = await supabase
    .from('calendar_busy')
    .select('starts_at, ends_at, all_day, transparent')
    .gte('ends_at', midnight.toISOString())
    .lte('starts_at', horizonEnd)
  return toBusy(data)
}

/* ---------- Planning ---------- */

/**
 * The examined subjects. TOK and the Extended Essay are coursework and
 * service, not syllabuses to be tested topic by topic, so they are left out
 * here as they are from the predicted total.
 */
export const planSubjects = (profile) => accessibleSubjects(profile).filter((s) => !IB_CORE_SUBJECTS.includes(s))

/** From loaded inputs to the plan, the same way wherever it is shown. */
export function computePlan({ profile, items, effective, details, events, mistakes, adjustments, busy, covered, snapshot, now }) {
  const subjects = planSubjects(profile)
  const settings = resolveSettings(profile)
  const configured = Boolean(profile?.plan_settings && Object.keys(profile.plan_settings).length)
  const planItems = items.filter((i) => subjects.includes(i.subject))

  const predicted = {}
  const sizes = {}
  const topicsBySubject = {}
  for (const subject of subjects) {
    const rows = items.filter((r) => r.subject === subject)
    sizes[subject] = rows.length
    predicted[subject] = predictSubject(subject, rows, effective, profile?.curriculum).grade
    const firstAt = new Map()
    for (const r of rows) if (!firstAt.has(r.topic) || (r.position ?? 0) < firstAt.get(r.topic)) firstAt.set(r.topic, r.position ?? 0)
    topicsBySubject[subject] = [...firstAt].sort((a, b) => a[1] - b[1]).map(([t]) => t)
  }

  if (!now) return { subjects, settings, configured, predicted, sizes, topicsBySubject, candidates: [], plan: null, deadline: null }

  const candidates = buildCandidates({ items: planItems, details, profile, settings, predicted, subjectSizes: sizes, events, covered, now })
  const plan = buildPlan({ candidates, settings, mistakes, adjustments, keepToday: snapshot, busy, now })
  const deadline = nextDeadline({ events, profile, settings, subjects, now })
  return { subjects, settings, configured, predicted, sizes, topicsBySubject, candidates, plan, deadline }
}

/** Whether a task on today's plan has been done. */
export function isTaskDone(task, { mistakes, quizzedToday, now }) {
  if (task.kind === 'review') {
    const end = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : null
    return !mistakes.some((m) => m.subject === task.subject && end && new Date(m.next_review_at) < end)
  }
  if (task.done) return true
  return Boolean(task.quizzable && quizzedToday.has(task.key))
}
