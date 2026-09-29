'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import SubjectProgress from '@/components/SubjectProgress'
import { Page, PageHeader } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { mergeSyllabusWithProgress } from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'

export default function ProgressPage() {
  const [profile, setProfile] = useState(null)
  const [heatmapItems, setHeatmapItems] = useState([])
  const [detail, setDetail] = useState({})
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

      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })

      if (!profileData) {
        router.push('/onboarding')
        return
      }

      setProfile(profileData)
      // The core is not quizzed, so it cannot be measured here: every one of
      // its rows would sit at 0% for ever and drag the overall figure down
      // with it. It has its own page, where ticking things off is the point.
      const subjects = (profileData.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s))

      const [syllabusRows, { data: progressRows }] = await Promise.all([
        getSyllabus(supabase, subjects),
        supabase.from('progress').select('*').eq('user_id', user.id),
      ])

      const heatmap = mergeSyllabusWithProgress(
        syllabusRows || [],
        buildEffectiveProgressMap(progressRows)
      )

      setDetail(buildProgressDetailMap(progressRows))
      setHeatmapItems(heatmap)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">Loading progress…</p>
      </div>
    )
  }

  const subjects = (profile.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s))

  /* One number in the header, and it is the one worth acting on.
     "X% mastered" flattered: a subject 60% proved with the rest untested and
     one 60% proved with the rest actively wrong are not the same evening, and
     the percentage could not tell them apart. */
  const needsWork = heatmapItems.filter((i) =>
    ['not_started', 'in_progress', 'decaying'].includes(i.status)
  ).length

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title="Progress"
          subtitle={
            heatmapItems.length
              ? `${needsWork} of ${heatmapItems.length} subtopics need work across ${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`
              : 'Take a quiz and this fills in.'
          }
        />

        {/* One list, three levels deep, every row ending in something to do.
            It replaces four readings of the same data: a percentage in the
            subtitle, counts by status in a row of cards, the same percentages
            again as bars, and every subtopic in the course as a coloured
            square. None of them answered "which part of this needs me
            tonight", and the only button on any of them opened a diagram
            showing it a fifth way. */}
        <SubjectProgress items={heatmapItems} subjects={subjects} detail={detail} />

        {subjects.length > 0 && (
          <p className="mt-10 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Prefer to see the shape of a course rather than a list?{' '}
            <Link href="/dashboard/map" className="underline" style={{ color: 'var(--brand)' }}>
              Open the map
            </Link>
            .
          </p>
        )}
      </Page>
    </DashboardLayout>
  )
}
