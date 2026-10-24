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

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, EmptyState, PageLoading, SkeletonActions } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconArrowRight, IconCheck, IconCalendar } from '@/components/Icons'
import TodoList from '@/components/TodoList'
import ResourceHubDrawer from '@/components/ResourceHubDrawer'
import ReminderWatcher from '@/components/ReminderWatcher'
import PlanSettings from '@/components/plan/PlanSettings'
import TodayPlan from '@/components/plan/TodayPlan'
import { getSlugForSubject } from '@/lib/subject-map'
import { displaySubtopic, STATUS_COLORS } from '@/lib/progress'
import { accessibleSubjects, hasAllSubjects } from '@/lib/access'
import { dateKey, WEEKDAYS } from '@/lib/study-plan'
import { readSnapshot, writeSnapshot, snapshotFor, loadPlanInputs, loadBusy, computePlan, isTaskDone } from '@/lib/plan-data'
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  notify,
} from '@/lib/notify'

/** A calendar older than this is refreshed when the plan opens. */
const STALE_MS = 3 * 60 * 60 * 1000
const BLOCKS = (id) => `psyllabus:plan-blocks:${id}`

const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`)

export default function StudyPlanPage() {
  const [profile, setProfile] = useState(null)
  // The calendar write in flight, so a second one waits for it.
  const writingBlocks = useRef(null)
  const [items, setItems] = useState([])
  const [effective, setEffective] = useState({})
  const [details, setDetails] = useState({})
  const [events, setEvents] = useState([])
  const [mistakes, setMistakes] = useState([])
  const [adjustments, setAdjustments] = useState([])
  const [quizzedToday, setQuizzedToday] = useState(() => new Set())
  const [busy, setBusy] = useState([])
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
      const inputs = await loadPlanInputs(supabase, { userId: user.id, profile: profileData, at })

      setProfile(profileData)
      setItems(inputs.items)
      setEffective(inputs.effective)
      setDetails(inputs.details)
      setEvents(inputs.events)
      setMistakes(inputs.mistakes)
      setAdjustments(inputs.adjustments)
      setQuizzedToday(inputs.quizzedToday)
      setBusy(inputs.busy)
      setCovered(inputs.covered)
      setSnapshot(readSnapshot(profileData.id))
      setNow(at)
      setLoading(false)

      // Refresh connected calendars that are getting old, then re-read them.
      // In the background: the plan is already on screen from the last copy.
      const stale = inputs.connections.some(
        (c) => !c.last_synced_at || at.getTime() - new Date(c.last_synced_at).getTime() > STALE_MS
      )
      if (stale) {
        const res = await fetch('/api/calendar/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => null)
        if (res?.ok) setBusy(await loadBusy(supabase, at))
      }
    }
    load()
  }, [router, supabase])

  // Planned the same way the dashboard plans it (lib/plan-data.js).
  const { subjects, settings, configured, topicsBySubject, candidates, plan, deadline } = useMemo(
    () => computePlan({ profile, items, effective, details, events, mistakes, adjustments, busy, covered, snapshot, now }),
    [profile, items, effective, details, events, mistakes, adjustments, busy, covered, snapshot, now]
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
    const snap = snapshotFor(plan, snapshot)
    if (!snap) return
    const keep = () => {
      writeSnapshot(profile.id, snap)
      setSnapshot(snap)
    }
    keep()
  }, [plan, profile, snapshot, configured])

  /**
   * The plan's place in the student's calendar.
   *
   * Every scheduled block with a clock time is written to plan_blocks, which
   * the in-app calendar and the student's phone (through their subscription
   * link) both read. Written only when the blocks have actually changed, and
   * only from today on, so earlier days keep what was planned for them.
   */
  useEffect(() => {
    if (!plan || !profile || !configured) return
    const rows = []
    for (const d of plan.days) {
      if (!d.timeline) continue
      const [y, m, dd] = d.date.split('-').map(Number)
      for (const t of d.tasks) {
        if (t.start == null || t.overflow) continue
        rows.push({
          day: d.date,
          starts_at: new Date(y, m - 1, dd, 0, t.start).toISOString(),
          ends_at: new Date(y, m - 1, dd, 0, t.end).toISOString(),
          title: t.kind === 'review' ? `Mistakes due back: ${t.subject}` : `${t.subject}: ${displaySubtopic(t.subtopic)}`,
          subject: t.subject,
          kind: t.kind,
        })
      }
    }
    const signature = JSON.stringify(rows)
    let previous = null
    try {
      previous = localStorage.getItem(BLOCKS(profile.id))
    } catch {
      /* write anyway */
    }
    if (previous === signature) return
    // One write at a time from this tab, and a block that is already there
    // is skipped rather than added twice (076-plan-blocks-once.sql), so two
    // writes racing can no longer double every block.
    const write = async () => {
      if (writingBlocks.current) await writingBlocks.current
      const { error } = await supabase.from('plan_blocks').delete().gte('day', plan.days[0].date)
      if (error) return
      if (rows.length && (await supabase.from('plan_blocks').upsert(rows, { onConflict: 'user_id,starts_at,ends_at,title', ignoreDuplicates: true })).error) return
      try {
        localStorage.setItem(BLOCKS(profile.id), signature)
      } catch {
        /* rewritten next time, harmlessly */
      }
    }
    writingBlocks.current = write().finally(() => {
      writingBlocks.current = null
    })
  }, [plan, profile, configured, supabase])

  // The student's time zone, so their subscribed calendar puts all-day tests
  // on their date. Saved once, and again only if they move.
  useEffect(() => {
    if (!profile || !configured) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz || profile.plan_settings?.tz === tz) return
    const save = async () => {
      const plan_settings = { ...profile.plan_settings, tz }
      const { error } = await supabase.from('profiles').update({ plan_settings }).eq('id', profile.id)
      if (!error) setProfile((p) => ({ ...p, plan_settings }))
    }
    save()
  }, [profile, configured, supabase])

  const replanToday = useCallback(() => {
    if (!profile) return
    writeSnapshot(profile.id, null)
    setSnapshot(null)
  }, [profile])

  const isDone = useCallback((task) => isTaskDone(task, { mistakes, quizzedToday, now }), [mistakes, quizzedToday, now])

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
        <PageLoading title="Study Plan" action={<SkeletonActions widths={[118, 98]} />} rows={5} variant="plan" />
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
          <div className="mb-8 flex items-center justify-between gap-4 rounded-[12px] border px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Reminders before tests and when a block ends
            </p>
            <button onClick={enableNotifications} className="shrink-0 text-[13px] font-medium text-[var(--brand)] hover:underline">
              Turn on
            </button>
          </div>
        )}

        {(!configured || editing) && <div className="mb-10">{settingsPanel}</div>}

        {configured && candidates.length === 0 && plan.days[0].tasks.length === 0 ? (
          <EmptyState
            title={items.length ? 'Nothing left to plan' : 'Take a quiz to build your plan'}
            description={items.length ? 'Everything you have covered is mastered.' : 'Take one quiz and your plan builds itself.'}
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

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[13px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    {tomorrow && (
                      <p className="tabular-nums">
                        <span style={{ color: 'var(--text-body)' }}>Tomorrow</span> ·{' '}
                        {tomorrow.minutes === 0
                          ? 'day off'
                          : tomorrow.tasks.length
                            ? `${fmt(tomorrow.planned)} · ${[...new Set(tomorrow.tasks.map((t) => t.subject.replace(/ (SL|HL)$/, '')))].join(', ')}`
                            : 'nothing yet'}
                      </p>
                    )}
                    <button type="button" onClick={replanToday} className="font-medium text-[var(--brand)] hover:underline">
                      Re-plan today
                    </button>
                  </div>

                  {/* The evening's other half: everything that is not a subtopic. */}
                  <TodoList className="mb-12 mt-12" title="Also today" subjects={accessibleSubjects(profile)} />

                  {events.length === 0 && (
                    <Link href="/dashboard/calendar" className="flex items-center gap-3 border-t py-4 text-[14px] font-medium" style={{ borderColor: 'var(--border)' }}>
                      <IconCalendar width={16} height={16} className="shrink-0 text-[var(--brand)]" />
                      <span className="flex-1">Add your next test</span>
                      <IconArrowRight width={16} height={16} className="shrink-0 text-[var(--brand)]" />
                    </Link>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-8">
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    Most marks per hour first{plan.unscheduled > 0 ? ` · ${plan.unscheduled} don't fit the next two weeks` : ''}
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
                  <span className="text-[13px] text-[var(--text-body)]">Free plan: one subject. Unlock the rest with a school code.</span>
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
