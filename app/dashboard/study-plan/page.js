'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus, invalidateProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, EmptyState, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconArrowRight, IconClock, IconCheck, IconCalendar } from '@/components/Icons'
import SessionTimer from '@/components/SessionTimer'
import TodoList from '@/components/TodoList'
import ResourceHubDrawer from '@/components/ResourceHubDrawer'
import ReminderWatcher from '@/components/ReminderWatcher'
import { getSlugForSubject } from '@/lib/subject-map'
import {
  progressKey,
  computeCompletionPercent,
  STATUS_COLORS,
  STATUS_LABELS,
  displaySubtopic,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { buildQueue, buildSession, groupBySubjectRanked } from '@/lib/planner'
import { accessibleSubjects, isPremium } from '@/lib/access'
import { upcoming, relativeDay, KIND_LABEL, KIND_DOT } from '@/lib/calendar'
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  notify,
} from '@/lib/notify'

// Below this there is no session to plan: one subtopic costs about 22 minutes,
// so a five-minute block could only ever promise something it cannot deliver.
const MIN_MINUTES = 15
// Eight hours. Past that it is not a study session, it is a whole day, and the
// queue would be padded with subtopics nobody is getting to.
const MAX_MINUTES = 480

const REASON_STYLE = {
  weak: 'text-[var(--status-weak)]',
  decaying: 'text-[var(--status-fading)]',
  shaky: 'text-[var(--status-developing)]',
  proficient: 'text-[var(--status-proficient)]',
  untested: 'text-[var(--text-faint)]',
  foundation: 'text-[var(--brand)]',
  exam: 'text-[var(--status-weak)]',
  event: 'text-[var(--status-weak)] font-medium',
}

