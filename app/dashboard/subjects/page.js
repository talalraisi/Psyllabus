'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, PageLoading } from '@/components/PageShell'
import ProgressRing from '@/components/ProgressRing'
import { getSlugForSubject } from '@/lib/subject-map'
import { computeCompletionPercent } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { isSubjectLocked, isPremium } from '@/lib/access'

export default function SubjectsPage() {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({})
  const [counts, setCounts] = useState({})
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
        .maybeSingle()

      if (!profileData) {
        router.push('/onboarding')
        return
      }

      setProfile(profileData)
      const subjects = profileData.subjects || []

      const [{ data: syllabusRows }, { data: progressRows }] = await Promise.all([
        subjects.length
          ? supabase.from('syllabus_content').select('*').in('subject', subjects)
          : { data: [] },
        supabase.from('progress').select('*').eq('user_id', user.id),
      ])

      const effective = buildEffectiveProgressMap(progressRows)
      const nextStats = {}
      const nextCounts = {}
      for (const subject of subjects) {
        const rows = (syllabusRows || []).filter((r) => r.subject === subject)
        nextCounts[subject] = rows.length
        nextStats[subject] = computeCompletionPercent(rows, effective, subject)
      }

      setStats(nextStats)
      setCounts(nextCounts)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="My Subjects" width="wide" rows={4} />
      </DashboardLayout>
    )
  }

  const all = profile.subjects || []
  const subjects = all.filter((s) => !IB_CORE_SUBJECTS.includes(s))
  const core = all.filter((s) => IB_CORE_SUBJECTS.includes(s))

  const SubjectCard = ({ subject, locked }) => {
    const pct = stats[subject] ?? 0
    const count = counts[subject] ?? 0
    const target = profile.target_grades?.[subject]

    return (
      // Fixed column layout with the action pinned to the bottom, so cards line
      // up regardless of how the subject name wraps.
      <div className="surface surface-interactive flex flex-col p-5">
        <div className="mb-5 flex items-start gap-4">
          <ProgressRing progress={locked ? 0 : pct} size={64} />
          <div className="min-w-0 flex-1">
            <h2 className="t-card-title leading-snug">{subject}</h2>
            <p className="t-small mt-1">
              {count} subtopic{count === 1 ? '' : 's'}
              {target ? ` · Target ${target}` : ''}
            </p>
          </div>
        </div>

        {locked ? (
          <Link href="/dashboard/profile#unlock" className="btn btn-quiet control-md mt-auto w-full">
            Unlock with a code
          </Link>
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
            <Link
              href="/dashboard/profile#unlock"
              className="mt-3 block rounded-[var(--r-md)] border border-[var(--sand)] bg-[var(--sand)]/30 px-4 py-3 text-sm text-[var(--text-body)]"
            >
              Free plan covers one subject. Unlock the rest with your school code.
            </Link>
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
