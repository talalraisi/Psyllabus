'use client'

/**
 * The study plan.
 *
 * What to study, on which day, and for how long — planned by lib/study-plan.js
 * from what the student has proved, how far each subject is from its target,
 * what is dated on their calendar, and how they have said they like to work.
 * This page loads that evidence, keeps today steady once it has been shown,
 * and records the student's own edits, which always win over the plan.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, EmptyState, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconArrowRight, IconCheck, IconCalendar } from '@/components/Icons'
import TodoList from '@/components/TodoList'
import ResourceHubDrawer from '@/components/ResourceHubDrawer'
import ReminderWatcher from '@/components/ReminderWatcher'
import PlanSettings from '@/components/plan/PlanSettings'
import TodayPlan from '@/components/plan/TodayPlan'
import { getSlugForSubject } from '@/lib/subject-map'
import { progressKey, displaySubtopic, STATUS_COLORS } from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { predictSubject } from '@/lib/prediction'
import { accessibleSubjects, hasAllSubjects } from '@/lib/access'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { getCoveredSubtopics } from '@/lib/coverage'
import { resolveSettings, buildCandidates, buildPlan, nextDeadline, dateKey, WEEKDAYS } from '@/lib/study-plan'
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  notify,
} from '@/lib/notify'

const SNAPSHOT = (id) => `psyllabus:plan-today:${id}`

function readSnapshot(id) {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT(id)) || 'null')
  } catch {
    return null
  }
}

function writeSnapshot(id, snap) {
  try {
    if (snap) localStorage.setItem(SNAPSHOT(id), JSON.stringify(snap))
    else localStorage.removeItem(SNAPSHOT(id))
  } catch {
    /* today will simply re-plan on the next visit */
  }
}

