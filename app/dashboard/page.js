'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, PageLoading } from '@/components/PageShell'
import { IconChevronRight, IconArrowRight, IconCheck } from '@/components/Icons'
import { getSlugForSubject } from '@/lib/subject-map'
import {
  computeCompletionPercent,
  progressKey,
  topicSortKey,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { isPremium, isSubjectLocked } from '@/lib/access'

const FOCUS_PRIORITY = { decaying: 0, in_progress: 1, confident: 2, not_started: 3 }

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [subjectStats, setSubjectStats] = useState({})
  const [overall, setOverall] = useState(0)
  const [counts, setCounts] = useState({ mastered: 0, weak: 0, decaying: 0, due: 0, tested: 0 })
  const [focus, setFocus] = useState([])
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

      const [syllabusRows, { data: progressRows }, { count: dueCount }] =
        await Promise.all([
          getSyllabus(supabase, subjects),
          supabase.from('progress').select('*').eq('user_id', user.id),
          supabase
            .from('mistakes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .lte('next_review_at', new Date().toISOString()),
        ])

      const progressMap = buildEffectiveProgressMap(progressRows)
      const merged = (syllabusRows || []).map((row) => ({
        ...row,
        status: progressMap[progressKey(row.subject, row.subtopic)] || 'not_started',
      }))

      const stats = {}
      for (const subject of subjects) {
        stats[subject] = computeCompletionPercent(
          merged.filter((r) => r.subject === subject),
          progressMap,
          subject
        )
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

      setFocus(
        merged
          .filter((r) => r.status in FOCUS_PRIORITY && r.status !== 'not_started')
          .sort((a, b) => {
            const pi = FOCUS_PRIORITY[a.status] - FOCUS_PRIORITY[b.status]
            if (pi !== 0) return pi
            return topicSortKey(a.topic) - topicSortKey(b.topic)
          })
          .slice(0, 5)
      )

      setSubjectStats(stats)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Dashboard" width="wide" rows={4} />
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
              : 'Welcome to PSyllabus'
          }
        />

        {!hasActivity ? (
          <>
            <div className="surface mb-10 p-6">
              <h2 className="t-card-title mb-2">Start with one quiz</h2>
              <p className="t-body mb-6 max-w-xl">
                Nothing here is filled in by guessing. Take a short quiz on any subtopic and
                PSyllabus marks it from your answers, then works out what you should study next.
              </p>

              <ol className="mb-6 flex flex-col gap-3">
                {[
                  'Open a subject and pick a subtopic that looks shaky.',
                  'Answer ten questions. It takes a few minutes.',
                  'Your heatmap and study plan build themselves from the result.',
                ].map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand)]">
                      {i + 1}
                    </span>
                    <span className="text-sm text-[var(--text-body)]">{step}</span>
                  </li>
                ))}
              </ol>

              <Link href={startHref} className="btn btn-solid control-lg max-w-full px-6">
                <span className="min-w-0 truncate">
                  {firstSubject ? `Open ${firstSubject}` : 'Choose a subject'}
                </span>
                <IconArrowRight width={18} height={18} className="shrink-0" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-8 flex items-center gap-4">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
                role="progressbar"
                aria-valuenow={overall}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Overall syllabus mastered"
              >
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500 ease-out"
                  style={{ width: `${overall}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--brand)]">
                {overall}% mastered
              </span>
            </div>

            <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Mastered', value: counts.mastered, color: 'text-[var(--status-mastered)]' },
                { label: 'Decaying', value: counts.decaying, color: 'text-[var(--status-decaying)]' },
                { label: 'Weak', value: counts.weak, color: 'text-[var(--status-weak)]' },
                {
                  label: 'Reviews due',
                  value: counts.due,
                  color: 'text-[var(--warning-text)]',
                  href: '/dashboard/mistakes',
                },
              ].map(({ label, value, color, href }) => {
                const body = (
                  <>
                    <p className={`t-stat ${color}`}>{value}</p>
                    <p className="t-small mt-1">{label}</p>
                  </>
                )
                return href ? (
                  <Link key={label} href={href} className="surface surface-interactive block p-5">
                    {body}
                  </Link>
                ) : (
                  <div key={label} className="surface p-5">
                    {body}
                  </div>
                )
              })}
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
          <ul className="surface">
            {subjects.map((subject, i) => {
              const pct = subjectStats[subject] ?? 0
              const locked = isSubjectLocked(subject, profile)
              return (
                <li
                  key={subject}
                  className={i > 0 ? 'border-t border-[var(--border)]' : undefined}
                >
                  <Link
                    href={
                      locked
                        ? '/dashboard/profile#unlock'
                        : `/dashboard/syllabus/${getSlugForSubject(subject)}`
                    }
                    className="flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-medium sm:w-48 sm:flex-none sm:shrink-0 ${
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
                        <span className="hidden h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)] sm:block">
                          <span
                            className="block h-full rounded-full bg-[var(--brand)]"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="ml-auto w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--brand)] sm:ml-0">
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
              className="mt-3 flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--sand)] bg-[var(--sand)]/30 px-4 py-3"
            >
              <IconCheck width={16} height={16} className="shrink-0 text-[var(--brand)]" />
              <span className="text-sm text-[var(--text-body)]">
                Have a school code? Unlock every subject free.
              </span>
            </Link>
          )}
        </Section>

        {/* The DP core is separate: it is not one of the six subjects. */}
        {core.length > 0 && (
          <Section title="Diploma core">
            <ul className="surface">
              {core.map((subject, i) => (
                <li
                  key={subject}
                  className={i > 0 ? 'border-t border-[var(--border)]' : undefined}
                >
                  <Link
                    href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                  >
                    <span className="flex-1 truncate text-sm font-medium text-[var(--text)]">
                      {subject}
                    </span>
                    <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--brand)]">
                      {subjectStats[subject] ?? 0}%
                    </span>
                    <IconChevronRight
                      width={16}
                      height={16}
                      className="shrink-0 text-[var(--text-faint)]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Focus comes last so a new account is not confronted with a queue. */}
        {hasActivity && focus.length > 0 && (
          <Section title="What to work on next">
            <ul className="surface">
              {focus.map((item, i) => (
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
                      <p className="t-caption truncate">
                        {item.subject} · {item.topic}
                      </p>
                      <p className="truncate text-sm text-[var(--text-body)]">{item.subtopic}</p>
                    </div>
                    <span
                      className={`hidden shrink-0 text-xs font-medium sm:block ${STATUS_TEXT_COLORS[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                    <Link
                      href={`/dashboard/quiz?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}&subtopic=${encodeURIComponent(item.subtopic)}&back=/dashboard`}
                      className="btn btn-outline control-sm shrink-0 text-xs"
                    >
                      Quiz
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </Page>
    </DashboardLayout>
  )
}
