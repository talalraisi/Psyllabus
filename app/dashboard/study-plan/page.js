'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, EmptyState, PageLoading } from '@/components/PageShell'
import { IconArrowRight, IconClock, IconCheck } from '@/components/Icons'
import { getSlugForSubject } from '@/lib/subject-map'
import {
  progressKey,
  computeCompletionPercent,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { buildQueue, buildSession, groupBySubjectRanked, daysUntilExam } from '@/lib/planner'
import { accessibleSubjects, isPremium } from '@/lib/access'

const SESSION_LENGTHS = [20, 40, 60, 90]

const REASON_STYLE = {
  weak: 'text-[var(--status-weak)]',
  decaying: 'text-[var(--status-decaying)]',
  shaky: 'text-[var(--warning-text)]',
  untested: 'text-[var(--text-faint)]',
  foundation: 'text-[var(--brand)]',
  exam: 'text-[var(--status-weak)]',
}

export default function StudyPlanPage() {
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [details, setDetails] = useState({})
  const [mastery, setMastery] = useState({})
  const [dueReviews, setDueReviews] = useState(0)
  const [minutes, setMinutes] = useState(40)
  const [done, setDone] = useState(() => new Set())
  const [view, setView] = useState('today')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!profileData) {
        router.push('/onboarding')
        return
      }
      setProfile(profileData)

      // Free accounts plan only against the subject they can actually open.
      const usable = accessibleSubjects(profileData)

      const [{ data: syllabusRows }, { data: progressRows }, { count: due }] = await Promise.all([
        usable.length
          ? supabase.from('syllabus_content').select('*').in('subject', usable)
          : { data: [] },
        supabase.from('progress').select('*').eq('user_id', user.id),
        supabase
          .from('mistakes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .lte('next_review_at', new Date().toISOString()),
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
      setDueReviews(due || 0)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const queue = useMemo(
    () => buildQueue({ items, details, subjectMastery: mastery, profile }),
    [items, details, mastery, profile]
  )

  const session = useMemo(() => buildSession(queue, { minutes }), [queue, minutes])
  const grouped = useMemo(() => groupBySubjectRanked(queue), [queue])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Study Plan" width="default" rows={5} />
      </DashboardLayout>
    )
  }

  const daysLeft = daysUntilExam(profile)
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
      <Page width="default">
        <PageHeader
          title="Study Plan"
          subtitle={
            daysLeft !== null
              ? `${daysLeft} days until your exam session · ${queue.length} subtopics still to secure`
              : `${queue.length} subtopics still to secure`
          }
        />

        {queue.length === 0 ? (
          <EmptyState
            title={items.length ? 'Everything is mastered' : 'Take a quiz to build your plan'}
            description={
              items.length
                ? 'Nothing is weak or decaying right now. Keep testing to hold it there.'
                : 'The planner ranks subtopics by what you got wrong, what is decaying, and what unlocks later work. It needs one quiz to start.'
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
            <div className="mb-6 inline-flex rounded-[var(--r-md)] border border-[var(--border-strong)] p-1">
              {[
                ['today', "Today's session"],
                ['all', 'Full priority list'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  className={`control-sm rounded-[var(--r-sm)] px-4 text-sm font-medium transition-colors duration-150 ${
                    view === key
                      ? 'bg-[var(--brand)] text-white'
                      : 'text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === 'today' ? (
              <>
                <div className="surface mb-3 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="t-card-title">
                        {sessionComplete ? 'Session complete' : "Today's session"}
                      </p>
                      <p className="t-small mt-1 inline-flex items-center gap-2">
                        <IconClock width={14} height={14} />
                        About {session.minutes} minutes · {session.items.length} subtopics
                        {completedCount > 0 && ` · ${completedCount} done`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="t-caption">I have</span>
                      {SESSION_LENGTHS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMinutes(m)}
                          aria-pressed={minutes === m}
                          className={`control-sm rounded-[var(--r-sm)] border px-3 text-xs font-medium transition-colors duration-150 ${
                            minutes === m
                              ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
                              : 'border-[var(--border-strong)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {sessionComplete ? (
                    <div className="rounded-[var(--r-md)] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
                      <p className="text-sm font-medium text-[var(--success-text)]">
                        You worked through everything planned for today.
                      </p>
                      <p className="t-small mt-1">
                        Increase the time above to keep going, or come back tomorrow when the
                        queue has re-ranked.
                      </p>
                    </div>
                  ) : (
                    <ol className="flex flex-col gap-2">
                      {session.items.map((item) => {
                        const isDone = done.has(item.id)
                        return (
                          <li
                            key={item.id}
                            className={`flex items-center gap-3 rounded-[var(--r-md)] border p-3 transition-colors duration-150 ${
                              isDone
                                ? 'border-[var(--border)] bg-[var(--surface-sunken)]'
                                : 'border-[var(--border-strong)]'
                            }`}
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

                            <div className="min-w-0 flex-1">
                              <p className="t-caption truncate">
                                {item.subject} · {item.topic}
                              </p>
                              <p
                                className={`truncate text-sm ${isDone ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text-body)]'}`}
                              >
                                {item.subtopic}
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
                              <Link
                                href={quizHref(item)}
                                className="btn btn-outline control-sm shrink-0 text-xs"
                              >
                                Practise
                              </Link>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>

                {dueReviews > 0 && (
                  <Link
                    href="/dashboard/mistakes"
                    className="surface surface-interactive flex items-center gap-4 p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="t-card-title">
                        {dueReviews} past mistake{dueReviews === 1 ? '' : 's'} due for review
                      </p>
                      <p className="t-small mt-1">
                        Spaced repetition on questions you have already got wrong.
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
                    <ul className="surface">
                      {subjectItems.slice(0, 12).map((item, i) => (
                        <li
                          key={item.id}
                          className={i > 0 ? 'border-t border-[var(--border)]' : undefined}
                        >
                          <div className="flex items-center gap-3 px-5 py-4">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[item.status]}`}
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="t-caption truncate">{item.topic}</p>
                              <p className="truncate text-sm text-[var(--text-body)]">
                                {item.subtopic}
                              </p>
                            </div>
                            <span
                              className={`hidden shrink-0 text-xs font-medium sm:block ${STATUS_TEXT_COLORS[item.status]}`}
                            >
                              {STATUS_LABELS[item.status]}
                            </span>
                            <Link
                              href={quizHref(item)}
                              className="btn btn-outline control-sm shrink-0 text-xs"
                            >
                              Practise
                            </Link>
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
                className="mt-8 flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--sand)] bg-[var(--sand)]/30 px-4 py-3"
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
      </Page>
    </DashboardLayout>
  )
}