export default function StudyPlanPage() {
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [details, setDetails] = useState({})
  const [mastery, setMastery] = useState({})
  const [events, setEvents] = useState([])
  const [dueReviews, setDueReviews] = useState(0)
  const [minutes, setMinutes] = useState(40)
  const [minutesInput, setMinutesInput] = useState('40')
  const [done, setDone] = useState(() => new Set())
  const [view, setView] = useState('today')
  const [drawerItem, setDrawerItem] = useState(null)
  const [permission, setPermission] = useState('default')
  const [loading, setLoading] = useState(true)

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight. A page that has arrived but has no data yet is the
  // part that feels broken.
  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setPermission(notificationPermission())
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
      setProfile(profileData)

      const saved = parseInt(profileData.session_minutes, 10)
      if (!Number.isNaN(saved)) {
        setMinutes(saved)
        setMinutesInput(String(saved))
      }

      // Free accounts plan only against the subject they can actually open.
      const usable = accessibleSubjects(profileData)

      const [syllabusRows, { data: progressRows }, { count: due }, eventsResult] =
        await Promise.all([
          getSyllabus(supabase, usable),
          supabase.from('progress').select('*').eq('user_id', user.id),
          supabase
            .from('mistakes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .lte('next_review_at', new Date().toISOString()),
          // The calendar table only exists after migration 012; a missing table
          // must not take the whole plan down.
          supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', user.id)
            .eq('completed', false),
        ])

      const effective = buildEffectiveProgressMap(progressRows)
      const merged = (syllabusRows || []).map((row) => ({
        ...row,
        status: effective[progressKey(row.subject, row.subtopic)] || 'not_started',
      }))

      const perSubject = {}
      for (const subject of usable) {
        perSubject[subject] = computeCompletionPercent(
          merged.filter((r) => r.subject === subject),
          effective,
          subject
        )
      }

      setItems(merged)
      setDetails(buildProgressDetailMap(progressRows))
      setMastery(perSubject)
      setEvents(eventsResult?.data || [])
      setDueReviews(due || 0)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const queue = useMemo(
    () => buildQueue({ items, details, subjectMastery: mastery, profile, events }),
    [items, details, mastery, profile, events]
  )

  const session = useMemo(() => buildSession(queue, { minutes }), [queue, minutes])
  const grouped = useMemo(() => groupBySubjectRanked(queue), [queue])
  const nextEvents = useMemo(() => upcoming(events).slice(0, 3), [events])

  /** Persist the chosen block length so the next session opens the same way. */
  const commitMinutes = useCallback(
    async (value) => {
      const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, value))
      setMinutes(clamped)
      setMinutesInput(String(clamped))
      const user = await getCurrentUser(supabase)
      if (!user) return
      await supabase.from('profiles').update({ session_minutes: clamped }).eq('id', user.id)
      invalidateProfile(user.id)
    },
    [supabase]
  )

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

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Study Plan" width="default" rows={5} variant="plan" />
      </DashboardLayout>
    )
  }

  const remaining = session.items.filter((i) => !done.has(i.id))
  const completedCount = session.items.length - remaining.length
  const sessionComplete = session.items.length > 0 && remaining.length === 0

  const quizHref = (item) =>
    `/dashboard/quiz?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}&subtopic=${encodeURIComponent(item.subtopic)}&back=/dashboard/study-plan`

  const toggleDone = (id) =>
    setDone((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <DashboardLayout profile={profile}>
      <ReminderWatcher events={events} />
      <Page width="default">
        <PageHeader
          title="Study Plan"
          subtitle={`${queue.length} subtopic${queue.length === 1 ? '' : 's'} still to secure`}
          action={
            <Link href="/dashboard/calendar" className="btn btn-outline control-md">
              Calendar
            </Link>
          }
        />

        {/* What is actually coming up */}
        {nextEvents.length > 0 && (
          <ul className="mb-10 flex flex-col">
            {nextEvents.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 border-b py-3 last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[event.kind]}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="t-caption truncate">
                    {KIND_LABEL[event.kind]}
                    {event.subject ? ` · ${event.subject}` : ''}
                  </p>
                  <p className="truncate text-[14.5px] font-medium">{event.title}</p>
                </div>
                <span className="t-caption shrink-0">{relativeDay(event.due_at)}</span>
              </li>
            ))}
          </ul>
        )}

        {notificationsSupported() && permission === 'default' && (
          <div
            className="mb-10 flex flex-wrap items-center gap-4 border-l-2 pl-4"
            style={{ borderColor: 'var(--border-strong)' }}
          >
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

        {queue.length === 0 ? (
          <EmptyState
            title={items.length ? 'Everything is mastered' : 'Take a quiz to build your plan'}
            description={
              items.length
                ? 'Nothing is weak or decaying right now. Keep testing to hold it there.'
                : 'The planner ranks subtopics by what you got wrong, what is decaying, what a test is coming up on, and what unlocks later work. It needs one quiz to start.'
            }
            action={
              <Link href="/dashboard/subjects" className="btn btn-solid control-md">
                Open a subject
              </Link>
            }
          />
        ) : (
          <>
            {/* View switch */}
            <div className="mb-8 flex flex-wrap gap-2">
              {[
                ['today', "Today's session"],
                ['all', 'Full priority list'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  className={`${view === key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === 'today' ? (
              <>
                <div className="mb-10">
                  {/* The plan for tonight, as a card: what it is, how long it
                      takes, how far through you are. The controls sit inside
                      it, because "how long have I got" is part of the plan
                      rather than a setting about it. */}
                  <div
                    className="mb-8 rounded-[16px] border p-6"
                    style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
                          {sessionComplete ? 'Session complete' : 'Tonight'}
                        </p>
                        <h2 className="mt-2 text-[clamp(1.25rem,2.4vw,1.6rem)] font-semibold leading-tight tracking-[-0.025em]">
                          {sessionComplete
                            ? 'Everything planned is done'
                            : `${session.items.length} subtopic${session.items.length === 1 ? '' : 's'}, about ${minutes} minutes`}
                        </h2>
                        <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                          {completedCount > 0
                            ? `${completedCount} of ${session.items.length} done · about ${session.perItemMinutes} minutes each`
                            : `About ${session.perItemMinutes} minutes each: read it, sit the quiz, go back over what you missed.`}
                        </p>
                      </div>

                      <label className="shrink-0">
                        <span className="t-overline">I have</span>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={minutesInput}
                            aria-label="Minutes available"
                            onChange={(e) => setMinutesInput(e.target.value.replace(/[^0-9]/g, ''))}
                            onBlur={() => {
                              const parsed = parseInt(minutesInput, 10)
                              commitMinutes(Number.isNaN(parsed) ? minutes : parsed)
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            className="input w-20 text-center tabular-nums"
                          />
                          <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                            min
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* How far through the evening you are, at a glance. */}
                    {session.items.length > 0 && !sessionComplete && (
                      <div
                        className="mt-5 h-1.5 overflow-hidden rounded-full"
                        style={{ background: 'var(--border-strong)' }}
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${(completedCount / session.items.length) * 100}%`,
                            background: 'var(--brand)',
                          }}
                        />
                      </div>
                    )}

                    <div className="mt-5">
                      <SessionTimer minutes={minutes} />
                    </div>
                  </div>

                  {sessionComplete ? (
                    <div className="border-l-2 pl-4" style={{ borderColor: 'var(--status-proficient)' }}>
                      <p className="text-[14.5px] font-medium" style={{ color: 'var(--status-proficient)' }}>
                        You worked through everything planned for today.
                      </p>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        Increase the time above to keep going, or come back tomorrow when the queue
                        has re-ranked.
                      </p>
                    </div>
                  ) : (
                    <ol className="stagger flex flex-col">
                      {session.items.map((item) => {
                        const isDone = done.has(item.id)
                        return (
                          <li
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3.5"
                            style={{
                              borderColor: isDone ? 'var(--border)' : 'var(--border-strong)',
                              background: isDone ? 'transparent' : 'var(--surface)',
                              marginBottom: 8,
                              opacity: isDone ? 0.6 : 1,
                            }}
                          >
                            <button
                              onClick={() => toggleDone(item.id)}
                              aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
                              aria-pressed={isDone}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--r-sm)] border transition-colors duration-150 ${
                                isDone
                                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                  : 'border-[var(--border-hover)]'
                              }`}
                            >
                              {isDone && <IconCheck width={12} height={12} />}
                            </button>

                            <div className="min-w-[12rem] flex-1">
                              <p className="t-caption truncate">
                                {item.subject} · {item.topic}
                              </p>
                              <p
                                className={`truncate text-[14.5px] ${isDone ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-body)]'}`}
                              >
                                {displaySubtopic(item.subtopic)}
                              </p>
                              {item.reasons.length > 0 && !isDone && (
                                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                  {item.reasons.slice(0, 2).map((r) => (
                                    <span
                                      key={r.kind}
                                      className={`text-xs ${REASON_STYLE[r.kind] || 'text-[var(--text-faint)]'}`}
                                    >
                                      {r.label}
                                    </span>
                                  ))}
                                </p>
                              )}
                            </div>

                            {!isDone && (
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  onClick={() => setDrawerItem(item)}
                                  className="btn btn-quiet control-sm"
                                >
                                  Resources
                                </button>
                                <Link
                                  href={quizHref(item)}
                                  className="btn btn-outline control-sm"
                                >
                                  Practise
                                </Link>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>

                {/* The evening's other half. Subtopics above, everything else
                    that has to happen tonight here. */}
                <TodoList className="mt-12 mb-12" title="Also tonight" subjects={accessibleSubjects(profile)} />

                {dueReviews > 0 && (
                  <Link
                    href="/dashboard/mistakes"
                    className="group flex items-center gap-4 border-t py-5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold tracking-[-0.012em]">
                        {dueReviews} past mistake{dueReviews === 1 ? '' : 's'} due for review
                      </p>
                      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                        Spaced repetition on questions you have already got wrong.
                      </p>
                    </div>
                    <IconArrowRight width={18} height={18} className="shrink-0 text-[var(--brand)]" />
                  </Link>
                )}

                {events.length === 0 && (
                  <Link
                    href="/dashboard/calendar"
                    className="group flex items-center gap-4 border-t py-5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <IconCalendar width={17} height={17} className="shrink-0 text-[var(--brand)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold tracking-[-0.012em]">Add your next test</p>
                      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                        With a date on the calendar, the planner puts that subject first as it
                        approaches.
                      </p>
                    </div>
                    <IconArrowRight width={18} height={18} className="shrink-0 text-[var(--brand)]" />
                  </Link>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-8">
                {grouped.map(({ subject, items: subjectItems }) => (
                  <section key={subject}>
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <h2 className="t-overline">{subject}</h2>
                      <Link
                        href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
                        className="text-sm font-medium text-[var(--brand)] hover:underline"
                      >
                        Open syllabus
                      </Link>
                    </div>
                    <ul className="flex flex-col">
                      {subjectItems.slice(0, 12).map((item, i) => (
                        <li
                  key={item.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                          <div className="flex flex-wrap items-center gap-3 px-1 py-3.5">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[item.status]}`}
                              aria-hidden="true"
                            />
                            <div className="min-w-[10rem] flex-1">
                              <p className="t-caption truncate">{item.topic}</p>
                              <p className="truncate text-sm text-[var(--text-body)]">
                                {displaySubtopic(item.subtopic)}
                              </p>
                            </div>
                            <span
                              className={`hidden shrink-0 text-xs font-medium sm:block ${STATUS_TEXT_COLORS[item.status]}`}
                            >
                              {STATUS_LABELS[item.status]}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="btn btn-quiet control-sm"
                              >
                                Resources
                              </button>
                              <Link
                                href={quizHref(item)}
                                className="btn btn-outline control-sm"
                              >
                                Practise
                              </Link>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {subjectItems.length > 12 && (
                      <p className="t-caption mt-2">
                        Showing the 12 most urgent of {subjectItems.length}.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            )}

            {!isPremium(profile) && (profile.subjects || []).length > 1 && (
              <Link
                href="/dashboard/profile#unlock"
                className="mt-10 flex items-center gap-3 border-l-2 pl-4"
                style={{ borderColor: 'var(--border-strong)' }}
              >
                <IconCheck width={16} height={16} className="shrink-0 text-[var(--brand)]" />
                <span className="text-sm text-[var(--text-body)]">
                  This plan covers one subject on the free plan. Unlock the rest with your school
                  code.
                </span>
              </Link>
            )}
          </>
        )}

        <ResourceHubDrawer
          open={!!drawerItem}
          onClose={() => setDrawerItem(null)}
          subject={drawerItem?.subject}
          topic={drawerItem?.topic}
          subtopic={drawerItem?.subtopic}
          hlOnly={drawerItem?.hl_only}
          quizHref={drawerItem ? quizHref(drawerItem) : null}
        />
      </Page>
    </DashboardLayout>
  )
}
