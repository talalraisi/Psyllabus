'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, EmptyState, PageLoading } from '@/components/PageShell'
import { IconChevronRight, IconArrowRight } from '@/components/Icons'
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
  const [counts, setCounts] = useState({ mastered: 0, weak: 0, decaying: 0, due: 0 })
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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profileData) {
        router.push('/onboarding')
        return
      }

      setProfile(profileData)
      const subjects = profileData.subjects || []

      const [{ data: syllabusRows }, { data: progressRows }, { count: dueCount }] =
        await Promise.all([
          subjects.length
            ? supabase.from('syllabus_content').select('*').in('subject', subjects)
            : { data: [] },
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
      })
      setOverall(merged.length ? Math.round((mastered / merged.length) * 100) : 0)

      setFocus(
        merged
          .filter((r) => r.status in FOCUS_PRIORITY)
          .sort((a, b) => {
            const pi = FOCUS_PRIORITY[a.status] - FOCUS_PRIORITY[b.status]
            if (pi !== 0) return pi
            const si = subjects.indexOf(a.subject) - subjects.indexOf(b.subject)
            if (si !== 0) return si
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
        <PageLoading title="Dashboard" width="wide" stats rows={5} />
      </DashboardLayout>
    )
  }

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const subjects = profile.subjects || []

  const stats = [
    { label: 'Mastered', value: counts.mastered, color: 'text-[var(--status-mastered)]' },
    { label: 'Decaying', value: counts.decaying, color: 'text-[var(--status-decaying)]' },
    { label: 'Weak', value: counts.weak, color: 'text-[var(--status-weak)]' },
    {
      label: 'Reviews due',
      value: counts.due,
      color: 'text-[var(--warning-text)]',
      href: '/dashboard/mistakes',
    },
  ]

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title={`${greeting()}, ${firstName}`}
          subtitle={`${profile.curriculum} · Class of ${profile.grad_year} · ${subjects.length} subject${subjects.length === 1 ? '' : 's'}`}
        />

        <div className="mb-8 flex items-center gap-4">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-[#f3f4f6]"
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
          {stats.map(({ label, value, color, href }) => {
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

        <Section title="Today's focus">
          {focus.length === 0 ? (
            <EmptyState
              title="Nothing queued yet"
              description="Take a quiz on any subtopic and the ones needing work will appear here, most urgent first."
              action={
                <Link href="/dashboard/subjects" className="btn btn-solid control-md">
                  Browse subjects
                </Link>
              }
            />
          ) : (
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
          )}
        </Section>

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
              return (
                <li
                  key={subject}
                  className={i > 0 ? 'border-t border-[var(--border)]' : undefined}
                >
                  <Link
                    href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                  >
                    <span className="w-48 shrink-0 truncate text-sm font-medium text-[var(--text)]">
                      {subject}
                    </span>
                    <span
                      className="hidden h-2 flex-1 overflow-hidden rounded-full bg-[#f3f4f6] sm:block"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--brand)]"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="ml-auto w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--brand)] sm:ml-0">
                      {pct}%
                    </span>
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
        </Section>
      </Page>
    </DashboardLayout>
  )
}
