'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, StatRow, PageLoading } from '@/components/PageShell'
import CountUp from '@/components/CountUp'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconChevronRight, IconArrowRight, IconCheck, IconClock } from '@/components/Icons'
import { buildQueue, buildSession } from '@/lib/planner'
import { relativeDay } from '@/lib/calendar'
import TodoList from '@/components/TodoList'
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
import { hasAllSubjects, isSubjectLocked, accessibleSubjects } from '@/lib/access'
import { getCoveredSubtopics } from '@/lib/coverage'

function greeting(now) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Why the planner put something first, coloured by what kind of reason it is. */
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

/**
 * A percentage you can see at a glance.
 *
 * The only decorative thing on the page, and it earns its place: "38%" read as
 * a number takes a moment to place, read as part of a circle takes none.
 */
function Ring({ percent }) {
  const size = 46
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const filled = Math.max(0, Math.min(100, percent)) / 100

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12.5px] font-semibold tabular-nums">
        <CountUp value={percent} />
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [subjectStats, setSubjectStats] = useState({})
  // How big each subject is. On a brand-new account this is the only real
  // information the dashboard has, and it is the reason to open one.
  const [subjectSizes, setSubjectSizes] = useState({})
  // The greeting and the date are read once, on the client, when the data
  // lands. Reading the clock while rendering makes the component impure, and
  // the answer would be the server's time zone rather than the student's.
  const [now, setNow] = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
  const [overall, setOverall] = useState(0)
  const [counts, setCounts] = useState({ mastered: 0, weak: 0, decaying: 0, due: 0, tested: 0 })
  const [session, setSession] = useState({ items: [], perItemMinutes: 0 })
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
      const sizes = {}
      for (const subject of subjects) {
        const rows = merged.filter((r) => r.subject === subject)
        stats[subject] = computeCompletionPercent(rows, progressMap, subject)
        sizes[subject] = rows.length
      }
      setSubjectSizes(sizes)

      const mastered = merged.filter((r) => r.status === 'mastered').length
      setCounts({
        mastered,
        weak: merged.filter((r) => r.status === 'in_progress').length,
        decaying: merged.filter((r) => r.status === 'decaying').length,
        due: dueCount || 0,
        tested: (progressRows || []).length,
      })
      setOverall(merged.length ? Math.round((mastered / merged.length) * 100) : 0)

      // What a student can actually sit today, so the one thing this page
      // tells them to do is not a subtopic whose only button says
      // "Questions coming soon".
      const covered = await getCoveredSubtopics(supabase)

      const queue = buildQueue({
        items: merged,
        details: buildProgressDetailMap(progressRows),
        subjectMastery: stats,
        profile: profileData,
        events: eventsResult?.data || [],
        covered,
      })
      setSession(buildSession(queue, { minutes: profileData.session_minutes || undefined }))

      const pending = (eventsResult?.data || [])
        .filter((e) => new Date(e.due_at).getTime() >= Date.now())
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      setNextEvent(pending[0] || null)
      setNow(new Date())
      setSubjectStats(stats)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Dashboard" width="wide" variant="dashboard" />
      </DashboardLayout>
    )
  }

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const allSubjects = profile.subjects || []
  const subjects = allSubjects.filter((s) => !IB_CORE_SUBJECTS.includes(s))
  const core = allSubjects.filter((s) => IB_CORE_SUBJECTS.includes(s))
  const premium = hasAllSubjects(profile)

  // A student who has not been tested yet gets an orientation screen instead of
  // a wall of zeros. Metrics appear once there is something real to show.
  const hasActivity = counts.tested > 0

  // One thing to start, then at most three more. The whole queue lives on the
  // study plan; a dashboard that lists nine subtopics is a to-do list, and a
  // to-do list that long is one nobody opens.
  // The one thing to do, and the two after it. The planner already ranks the
  // whole queue; a dashboard's job is to name the top of it, not reprint it.
  const [nextUp, ...afterThat] = session.items
  const queued = afterThat.slice(0, 3)

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
  /**
   * The subject the first-run panel sends them to.
   *
   * This was subjects[0], which on a free account is whichever subject
   * happens to be first in the list — usually a locked one. So the panel
   * said "Open English A" under a heading about proving things, and the
   * link went to a padlock. It is the subject they can actually open.
   */
  const firstSubject =
    accessibleSubjects(profile).find((s) => !IB_CORE_SUBJECTS.includes(s)) || subjects[0]
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

        {/* One thing first, then reference.
            This page had two problems with one cause: on a used account it
            opened with five sections at once, and on a new one it opened with
            almost nothing. Both are what happens when a page has no single
            first thing. It has one now — the next subtopic to sit, or the
            first one if nothing has been sat yet — and everything else is
            reference underneath it. */}
        {!hasActivity ? (
          <section
            className="elev-lg mb-8 rounded-[16px] border p-6 sm:p-7"
            style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}
          >
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              First time here
            </p>
            <h2 className="mt-3 text-[clamp(1.35rem,2.8vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
              Nothing here is guessed. You prove it.
            </h2>
            <p className="mt-2.5 max-w-lg text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              Every colour on this dashboard comes from a quiz you have sat. Three steps and it
              starts filling in.
            </p>

            <ol className="stagger mt-6 flex flex-col gap-3">
              {[
                [
                  '1',
                  'Open your syllabus',
                  firstSubject
                    ? `${firstSubject}, broken into topics, units and subtopics.`
                    : 'Your subjects, broken into topics and subtopics.',
                ],
                // Not "five questions": a subtopic with three questions in
                // the bank gives you three, and promising five and handing
                // over two is a small lie the student notices immediately.
                ['2', 'Sit a Quick 5', 'A short set on one subtopic, marked as you answer.'],
                ['3', 'Watch it colour in', 'Right answers earn points. Points set the level. Nothing else does.'],
              ].map(([n, title, detail]) => (
                <li key={n} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ background: 'var(--brand)', color: '#fff' }}
                  >
                    {n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium">{title}</span>
                    <span className="mt-0.5 block text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={startHref} className="btn btn-solid control-lg">
                Open {firstSubject || 'my subjects'}
                <IconArrowRight width={16} height={16} />
              </Link>
              {nextUp && (
                <Link
                  href={`/dashboard/quiz?subject=${encodeURIComponent(nextUp.subject)}&topic=${encodeURIComponent(nextUp.topic)}&subtopic=${encodeURIComponent(nextUp.subtopic)}&count=5&review=practice&back=/dashboard`}
                  className="btn btn-outline control-md"
                >
                  Or start with {displaySubtopic(nextUp.subtopic)}
                </Link>
              )}
            </div>
          </section>
        ) : nextUp ? (
          <section
            className="elev-lg mb-8 rounded-[16px] border p-6 sm:p-7"
            style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}
          >
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              Next up
            </p>

            <h2 className="mt-3 text-[clamp(1.35rem,2.8vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
              {displaySubtopic(nextUp.subtopic)}
            </h2>
            <p className="mt-2 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              {nextUp.subject} · {nextUp.topic}
            </p>

            {nextUp.reasons?.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {nextUp.reasons.slice(0, 2).map((r) => (
                  <span
                    key={r.kind}
                    className={`text-[12.5px] ${REASON_STYLE[r.kind] || 'text-[var(--text-faint)]'}`}
                  >
                    {r.label}
                  </span>
                ))}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/dashboard/quiz?subject=${encodeURIComponent(nextUp.subject)}&topic=${encodeURIComponent(nextUp.topic)}&subtopic=${encodeURIComponent(nextUp.subtopic)}&back=/dashboard`}
                className="btn btn-solid control-lg"
              >
                Sit this one
                <IconArrowRight width={16} height={16} />
              </Link>
              {counts.due > 0 && (
                <Link
                  href="/dashboard/quiz?mode=mistakes&back=/dashboard"
                  className="btn btn-outline control-md"
                >
                  Or review {counts.due} mistake{counts.due === 1 ? '' : 's'}
                </Link>
              )}
            </div>
          </section>
        ) : (
          <section
            className="elev-lg mb-8 rounded-[16px] border p-6 sm:p-7"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <h2 className="text-[clamp(1.35rem,2.8vw,1.8rem)] font-semibold tracking-[-0.028em]">
              Everything is secure
            </h2>
            <p
              className="mt-3 max-w-xl text-[14.5px] leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              Nothing is weak or fading right now. Keep testing to hold it there, or build a paper
              across the topics you want.
            </p>
            <Link href="/dashboard/test" className="btn btn-solid control-lg mt-7">
              Build a test
              <IconArrowRight width={16} height={16} />
            </Link>
          </section>
        )}

        {/* The numbers, once there are any. On a new account these are all
            zero, which says nothing and looks like a broken page. */}
        {/* Three cards, each of which is a thing you might act on, rather
            than five numbers in a row that a student has to rank themselves.
            The ring is the only decoration: a percentage is easier to feel
            than to read. */}
        {hasActivity && (
          <div className="stagger mb-10 grid gap-3 sm:grid-cols-3">
            <div
              className="elev flex items-center gap-4 rounded-[14px] border p-5"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <Ring percent={overall} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium">Syllabus mastered</p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  {counts.mastered} subtopic{counts.mastered === 1 ? '' : 's'} proved
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/study-plan"
              className="elev lift rounded-[14px] border p-5"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <p className="text-[26px] font-semibold leading-none tabular-nums">
                <CountUp value={counts.weak + counts.decaying} />
              </p>
              <p className="mt-2 text-[13px] font-medium">Needs attention</p>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                {counts.weak} weak · {counts.decaying} fading
              </p>
            </Link>

            <Link
              href="/dashboard/mistakes"
              className="elev lift rounded-[14px] border p-5"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <p
                className="text-[26px] font-semibold leading-none tabular-nums"
                style={{ color: counts.due > 0 ? 'var(--brand)' : undefined }}
              >
                <CountUp value={counts.due} />
              </p>
              <p className="mt-2 text-[13px] font-medium">Redemption due</p>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                {counts.due > 0 ? 'Questions waiting to be cleared' : 'Nothing waiting'}
              </p>
            </Link>
          </div>
        )}

        <div className="grid gap-x-14 lg:grid-cols-2">
          {/* Three, not nine. The queue lives on the study plan. */}
          {queued.length > 0 && (
            <Section
              title="After that"
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
                {queued.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 border-b py-3 last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_COLORS[item.status]}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                        {item.subject}
                      </p>
                      <p className="mt-0.5 truncate text-[13.5px]" style={{ color: 'var(--text-body)' }}>
                        {displaySubtopic(item.subtopic)}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/quiz?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}&subtopic=${encodeURIComponent(item.subtopic)}&back=/dashboard`}
                      className="btn btn-quiet control-sm shrink-0"
                    >
                      Quiz
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Your subjects"
            action={
              <Link
                href="/dashboard/subjects"
                className="text-[13px] font-medium text-[var(--brand)] hover:underline"
              >
                View all
              </Link>
            }
          >
            <ul className="flex flex-col">
              {subjects.map((subject) => {
                const locked = isSubjectLocked(subject, profile)
                const pct = subjectStats[subject] ?? 0
                const size = subjectSizes[subject] || 0
                return (
                  <li
                    key={subject}
                    className="border-b last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <Link
                      href={
                        locked
                          ? '/dashboard/profile#unlock'
                          : `/dashboard/syllabus/${getSlugForSubject(subject)}`
                      }
                      className="flex items-center gap-4 rounded-[10px] px-2 py-3 transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
                        style={{ color: locked ? 'var(--text-faint)' : 'var(--text)' }}
                      >
                        {subject}
                      </span>
                      {locked ? (
                        <span className="shrink-0 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                          locked
                        </span>
                      ) : hasActivity ? (
                        <>
                          <span
                            className="hidden h-1 w-20 shrink-0 overflow-hidden rounded-full sm:block"
                            style={{ background: 'var(--border-strong)' }}
                          >
                            <span
                              className="bar-fill block h-full rounded-full"
                              style={{ width: `${pct}%`, background: 'var(--brand)' }}
                            />
                          </span>
                          <span
                            className="w-10 shrink-0 text-right text-[12.5px] font-semibold tabular-nums"
                            style={{ color: 'var(--brand)' }}
                          >
                            {pct}%
                          </span>
                        </>
                      ) : (
                        <span
                          className="shrink-0 text-[12px] tabular-nums"
                          style={{ color: 'var(--text-faint)' }}
                        >
                          {size} subtopics
                        </span>
                      )}
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
                <span className="text-[13.5px]" style={{ color: 'var(--text-body)' }}>
                  Have a school code? Unlock every subject free.
                </span>
              </Link>
            )}
          </Section>
        </div>

        <TodoList className="mb-12" title="To-do" compact limit={5} subjects={allSubjects} />

      </Page>
    </DashboardLayout>
  )
}
