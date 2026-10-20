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
import { readSnapshot, writeSnapshot, snapshotFor, loadPlanInputs, computePlan, isTaskDone } from '@/lib/plan-data'
import { clock } from '@/components/plan/TodayPlan'
import { WEEKDAYS } from '@/lib/study-plan'
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
import { buildEffectiveProgressMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { hasAllSubjects, isSubjectLocked, accessibleSubjects, hasSyllabi, canUse } from '@/lib/access'
import StudyHeatmap from '@/components/StudyHeatmap'
import { studyIntervals, minutesPerDay } from '@/lib/study-time'
import { primeStudyDays, restDaysFor } from '@/lib/streak'
import { StreakCard } from '@/components/Streak'
import WaysToStudy from '@/components/WaysToStudy'
import WelcomeTour, { tourDone, resetTour } from '@/components/WelcomeTour'
import MapPreview from '@/components/map/MapPreview'

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
  review: 'text-[var(--status-weak)]',
  target: 'text-[var(--brand)]',
  noquiz: 'text-[var(--text-faint)]',
}

/** Where a plan task's button goes, and what it says. */
function actionFor(task) {
  if (task.kind === 'review') return { href: '/dashboard/mistakes', label: 'Review' }
  if (task.quizzable && task.subtopic) {
    return {
      href: `/dashboard/quiz?subject=${encodeURIComponent(task.subject)}&topic=${encodeURIComponent(task.topic)}&subtopic=${encodeURIComponent(task.subtopic)}&back=/dashboard`,
      label: 'Quiz',
    }
  }
  return { href: `/dashboard/syllabus/${getSlugForSubject(task.subject)}`, label: 'Open' }
}

