'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Heatmap from '@/components/Heatmap'
import { Page, PageHeader, Section, StatRow } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { mergeSyllabusWithProgress } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

// Read left to right this is the ladder itself: everything tracked, then the
// same subtopics sorted by how well they are actually held.
const STAT_CARDS = [
  { key: 'total', label: 'tracked', tone: 'var(--text)' },
  { key: 'mastered', label: 'mastered', tone: 'var(--status-mastered)' },
  { key: 'proficient', label: 'proficient', tone: 'var(--status-proficient)' },
  { key: 'confident', label: 'developing', tone: 'var(--status-developing)' },
  { key: 'inProgress', label: 'weak', tone: 'var(--status-weak)' },
  { key: 'decaying', label: 'fading', tone: 'var(--status-fading)' },
]

export default function ProgressPage() {
  const [profile, setProfile] = useState(null)
  const [heatmapItems, setHeatmapItems] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    mastered: 0,
    proficient: 0,
    confident: 0,
    inProgress: 0,
    decaying: 0,
  })
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
      const subjects = profileData.subjects || []

      const [syllabusRows, { data: progressRows }] = await Promise.all([
        getSyllabus(supabase, subjects),
        supabase.from('progress').select('*').eq('user_id', user.id),
      ])

      const heatmap = mergeSyllabusWithProgress(
        syllabusRows || [],
        buildEffectiveProgressMap(progressRows)
      )

      setSummary({
        total: heatmap.length,
        mastered: heatmap.filter((i) => i.status === 'mastered').length,
        decaying: heatmap.filter((i) => i.status === 'decaying').length,
        inProgress: heatmap.filter((i) => i.status === 'in_progress').length,
        confident: heatmap.filter((i) => i.status === 'confident').length,
        proficient: heatmap.filter((i) => i.status === 'proficient').length,
      })
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

  const subjects = profile.subjects || []
  const overallPercent = summary.total
    ? Math.round((summary.mastered / summary.total) * 100)
    : 0

  const bySubject = subjects
    .map((subject) => {
      const items = heatmapItems.filter((i) => i.subject === subject)
      const mastered = items.filter((i) => i.status === 'mastered').length
      return {
        subject,
        count: items.length,
        percent: items.length ? Math.round((mastered / items.length) * 100) : 0,
      }
    })
    .filter((s) => s.count > 0)

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title="Progress"
          subtitle={`${overallPercent}% of all subtopics mastered across ${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`}
        />

        <StatRow
          className="mb-14"
          stats={STAT_CARDS.map((stat) => ({
            label: stat.label,
            value: summary[stat.key],
            tone: stat.tone,
          }))}
        />

        {bySubject.length > 0 && (
          <Section title="By subject">
            <ul className="flex flex-col gap-4">
              {bySubject.map(({ subject, percent }) => (
                <li key={subject} className="flex items-center gap-5">
                  <span className="w-56 shrink-0 truncate text-[14px]">{subject}</span>
                  <div
                    className="h-1 flex-1 overflow-hidden rounded-full"
                    style={{ background: 'var(--border-strong)' }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: `${percent}%`, background: 'var(--brand)' }}
                    />
                  </div>
                  <span
                    className="w-11 shrink-0 text-right text-[13.5px] font-semibold tabular-nums"
                    style={{ color: 'var(--brand)' }}
                  >
                    {percent}%
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Heatmap items={heatmapItems} subjects={subjects} />
      </Page>
    </DashboardLayout>
  )
}