const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`)

export default function StudyPlanPage() {
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [effective, setEffective] = useState({})
  const [details, setDetails] = useState({})
  const [events, setEvents] = useState([])
  const [mistakes, setMistakes] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [quizzedToday, setQuizzedToday] = useState(() => new Set())
  const [covered, setCovered] = useState(null)
  const [now, setNow] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [view, setView] = useState('today')
  const [editing, setEditing] = useState(false)
  const [drawerItem, setDrawerItem] = useState(null)
  const [permission, setPermission] = useState('default')
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight.
  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])

  useEffect(() => {
    const read = () => setPermission(notificationPermission())
    read()
  }, [])

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })
      if (!profileData) {
        router.push('/onboarding')
        return
      }

      // Read once, on the client: "today" is the student's day, not the
      // server's, and reading the clock while rendering would be impure.
      const at = new Date()
      const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate())
      const weekAgo = dateKey(new Date(at.getFullYear(), at.getMonth(), at.getDate() - 7))
      const horizonEnd = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 15).toISOString()

      // Free accounts plan only against the subject they can actually open.
      const usable = accessibleSubjects(profileData)

      const [syllabusRows, { data: progressRows }, mistakesResult, eventsResult, adjustmentsResult, todayResult] =
        await Promise.all([
          getSyllabus(supabase, usable),
          supabase.from('progress').select('*').eq('user_id', user.id),
          supabase.from('mistakes').select('subject, next_review_at').eq('user_id', user.id).lte('next_review_at', horizonEnd),
          supabase.from('calendar_events').select('*').eq('user_id', user.id).eq('completed', false),
          supabase.from('plan_adjustments').select('task_id, kind, on_date, to_date').eq('user_id', user.id).gte('on_date', weekAgo),
          // What was quizzed today: finishing a task's quiz is what marks it done.
          supabase.from('quiz_attempts').select('subject, subtopic').eq('user_id', user.id).gte('completed_at', midnight.toISOString()),
        ])

      const eff = buildEffectiveProgressMap(progressRows)
      setProfile(profileData)
      setItems(
        (syllabusRows || []).map((row) => ({ ...row, status: eff[progressKey(row.subject, row.subtopic)] || 'not_started' }))
      )
      setEffective(eff)
      setDetails(buildProgressDetailMap(progressRows))
      setEvents(eventsResult?.data || [])
      setMistakes(mistakesResult?.data || [])
      setAdjustments(adjustmentsResult?.data || [])
      setQuizzedToday(new Set((todayResult?.data || []).filter((a) => a.subtopic).map((a) => progressKey(a.subject, a.subtopic))))
      setCovered(await getCoveredSubtopics(supabase))
      setSnapshot(readSnapshot(profileData.id))
      setNow(at)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  /**
   * The examined subjects. TOK, the Extended Essay and CAS are coursework and
   * service, not syllabuses to be tested topic by topic: an "Extended Essay
   * exam in 560 days" countdown is wrong, and so is a plan sending you to quiz
   * CAS. Left out here as they are from the predicted total.
   */
  const subjects = useMemo(
    () => accessibleSubjects(profile).filter((s) => !IB_CORE_SUBJECTS.includes(s)),
    [profile]
  )
  const planItems = useMemo(() => items.filter((i) => subjects.includes(i.subject)), [items, subjects])
  const settings = useMemo(() => resolveSettings(profile), [profile])
  const configured = Boolean(profile?.plan_settings && Object.keys(profile.plan_settings).length)

  const { predicted, sizes, topicsBySubject } = useMemo(() => {
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
    return { predicted, sizes, topicsBySubject }
  }, [subjects, items, effective, profile])

  const candidates = useMemo(
    () =>
      now
        ? buildCandidates({ items: planItems, details, profile, settings, predicted, subjectSizes: sizes, events, covered, now })
        : [],
    [now, planItems, details, profile, settings, predicted, sizes, events, covered]
  )

  const plan = useMemo(
    () => (now ? buildPlan({ candidates, settings, mistakes, adjustments, keepToday: snapshot, now }) : null),
    [now, candidates, settings, mistakes, adjustments, snapshot]
  )

  const deadline = useMemo(
    () => (now ? nextDeadline({ events, profile, settings, subjects, now }) : null),
    [now, events, profile, settings, subjects]
  )

  /**
   * Today, once shown, stays as shown.
   *
   * Without this the plan would reshuffle under the student the moment a quiz
   * moved a status — finish the first task and the second one changes. The
   * first plan of the day is kept, per device, and only the student's own
   * skips, moves and pins change it until tomorrow or until they ask.
   */
  useEffect(() => {
    if (!plan || !profile || !configured) return
    const today = plan.days[0]
    if (snapshot?.date === today.date) return
    const keep = () => {
      const snap = { date: today.date, tasks: today.tasks.map(({ steps, done, ...t }) => t) }
      writeSnapshot(profile.id, snap)
      setSnapshot(snap)
    }
    keep()
  }, [plan, profile, snapshot, configured])

  const replanToday = useCallback(() => {
    if (!profile) return
    writeSnapshot(profile.id, null)
    setSnapshot(null)
  }, [profile])

  const isDone = useCallback(
    (task) => {
      if (task.kind === 'review') {
        const end = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : null
        return !mistakes.some((m) => m.subject === task.subject && end && new Date(m.next_review_at) < end)
      }
      if (task.done) return true
      return task.quizzable && quizzedToday.has(task.key)
    },
    [mistakes, quizzedToday, now]
  )

  const quizHref = (task) =>
    `/dashboard/quiz?subject=${encodeURIComponent(task.subject)}&topic=${encodeURIComponent(task.topic)}&subtopic=${encodeURIComponent(task.subtopic)}&back=/dashboard/study-plan`
  const hrefFor = (task) =>
    task.kind === 'review' ? '/dashboard/mistakes' : task.quizzable && task.subtopic ? quizHref(task) : null

  /**
   * The student's edits. Shown at once, saved behind, put back if the save
   * fails — an edit that silently did not stick is worse than one refused.
   */
  const adjust = useCallback(
    async (task, kind, toDate = null) => {
      if (!plan) return
      const today = plan.days[0].date
      const before = adjustments
      let next = adjustments
      let undo = null

      if (kind === 'undone') {
        next = adjustments.filter((a) => !(a.task_id === task.id && a.kind === 'done' && a.on_date === today))
      } else {
        const row = { task_id: task.id, kind, on_date: today, to_date: kind === 'move' ? toDate : null }
        // One edit of each kind per task per day: a second move replaces the first.
        next = [...adjustments.filter((a) => !(a.task_id === task.id && a.kind === kind && a.on_date === today)), row]
        if (kind === 'skip' || kind === 'move') undo = { task, kind }
      }
      setAdjustments(next)

      const del = supabase.from('plan_adjustments').delete().eq('task_id', task.id).eq('on_date', today)
      const kindToClear = kind === 'undone' ? 'done' : kind
      const { error: e1 } = await del.eq('kind', kindToClear)
      let e2 = null
      if (kind !== 'undone') {
        ;({ error: e2 } = await supabase
          .from('plan_adjustments')
          .insert({ task_id: task.id, kind, on_date: today, to_date: kind === 'move' ? toDate : null }))
      }
      if (e1 || e2) {
        setAdjustments(before)
        setNotice({ text: 'That change did not save. Check your connection and try again.' })
        return
      }
      if (undo) {
        const when =
          kind === 'skip'
            ? 'Skipped for today'
            : toDate === plan.days[1]?.date
              ? 'Moved to tomorrow'
              : `Moved to ${WEEKDAYS[new Date(`${toDate}T00:00`).getDay()]} ${toDate.slice(8)}`
        setNotice({ text: when, undo })
      } else setNotice(null)
    },
    [plan, adjustments, supabase]
  )

  const undoLast = async () => {
    if (!notice?.undo || !plan) return
    const { task, kind } = notice.undo
    const today = plan.days[0].date
    const before = adjustments
    setAdjustments(adjustments.filter((a) => !(a.task_id === task.id && a.kind === kind && a.on_date === today)))
    setNotice(null)
    // Back into today where it was, since the snapshot dropped it.
    if (snapshot?.date === today && !snapshot.tasks.some((t) => t.id === task.id)) {
      const { steps, done, ...t } = task
      const snap = { ...snapshot, tasks: [...snapshot.tasks, t] }
      writeSnapshot(profile.id, snap)
      setSnapshot(snap)
    }
    const { error } = await supabase.from('plan_adjustments').delete().eq('task_id', task.id).eq('kind', kind).eq('on_date', today)
    if (error) setAdjustments(before)
  }

  const enableNotifications = async () => {
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === 'granted') {
      notify('Reminders are on', {
        body: 'Project Syllabus will alert you before tests and when a study block ends.',
        tag: 'psyllabus-enabled',
      })
    }
  }

  if (loading || !plan) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Study Plan" width="default" rows={5} variant="plan" />
      </DashboardLayout>
    )
  }

  const tomorrow = plan.days[1]
  const settingsPanel = (
    <PlanSettings
      profile={profile}
      settings={settings}
      subjects={subjects}
      topicsBySubject={topicsBySubject}
      firstTime={!configured}
      onClose={() => setEditing(false)}
      onSaved={(plan_settings) => {
        setProfile((p) => ({ ...p, plan_settings }))
        setEditing(false)
        replanToday()
      }}
    />
  )

  const countdown = deadline
    ? deadline.days === 0
      ? `${deadline.title} today`
      : `${deadline.title} in ${deadline.days} day${deadline.days === 1 ? '' : 's'}`
    : `${candidates.length} subtopic${candidates.length === 1 ? '' : 's'} still to secure`

  return (
    <DashboardLayout profile={profile}>
      <ReminderWatcher events={events} />
      <Page width="default">
        <PageHeader
          title="Study Plan"
          subtitle={countdown}
          action={
            <div className="flex flex-wrap gap-2">
              {configured && (
                <button type="button" onClick={() => setEditing((v) => !v)} className="btn btn-outline control-md" aria-expanded={editing}>
                  How I study
                </button>
              )}
              <Link href="/dashboard/calendar" className="btn btn-outline control-md">
                Calendar
              </Link>
            </div>
          }
        />

        {notificationsSupported() && permission === 'default' && configured && (
          <div className="mb-8 flex flex-wrap items-center gap-4 border-l-2 pl-4" style={{ borderColor: 'var(--border-strong)' }}>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-medium">Turn on reminders</p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Alerts before tests and deadlines, and when a block ends. They need the app open.
              </p>
            </div>
            <button onClick={enableNotifications} className="btn btn-solid control-sm shrink-0 text-xs">
              Allow notifications
            </button>
          </div>
        )}

        {(!configured || editing) && <div className="mb-10">{settingsPanel}</div>}

        {configured && candidates.length === 0 && plan.days[0].tasks.length === 0 ? (
          <EmptyState
            title={items.length ? 'Nothing left to plan' : 'Take a quiz to build your plan'}
            description={
              items.length
                ? 'Everything you have been taught is mastered. Keep testing to hold it there, or move "Where your classes are" on as you learn new topics.'
                : 'The plan is built from what you have proved. It needs one quiz to start.'
            }
            action={
              <Link href="/dashboard/subjects" className="btn btn-solid control-md">
                Open a subject
              </Link>
            }
          />
        ) : (
          configured && (
            <>
              <div className="mb-8 flex flex-wrap gap-2">
                {[
                  ['today', 'Today'],
                  ['all', 'Everything left'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    aria-pressed={view === key}
                    className={view === key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {view === 'today' ? (
                <>
                  <TodayPlan
                    day={plan.days[0]}
                    tomorrowKey={tomorrow?.date}
                    style={settings.style}
                    isDone={isDone}
                    hrefFor={hrefFor}
                    onResources={setDrawerItem}
                    onAdjust={adjust}
                  />

                  {notice && (
                    <div
                      role="status"
                      className="mt-4 flex items-center justify-between gap-3 rounded-[12px] border px-4 py-2.5 text-[13px]"
                      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }}
                    >
                      <span>{notice.text}</span>
                      {notice.undo && (
                        <button type="button" onClick={undoLast} className="font-medium text-[var(--brand)] hover:underline">
                          Undo
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {tomorrow && (
                      <p>
                        <span className="font-medium" style={{ color: 'var(--text-body)' }}>
                          Tomorrow, {WEEKDAYS[tomorrow.weekday]}:
                        </span>{' '}
                        {tomorrow.minutes === 0
                          ? 'a day off'
                          : tomorrow.tasks.length
                            ? `${tomorrow.tasks.length} task${tomorrow.tasks.length === 1 ? '' : 's'}, ${fmt(tomorrow.planned)} — ${[...new Set(tomorrow.tasks.map((t) => t.subject))].join(', ')}`
                            : 'nothing planned yet'}
                      </p>
                    )}
                    <button type="button" onClick={replanToday} className="font-medium text-[var(--brand)] hover:underline">
                      Re-plan today
                    </button>
                  </div>

                  {/* The evening's other half: everything that is not a subtopic. */}
                  <TodoList className="mb-12 mt-12" title="Also today" subjects={accessibleSubjects(profile)} />

                  {events.length === 0 && (
                    <Link href="/dashboard/calendar" className="group flex items-center gap-4 border-t py-5" style={{ borderColor: 'var(--border)' }}>
                      <IconCalendar width={17} height={17} className="shrink-0 text-[var(--brand)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold tracking-[-0.012em]">Add your next test</p>
                        <p className="mt-1 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                          With a date on the calendar, the plan puts that subject first as it gets close.
                        </p>
                      </div>
                      <IconArrowRight width={18} height={18} className="shrink-0 text-[var(--brand)]" />
                    </Link>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-8">
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Everything still to do, most marks per hour first. {plan.unscheduled > 0 && `${plan.unscheduled} of these do not fit in the next two weeks at the time you have set.`}
                  </p>
                  {subjects.map((subject) => {
                    const left = candidates.filter((c) => c.subject === subject)
                    if (!left.length) return null
                    return (
                      <section key={subject}>
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <h2 className="t-overline">
                            {subject} · {left.length} left · about {fmt(left.reduce((n, c) => n + c.minutes, 0))}
                          </h2>
                          <Link href={`/dashboard/syllabus/${getSlugForSubject(subject)}`} className="text-sm font-medium text-[var(--brand)] hover:underline">
                            Open syllabus
                          </Link>
                        </div>
                        <ul className="flex flex-col">
                          {left.slice(0, 12).map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-3 border-b px-1 py-3 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[c.status]}`} aria-hidden="true" />
                              <div className="min-w-[10rem] flex-1">
                                <p className="t-caption truncate">{c.topic}</p>
                                <p className="truncate text-sm text-[var(--text-body)]">{displaySubtopic(c.subtopic)}</p>
                              </div>
                              <span className="hidden shrink-0 text-xs tabular-nums sm:block" style={{ color: 'var(--text-faint)' }}>
                                {c.minutes} min
                              </span>
                              <button onClick={() => setDrawerItem(c)} className="btn btn-quiet control-sm">
                                Resources
                              </button>
                              {c.quizzable && (
                                <Link href={quizHref(c)} className="btn btn-outline control-sm">
                                  Practise
                                </Link>
                              )}
                            </li>
                          ))}
                        </ul>
                        {left.length > 12 && <p className="t-caption mt-2">Showing the 12 worth the most of {left.length}.</p>}
                      </section>
                    )
                  })}
                </div>
              )}

              {!hasAllSubjects(profile) && (profile.subjects || []).length > 1 && (
                <Link href="/dashboard/profile#unlock" className="mt-10 flex items-center gap-3 border-l-2 pl-4" style={{ borderColor: 'var(--border-strong)' }}>
                  <IconCheck width={16} height={16} className="shrink-0 text-[var(--brand)]" />
                  <span className="text-sm text-[var(--text-body)]">
                    This plan covers one subject on the free plan. Unlock the rest with your school code.
                  </span>
                </Link>
              )}
            </>
          )
        )}

        <ResourceHubDrawer
          open={!!drawerItem}
          onClose={() => setDrawerItem(null)}
          subject={drawerItem?.subject}
          topic={drawerItem?.topic}
          subtopic={drawerItem?.subtopic}
          hlOnly={drawerItem?.hl_only}
          quizHref={drawerItem && drawerItem.quizzable && drawerItem.subtopic ? quizHref(drawerItem) : null}
        />
      </Page>
    </DashboardLayout>
  )
}
