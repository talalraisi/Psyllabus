'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, StatRow, PageLoading } from '@/components/PageShell'
import { IconChevronRight, IconArrowRight, IconCheck, IconClock } from '@/components/Icons'
import { buildQueue, buildSession } from '@/lib/planner'
import SubjectWheel from '@/components/SubjectWheel'
import { getSlugForSubject } from '@/lib/subject-map'
import {
  computeCompletionPercent,
  progressKey,
  STATUS_COLORS,
  STATUS_LABELS,
  displaySubtopic,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { isPremium, isSubjectLocked } from '@/lib/access'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [subjectStats, setSubjectStats] = useState({})
  const [breakdown, setBreakdown] = useState({})
  const [sizes, setSizes] = useState({})
  const [overall, setOverall] = useState(0)
  const [counts, setCounts] = useState({ mastered: 0, weak: 0, decaying: 0, due: 0, tested: 0 })
  const [session, setSession] = useState({ items: [], perItemMinutes: 0 })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
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
      const subjects = profileData.subjects || []

      const [syllabusRows, { data: progressRows }, { count: dueCount }, eventsResult] =
        await Promise.all([
          getSyllabus(supabase, subjects),
          supabase.from('progress').select('*').eq('user_id', user.id),
          supabase
            .from('mistakes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .lte('next_review_at', new Date().toISOString()),
          supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', user.id)
            .eq('completed', false),
        ])

      const progressMap = buildEffectiveProgressMap(progressRows)
      const merged = (syllabusRows || []).map((row) => ({
        ...row,
        status: progressMap[progressKey(row.subject, row.subtopic)] || 'not_started',
      }))

      const stats = {}
      const tallies = {}
      const sizeOf = {}
      for (const subject of subjects) {
        const rows = merged.filter((r) => r.subject === subject)
        stats[subject] = computeCompletionPercent(rows, progressMap, subject)
        sizeOf[subject] = rows.length
        const tally = {}
        for (const row of rows) tally[row.status] = (tally[row.status] || 0) + 1
        tallies[subject] = tally
      }

      const mastered = merged.filter((r) => r.status === 'mastered').length
      setCounts({
        mastered,
        weak: merged.filter((r) => r.status === 'in_progress').length,
        decaying: merged.filter((r) => r.status === 'decaying').length,
        due: dueCount || 0,
        tested: (progressRows || []).length,
      })
      setOverall(merged.length ? Math.round((mastered / merged.length) * 100) : 0)

      const queue = buildQueue({
        items: merged,
        details: buildProgressDetailMap(progressRows),
        subjectMastery: stats,
        profile: profileData,
        events: eventsResult?.data || [],
      })
      setSession(buildSession(queue, { minutes: profileData.session_minutes || undefined }))

      setSubjectStats(stats)
      setBreakdown(tallies)
      setSizes(sizeOf)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Dashboard" width="wide" stats rows={4} />
      </DashboardLayout>
    )
  }

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const allSubjects = profile.subjects || []
  const subjects = allSubjects.filter((s) => !IB_CORE_SUBJECTS.includes(s))
  const core = allSubjects.filter((s) => IB_CORE_SUBJECTS.includes(s))
  const premium = isPremium(profile)

  // A student who has not been tested yet gets an orientation screen instead of
  // a wall of zeros. Metrics appear once there is something real to show.
  const hasActivity = counts.tested > 0

  // One thing to start, then at most three more. The whole queue lives on the
  // study plan; a dashboard that lists nine subtopics is a to-do list, and a
  // to-do list that long is one nobody opens.
  const [next, ...queued] = session.items
  const rest = queued.slice(0, 3)
  const firstSubject = subjects[0]
  const startHref = firstSubject
    ? `/dashboard/syllabus/${getSlugForSubject(firstSubject)}`
    : '/dashboard/subjects'

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title={`${greeting()}, ${firstName}`}
          subtitle={
            hasActivity
              ? `${profile.curriculum} · Class of ${profile.grad_year}`
              : 'Welcome to Project Syllabus'
          }
        />

        {!hasActivity ? (
          <>
            <div className="mb-12 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-[19px] font-semibold tracking-[-0.02em]">Start with one quiz</h2>
              <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Nothing here is filled in by guessing. Take a short quiz on any subtopic and
                Project Syllabus marks it from your answers, then works out what you should study next.
              </p>

              {/* Numbered the way the landing page numbers its steps: the
                  figure is reference, set small and faint, and the sentence is
                  the thing you read. */}
              <ol className="mt-8 grid gap-7 sm:grid-cols-3">
                {[
                  'Open a subject and pick a subtopic that looks shaky.',
                  'Answer ten questions. It takes a few minutes.',
                  'Your heatmap and study plan build themselves from the result.',
                ].map((step, i) => (
                  <li key={step} className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                    <span
                      className="text-[11px] font-semibold tabular-nums tracking-[0.16em]"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      {step}
                    </p>
                  </li>
                ))}
              </ol>

              <Link href={startHref} className="btn btn-solid control-lg mt-9 max-w-full px-6">
                <span className="min-w-0 truncate">
                  {firstSubject ? `Open ${firstSubject}` : 'Choose a subject'}
                </span>
                <IconArrowRight width={18} height={18} className="shrink-0" />
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Start here. One thing, named, with the reason it is first and a
                button that opens it. Everything else on this page is reference
                for when you have already done it. */}
            {next && (
              <div className="mb-14">
                <p
                  className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  Start here
                </p>
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  {next.subject} · {next.topic}
                </p>
                <h2 className="mt-1.5 text-[clamp(1.5rem,3.6vw,2.1rem)] font-semibold leading-[1.15] tracking-[-0.03em]">
                  {displaySubtopic(next.subtopic)}
                </h2>

                <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]">
                  <span className={`font-medium ${STATUS_TEXT_COLORS[next.status]}`}>
                    {STATUS_LABELS[next.status]}
                  </span>
                  {next.reasons?.slice(0, 2).map((r) => (
                    <span key={r.kind} style={{ color: 'var(--text-muted)' }}>
                      {r.label}
                    </span>
                  ))}
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <IconClock width={13} height={13} />
                    about {session.perItemMinutes} min
                  </span>
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/dashboard/quiz?subject=${encodeURIComponent(next.subject)}&topic=${encodeURIComponent(next.topic)}&subtopic=${encodeURIComponent(next.subtopic)}&back=/dashboard`}
                    className="btn btn-solid control-lg"
                  >
                    Start this quiz
                    <IconArrowRight width={17} height={17} />
                  </Link>
                  {counts.due > 0 && (
                    <Link
                      href="/dashboard/quiz?mode=mistakes&back=/dashboard"
                      className="btn btn-outline control-lg"
                    >
                      Or review {counts.due} mistake{counts.due === 1 ? '' : 's'}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* The rest of today, so the one thing above has a context and you
                can see what you are working toward without leaving the page. */}
            {rest.length > 0 && (
              <Section
                title="Then today"
                action={
                  <Link
                    href="/dashboard/study-plan"
                    className="text-[13px] font-medium text-[var(--brand)] hover:underline"
                  >
                    Full plan
                  </Link>
                }
              >
                <ul className="flex flex-col">
                  {rest.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 border-b py-3.5 last:border-b-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[item.status]}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                          {item.subject} · {item.topic}
                        </p>
                        <p className="mt-0.5 truncate text-[14px]" style={{ color: 'var(--text-body)' }}>
                          {displaySubtopic(item.subtopic)}
                        </p>
                      </div>
                      <span
                        className={`hidden shrink-0 text-[12.5px] font-medium sm:block ${STATUS_TEXT_COLORS[item.status]}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                      <Link
                        href={`/dashboard/quiz?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}&subtopic=${encodeURIComponent(item.subtopic)}&back=/dashboard`}
                        className="btn btn-outline control-sm shrink-0"
                      >
                        Quiz
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Your programme as one shape. */}
            <Section title="Your programme">
              <SubjectWheel
                subjects={subjects}
                core={core}
                breakdown={breakdown}
                counts={sizes}
                targets={profile.target_grades || {}}
                overall={overall}
                lockedSubjects={subjects.filter((subject) => isSubjectLocked(subject, profile))}
              />
            </Section>

            {/* The numbers, as reference under a rule. They are what the page
                is measured on, not what it opens with. */}
            <div className="mb-14">
              <StatRow
                stats={[
                  { label: 'mastered', value: counts.mastered, tone: 'var(--status-mastered)' },
                  { label: 'fading', value: counts.decaying, tone: 'var(--status-fading)' },
                  { label: 'weak', value: counts.weak, tone: 'var(--status-weak)' },
                  { label: 'reviews due', value: counts.due },
                  { label: 'of the syllabus mastered', value: `${overall}%`, tone: 'var(--brand)' },
                ]}
              />
            </div>
          </>
        )}

        {/* Subjects */}
        <Section
          title="Your subjects"
          action={
            <Link
              href="/dashboard/subjects"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--brand)] hover:underline"
            >
              View all
              <IconArrowRight width={16} height={16} />
            </Link>
          }
        >
          <ul className="flex flex-col gap-0.5">
            {subjects.map((subject, i) => {
              const pct = subjectStats[subject] ?? 0
              const locked = isSubjectLocked(subject, profile)
              return (
                <li key={subject}>
                  <Link
                    href={
                      locked
                        ? '/dashboard/profile#unlock'
                        : `/dashboard/syllabus/${getSlugForSubject(subject)}`
                    }
                    className="flex items-center gap-4 rounded-[10px] px-3 py-3.5 transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-[14.5px] font-medium sm:w-48 sm:flex-none sm:shrink-0 ${
                        locked ? 'text-[var(--text-faint)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {subject}
                    </span>
                    {locked ? (
                      <span className="ml-auto shrink-0 rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                        <span className="sm:hidden">Locked</span>
                        <span className="hidden sm:inline">Locked on free plan</span>
                      </span>
                    ) : (
                      <>
                        <span className="hidden h-1 flex-1 overflow-hidden rounded-full bg-[var(--border-strong)] sm:block">
                          <span
                            className="block h-full rounded-full bg-[var(--brand)]"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="ml-auto w-11 shrink-0 text-right text-[13.5px] font-semibold tabular-nums text-[var(--brand)] sm:ml-0">
                          {pct}%
                        </span>
                      </>
                    )}
                    <IconChevronRight
                      width={16}
                      height={16}
                      className="shrink-0 text-[var(--text-faint)]"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>

          {!premium && subjects.length > 1 && (
            <Link
              href="/dashboard/profile#unlock"
              className="mt-5 flex items-center gap-3 border-l-2 pl-4"
              style={{ borderColor: 'var(--brand)' }}
            >
              <IconCheck width={15} height={15} className="shrink-0 text-[var(--brand)]" />
              <span className="text-[14px]" style={{ color: 'var(--text-body)' }}>
                Have a school code? Unlock every subject free.
              </span>
            </Link>
          )}
        </Section>

      </Page>
    </DashboardLayout>
  )
}