const taskTitle = (task) => (task.kind === 'review' ? 'Mistakes due back' : displaySubtopic(task.subtopic))

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
  // The first day on the study plan with something left on it, and what.
  const [upNext, setUpNext] = useState(null)
  // Minutes studied per local day for the past five years: quizzes and the
  // session timer, with any time covered by both counted once.
  const [studyDays, setStudyDays] = useState([])
  // Every subtopic with its level, for the map.
  const [items, setItems] = useState([])
  const [mapSubject, setMapSubject] = useState('')
  // Whether the study plan has been set up, and whether this account has
  // been through the welcome tour on this device.
  const [planReady, setPlanReady] = useState(false)
  const [toured, setToured] = useState(true)
  const [loading, setLoading] = useState(true)

  // Skipping the tour (inside it) puts the plan box in its place.
  useEffect(() => {
    const onTour = () => setToured(true)
    window.addEventListener('psyllabus:tour', onTour)
    return () => window.removeEventListener('psyllabus:tour', onTour)
  }, [])

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
      // Five years back, the longest frame the heatmap offers. The rows are
      // two small columns each, so even a heavy user's five years is a few
      // thousand of them at most.
      const since = new Date()
      since.setFullYear(since.getFullYear() - 5)
      since.setMonth(0, 1)
      const [profileData, { data: progressRows }, { count: dueCount }, eventsResult, attemptsResult, sessionsResult] =
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
          // Time spent answering questions, and time the session timer ran.
          supabase
            .from('quiz_attempts')
            .select('completed_at, elapsed_seconds')
            .eq('user_id', user.id)
            .gte('completed_at', since.toISOString()),
          supabase
            .from('study_sessions')
            .select('started_at, ended_at')
            .eq('user_id', user.id)
            .gte('started_at', since.toISOString()),
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

      // What to do next is whatever the study plan says, planned the same
      // way and reading the same kept day (lib/plan-data.js), so the two
      // pages can never name different things.
      const at = new Date()
      const inputs = await loadPlanInputs(supabase, {
        userId: user.id,
        profile: profileData,
        at,
        progressRows: progressRows || [],
        events: eventsResult?.data || [],
      })
      const held = readSnapshot(profileData.id)
      const { plan, configured } = computePlan({ profile: profileData, ...inputs, snapshot: held, now: at })
      setPlanReady(configured)
      setItems(merged)
      setToured(tourDone(profileData.id))
      setMapSubject(
        accessibleSubjects(profileData).find((x) => !IB_CORE_SUBJECTS.includes(x)) || ''
      )
      if (configured) {
        const snap = snapshotFor(plan, held)
        if (snap) writeSnapshot(profileData.id, snap)
      }
      const doneToday = (t) => isTaskDone(t, { mistakes: inputs.mistakes, quizzedToday: inputs.quizzedToday, now: at })
      let next = null
      for (const [i, day] of (plan?.days || []).entries()) {
        const left = i === 0 ? day.tasks.filter((t) => !doneToday(t)) : day.tasks
        if (left.length) {
          next = { today: i === 0, date: day.date, tasks: left }
          break
        }
      }
      setUpNext(next)

      const pending = (eventsResult?.data || [])
        .filter((e) => new Date(e.due_at).getTime() >= Date.now())
        .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      setNextEvent(pending[0] || null)
      setNow(new Date())

      // Merged rather than added, because the timer is meant to keep running
      // through quizzes; split by the student's own calendar day. See
      // lib/study-time.js.
      const days = minutesPerDay(
        studyIntervals({ attempts: attemptsResult?.data || [], sessions: sessionsResult?.data || [] })
      )
      // The sidebar's streak reads the same days instead of fetching them again.
      primeStudyDays(user.id, days)
      setStudyDays(days)
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
  const restDays = restDaysFor(profile)

  // A student who has not been tested yet gets an orientation screen instead of
  // a wall of zeros. Metrics appear once there is something real to show.
  const hasActivity = counts.tested > 0

  // One thing to start, then at most three more. The whole queue lives on the
  // study plan; a dashboard that lists nine subtopics is a to-do list, and a
  // to-do list that long is one nobody opens.
  // The one thing to do, and the two after it. The planner already ranks the
  // whole queue; a dashboard's job is to name the top of it, not reprint it.
  const [nextUp, ...afterThat] = upNext?.tasks || []
  const queued = afterThat.slice(0, 3)
  const upNextDay = upNext && !upNext.today ? WEEKDAYS[new Date(`${upNext.date}T12:00:00`).getDay()] : null

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

  // The map beside the subject list, for accounts that have it.
  const mapRows = items.filter((r) => r.subject === mapSubject)
  const showMap = canUse('subjectMap', profile) && mapRows.length > 0

  // A free account with exactly one subject open: the only case where the
  // dashboard points at a subject rather than at the plan.
  const singleFree =
    !premium && accessibleSubjects(profile).filter((x) => !IB_CORE_SUBJECTS.includes(x)).length === 1

  // Where a quick set of questions starts: the plan's next quizzable task, or
  // the first subject they can open.
  const studyFocus =
    nextUp?.quizzable && nextUp.subject && nextUp.subtopic
      ? { subject: nextUp.subject, topic: nextUp.topic, subtopic: nextUp.subtopic }
      : firstSubject
        ? { subject: firstSubject }
        : null

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
        {!hasActivity && !toured ? (
          <WelcomeTour
            profile={profile}
            firstName={firstName}
            syllabi={hasSyllabi(profile)}
            subjectHref={singleFree ? startHref : null}
            subjectName={firstSubject}
          />
        ) : !hasActivity ? (
          /* After the tour, the place to start is the plan: it knows what
             to do first. A free account with one subject open can also go
             straight to it, since there is only one place to go. */
          <section
            className="elev-lg mb-8 rounded-[16px] border p-6 sm:p-7"
            style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}
          >
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              Start here
            </p>
            <h2 className="mt-3 text-[clamp(1.35rem,2.8vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
              {planReady ? 'Your plan for today is ready' : 'Set up your study plan'}
            </h2>
            <p className="mt-2.5 max-w-lg text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {planReady
                ? nextUp
                  ? `First up: ${taskTitle(nextUp)}${nextUp.subject ? ` in ${nextUp.subject}` : ''}. Finish its quiz and the dashboard starts filling in.`
                  : 'Open it to see what is on today.'
                : 'Two minutes: when you are free and when your exams are. From then on it tells you what to study every day.'}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/dashboard/study-plan" className="btn btn-solid control-lg">
                {planReady ? "Open today's plan" : 'Set up my study plan'}
                <IconArrowRight width={16} height={16} />
              </Link>
              {singleFree && (
                <Link href={startHref} className="btn btn-outline control-md">
                  Open {firstSubject}
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  resetTour(profile.id)
                  setToured(false)
                }}
                className="text-[13px] font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Replay the tour
              </button>
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
              {upNextDay ? `From your plan · ${upNextDay}` : 'From your plan · next up'}
            </p>

            <h2 className="mt-3 text-[clamp(1.35rem,2.8vw,1.8rem)] font-semibold leading-tight tracking-[-0.028em]">
              {taskTitle(nextUp)}
            </h2>
            <p className="mt-2 text-[13.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {[
                nextUp.subject,
                nextUp.topic,
                nextUp.start != null && !nextUp.overflow ? `${clock(nextUp.start)} · ${nextUp.minutes} min` : `${nextUp.minutes} min`,
              ]
                .filter(Boolean)
                .join(' · ')}
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
              <Link href={actionFor(nextUp).href} className="btn btn-solid control-lg">
                {nextUp.kind === 'review' ? 'Review them' : actionFor(nextUp).label === 'Quiz' ? 'Sit this one' : 'Open it'}
                <IconArrowRight width={16} height={16} />
              </Link>
              <Link href="/dashboard/study-plan" className="btn btn-outline control-md">
                Today&apos;s plan
              </Link>
              {counts.due > 0 && nextUp.kind !== 'review' && (
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

        {/* Why come back tomorrow: the streak, today's goal and the week. */}
        <StreakCard
          profile={profile}
          // A new account already has one big button above; this would be a second.
          cta={hasActivity ? (nextUp ? { href: actionFor(nextUp).href, label: `Start: ${taskTitle(nextUp)}` } : { href: '/dashboard/test', label: 'Build a test' }) : null}
        />

        <Section title="Ways to study">
          <WaysToStudy profile={profile} focus={studyFocus} />
        </Section>

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

        {/* Time studied. Only once there is some: a year of empty squares on a
            new account says nothing and looks like a broken page, the same
            reason the cards above wait for activity. */}
        {studyDays.length > 0 && (
          <Section title="Time studied">
            <div
              className="rounded-[16px] border p-5 sm:p-6"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <StudyHeatmap data={studyDays} rest={restDays} />
            </div>
          </Section>
        )}

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
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_COLORS[item.status] || 'bg-[var(--status-weak)]'}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                      {item.start != null && !item.overflow ? `${clock(item.start)} · ` : ''}
                      {item.subject}
                    </p>
                    <p className="mt-0.5 truncate text-[13.5px]" style={{ color: 'var(--text-body)' }}>
                      {taskTitle(item)}
                    </p>
                  </div>
                  <Link href={actionFor(item).href} className="btn btn-quiet control-sm shrink-0">
                    {actionFor(item).label}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Your subjects, with the map of whichever one is picked beside
            them: the list says how far, the map says where. */}
        <Section
          title="Your subjects"
          action={
            <span className="flex items-center gap-4">
              <Link
                href="/onboarding?edit=subjects"
                className="text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
              >
                Change subjects
              </Link>
              <Link
                href="/dashboard/subjects"
                className="text-[13px] font-medium text-[var(--brand)] hover:underline"
              >
                View all
              </Link>
            </span>
          }
        >
          <div className={showMap ? 'grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start' : ''}>
            {showMap && (
              <div className="min-w-0">
                <MapPreview subject={mapSubject} rows={mapRows} />
                <Link
                  href={`/dashboard/map?subject=${encodeURIComponent(mapSubject)}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--brand)] hover:underline"
                >
                  Open the full map
                  <IconArrowRight width={13} height={13} />
                </Link>
              </div>
            )}

            <div className="min-w-0">
              {showMap && (
                <p className="mb-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                  Pick a subject to see its map.
                </p>
              )}
              <ul className="flex flex-col">
                {subjects.map((subject) => {
                  const locked = isSubjectLocked(subject, profile)
                  const pct = subjectStats[subject] ?? 0
                  const size = subjectSizes[subject] || 0
                  const picked = showMap && subject === mapSubject
                  const inner = (
                    <>
                      <span
                        className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium"
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
                        <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                          {size} subtopics
                        </span>
                      )}
                    </>
                  )
                  return (
                    <li
                      key={subject}
                      className="flex items-center gap-1 border-b last:border-b-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {showMap && !locked ? (
                        <button
                          type="button"
                          onClick={() => setMapSubject(subject)}
                          aria-pressed={picked}
                          className="flex min-w-0 flex-1 items-center gap-4 rounded-[10px] px-2 py-3 transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                          style={picked ? { background: 'var(--brand-tint)' } : undefined}
                        >
                          {inner}
                        </button>
                      ) : (
                        <Link
                          href={locked ? '/dashboard/profile#unlock' : `/dashboard/syllabus/${getSlugForSubject(subject)}`}
                          className="flex min-w-0 flex-1 items-center gap-4 rounded-[10px] px-2 py-3 transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                        >
                          {inner}
                        </Link>
                      )}
                      {showMap && !locked && (
                        <Link
                          href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
                          aria-label={`Open ${subject}`}
                          title="Open syllabus"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] transition-colors hover:bg-[var(--surface-sunken)]"
                          style={{ color: 'var(--text-faint)' }}
                        >
                          <IconChevronRight width={15} height={15} />
                        </Link>
                      )}
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
            </div>
          </div>
        </Section>

        <TodoList className="mb-12" title="To-do" compact limit={5} subjects={allSubjects} />

      </Page>
    </DashboardLayout>
  )
}
