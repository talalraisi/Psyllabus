'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus, invalidateProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { getSlugForSubject } from '@/lib/subject-map'
import { progressKey, STATUS_LABELS } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import {
  isSubjectLocked,
  isPremium,
  freeSubject,
  canSwitchFreeSubject,
  freeSubjectLockUntil,
} from '@/lib/access'

/** Status keys as stored, mapped to the one palette the whole product uses. */
const STATUS_VAR = {
  mastered: 'var(--status-mastered)',
  proficient: 'var(--status-proficient)',
  confident: 'var(--status-developing)',
  in_progress: 'var(--status-weak)',
  decaying: 'var(--status-fading)',
  not_started: 'var(--status-untested)',
}

const LADDER = ['mastered', 'proficient', 'confident', 'decaying', 'in_progress', 'not_started']

export default function SubjectsPage() {
  const [profile, setProfile] = useState(null)
  const [counts, setCounts] = useState({})
  const [breakdown, setBreakdown] = useState({})
  const [loading, setLoading] = useState(true)

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight. A page that has arrived but has no data yet is the
  // part that feels broken.
  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])
  const [switching, setSwitching] = useState('')
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

      const [syllabusRows, { data: progressRows }] = await Promise.all([
        getSyllabus(supabase, subjects),
        supabase.from('progress').select('*').eq('user_id', user.id),
      ])

      const effective = buildEffectiveProgressMap(progressRows)
      const nextCounts = {}
      const nextBreakdown = {}
      for (const subject of subjects) {
        const rows = (syllabusRows || []).filter((r) => r.subject === subject)
        nextCounts[subject] = rows.length
        // How the subject is actually made up, not just one average of it.
        const tally = {}
        for (const row of rows) {
          const status = effective[progressKey(subject, row.subtopic)] || 'not_started'
          tally[status] = (tally[status] || 0) + 1
        }
        nextBreakdown[subject] = tally
      }

      setCounts(nextCounts)
      setBreakdown(nextBreakdown)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  // Free accounts choose which single subject is open, and can change it.
  const chooseFreeSubject = async (subject) => {
    if (switching) return
    // Held for a period after each change, so the free plan cannot be walked
    // through every subject one quiz at a time.
    const { allowed } = canSwitchFreeSubject(profile)
    if (!allowed) return

    setSwitching(subject)
    const lockedUntil = freeSubjectLockUntil()
    const { error } = await supabase
      .from('profiles')
      .update({ free_subject: subject, free_subject_locked_until: lockedUntil })
      .eq('id', profile.id)
    if (!error) {
      invalidateProfile(profile.id)
      setProfile((p) => ({
        ...p,
        free_subject: subject,
        free_subject_locked_until: lockedUntil,
      }))
    }
    setSwitching('')
  }

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="My Subjects" width="wide" rows={4} variant="cards" />
      </DashboardLayout>
    )
  }

  const all = profile.subjects || []
  const subjects = all.filter((s) => !IB_CORE_SUBJECTS.includes(s))
  const core = all.filter((s) => IB_CORE_SUBJECTS.includes(s))

  const canSwitch = canSwitchFreeSubject(profile)

  const SubjectCard = ({ subject, locked }) => {
    const count = counts[subject] ?? 0
    const target = profile.target_grades?.[subject]
    const tally = breakdown[subject] || {}
    const masteredCount = tally.mastered || 0
    // Left to right in the order the ladder is climbed, so the bar reads the
    // way the levels do.
    const segments = LADDER.map((key) => ({ key, n: tally[key] || 0 })).filter((seg) => seg.n > 0)

    return (
      // Fixed column layout with the action pinned to the bottom, so cards line
      // up regardless of how the subject name wraps. The ring is gone: the rest
      // of the product states mastery as a bar against a target, and a second
      // shape for the same number made the two look like different measures.
      <div
        className="flex flex-col rounded-[12px] border p-5"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      >
        <h2 className="text-[15.5px] font-semibold leading-snug tracking-[-0.015em]">{subject}</h2>
        <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          {count} subtopic{count === 1 ? '' : 's'}
          {target ? ` · Target ${target}` : ''}
        </p>

        {/* One percentage said how much was mastered and hid everything else,
            so a subject that was 20% mastered and 70% weak looked the same as
            one that was 20% mastered and untouched. This is the whole subject
            at a glance: how many are proved, and what the rest are. */}
        <div className="mb-6 mt-6">
          <div className="flex items-baseline gap-2">
            <span
              className="text-[26px] font-semibold leading-none tracking-[-0.028em] tabular-nums"
              style={{ color: locked ? 'var(--text-faint)' : 'var(--text)' }}
            >
              {locked ? '—' : masteredCount}
            </span>
            <span className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
              {locked ? 'locked' : `of ${count} mastered`}
            </span>
          </div>

          <div
            className="mt-4 flex h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--border-strong)' }}
            role="img"
            aria-label={
              locked
                ? 'Locked'
                : segments
                    .map((seg) => `${seg.n} ${STATUS_LABELS[seg.key] || 'Untested'}`)
                    .join(', ') || 'Nothing tested yet'
            }
          >
            {!locked &&
              segments.map((seg) => (
                <span
                  key={seg.key}
                  className="h-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${(seg.n / Math.max(1, count)) * 100}%`,
                    background: STATUS_VAR[seg.key],
                  }}
                />
              ))}
          </div>

          {!locked && (
            <ul className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
              {segments
                .filter((seg) => seg.key !== 'not_started')
                .map((seg) => (
                  <li
                    key={seg.key}
                    className="flex items-center gap-1.5 text-[11.5px] tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{ background: STATUS_VAR[seg.key] }}
                    />
                    {seg.n} {(STATUS_LABELS[seg.key] || '').toLowerCase()}
                  </li>
                ))}
            </ul>
          )}
        </div>

        {locked ? (
          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={() => chooseFreeSubject(subject)}
              disabled={!!switching || !canSwitch.allowed}
              title={
                canSwitch.allowed
                  ? undefined
                  : `You can change subject again in ${canSwitch.daysLeft} day${canSwitch.daysLeft === 1 ? '' : 's'}`
              }
              className="btn btn-outline control-md w-full"
            >
              {switching === subject
                ? 'Switching'
                : canSwitch.allowed
                  ? 'Study this one instead'
                  : `Locked for ${canSwitch.daysLeft}d`}
            </button>
            <Link href="/dashboard/profile#unlock" className="btn btn-quiet control-md w-full">
              Unlock everything
            </Link>
          </div>
        ) : (
          <Link
            href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
            className="btn btn-solid control-md mt-auto w-full"
          >
            Open syllabus
          </Link>
        )}
      </div>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title="My Subjects"
          subtitle={`Every topic and subtopic across your ${profile.curriculum} programme`}
        />

        <Section title="Subjects">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <SubjectCard
                key={subject}
                subject={subject}
                locked={isSubjectLocked(subject, profile)}
              />
            ))}
          </div>

          {!isPremium(profile) && subjects.length > 1 && (
            <div className="mt-6 border-l-2 pl-4" style={{ borderColor: 'var(--border-strong)' }}>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                You are on the free plan, which opens one subject at a time. Right now that is{' '}
                <strong className="text-[var(--text)]">{freeSubject(profile)}</strong>. Switch to a
                different one whenever you like, as often as you like.
              </p>
              <Link
                href="/dashboard/profile#unlock"
                className="mt-2 inline-block text-[13.5px] font-medium text-[var(--brand)] hover:underline"
              >
                Open all of them with a school code
              </Link>
            </div>
          )}
        </Section>

        {/* The core sits apart: it is compulsory, not one of the six choices. */}
        {core.length > 0 && (
          <Section title="Diploma core">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {core.map((subject) => (
                <SubjectCard key={subject} subject={subject} locked={false} />
              ))}
            </div>
          </Section>
        )}
      </Page>
    </DashboardLayout>
  )
}
