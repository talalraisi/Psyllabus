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
import { relativeDay } from '@/lib/calendar'
import SubjectWheel from '@/components/SubjectWheel'
import { getSlugForSubject } from '@/lib/subject-map'
import {
  computeCompletionPercent,
  progressKey,
  topicSortKey,
  STATUS_COLORS,
  STATUS_LABELS,
  displaySubtopic,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { isPremium, isSubjectLocked } from '@/lib/access'

function greeting(now) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [subjectStats, setSubjectStats] = useState({})
  const [breakdown, setBreakdown] = useState({})
  const [sizes, setSizes] = useState({})
  const [topics, setTopics] = useState({})
  // The greeting and the date are read once, on the client, when the data
  // lands. Reading the clock while rendering makes the component impure, and
  // the answer would be the server's time zone rather than the student's.
  const [now, setNow] = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
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

      /**
       * Three round trips became two.
       *
       * The profile was awaited on its own before anything else started, even
       * though progress, mistakes and calendar only need the user id, which we
       * already have. They now go out alongside it. Only the syllabus genuinely
       * depends on the subject list, so it is the only thing left waiting.
       *
       * On a database in Singapore that is a couple of hundred milliseconds off
       * every dashboard load, every time.
       */
      const [profileData, { data: progressRows }, { count: dueCount }, eventsResult] =
        await Promise.all([
          getProfile(supabase, user.id, { onFresh: setProfile }),
          supabase
            .from('progress')
            // Only what the maps read. select('*') pulled every column of every
            // row across six subjects to use four of them.
            .select('subject, topic, subtopic, status, mastery_points, updated_at, last_correct_at')
            .eq('user_id', user.id),
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

      if (!profileData) {
        router.push('/onboarding')
        return
      }

      setProfile(profileData)
      const subjects = profileData.subjects || []

      const syllabusRows = await getSyllabus(supabase, subjects)

      const progressMap = buildEffectiveProgressMap(progressRows)
      const merged = (syllabusRows || []).map((row) => ({
        ...row,
        status: progressMap[progressKey(row.subject, row.subtopic)] || 'not_started',
      }))

      const stats = {}
      const tallies = {}
      const sizeOf = {}
      const byTopic = {}
      for (const subject of subjects) {
        const rows = merged.filter((r) => r.subject === subject)
        stats[subject] = computeCompletionPercent(rows, progressMap, subject)
        sizeOf[subject] = rows.length
        const tally = {}
        const topics = new Map()
        for (const row of rows) {
          tally[row.status] = (tally[row.status] || 0) + 1
          const t = topics.get(row.topic) || { topic: row.topic, total: 0, mastered: 0 }
          t.total++
          if (row.status === 'mastered') t.mastered++
          topics.set(row.topic, t)
        }
        tallies[subject] = tally
        byTopic[subject] = [...topics.values()].sort(
          (a, b) => topicSortKey(a.topic) - topicSortKey(b.topic)
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

      const queue = buildQueue({
        items: merged,
        details: buildProgressDetailMap(progressRows),
        subjectMastery: stats,
        profile: profileData,
        events: eventsResult?.data || [],
      })
      setSession(buildSession(queue, { minutes: profileData.session_minutes || undefined }))

      const pending = (eventsResult?.data || [])
        .filter((e) => new Date(e.due_at).getTime() >= Date.now())
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      setNextEvent(pending[0] || null)
      setNow(new Date())
      setSubjectStats(stats)
      setBreakdown(tallies)
      setTopics(byTopic)
      setSizes(sizeOf)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Dashboard" width="wide" variant="wheel" />
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
  const rest = session.items.slice(0, 4)

  /**
   * The second line of the header.
   *
   * It used to read "IB · Class of 2027", which is two facts the student
   * entered themselves and has not needed since. Today's date and what is
   * actually waiting is the same amount of room spent on something they might
   * not know.
   */
  const subtitle = !hasActivity
    ? 'Welcome to Project Syllabus'
    : [
        now?.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
        counts.due > 0 ? `${counts.due} review${counts.due === 1 ? '' : 's'} due` : null,
        nextEvent ? `${nextEvent.title} ${relativeDay(nextEvent.due_at)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
  const firstSubject = subjects[0]
  const startHref = firstSubject
    ? `/dashboard/syllabus/${getSlugForSubject(firstSubject)}`
    : '/dashboard/subjects'

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title={`${now ? greeting(now) : 'Hello'}, ${firstName}`}
          subtitle={subtitle}
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
            <div className="mb-10">
              <SubjectWheel
                subjects={subjects}
                core={core}
                breakdown={breakdown}
                counts={sizes}
                targets={profile.target_grades || {}}
                overall={overall}
                lockedSubjects={subjects.filter((subject) => isSubjectLocked(subject, profile))}
                topicsBySubject={topics}
              />
            </div>

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

            <div className="grid gap-x-14 gap-y-0 lg:grid-cols-2">
            {/* What the planner would have you do, in the order it would have
                you do it. Four at most: the whole queue lives on the study
                plan, and a dashboard listing nine subtopics is a to-do list
                long enough that nobody opens it. */}
            {rest.length > 0 && (
              <Section
                title="Today"
                action={
                  <div className="flex items-center gap-5">
                    {counts.due > 0 && (
                      <Link
                        href="/dashboard/quiz?mode=mistakes&back=/dashboard"
                        className="text-[13px] font-medium text-[var(--brand)] hover:underline"
                      >
                        Review {counts.due}
                      </Link>
                    )}
                    <Link
                      href="/dashboard/study-plan"
                      className="text-[13px] font-medium text-[var(--brand)] hover:underline"
                    >
                      Full plan
                    </Link>
                  </div>
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
            </div>
          </>
        )}
      </Page>
    </DashboardLayout>
  )
}
