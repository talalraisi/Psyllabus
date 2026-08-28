'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Heatmap from '@/components/Heatmap'
import { mergeSyllabusWithProgress } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

const STAT_CARDS = [
  { key: 'total', label: 'Total tracked', color: 'text-[var(--text)]' },
  { key: 'mastered', label: 'Mastered', color: 'text-[var(--status-mastered)]' },
  { key: 'proficient', label: 'Proficient', color: 'text-[var(--status-proficient)]' },
  { key: 'confident', label: 'Developing', color: 'text-[var(--status-developing)]' },
  { key: 'inProgress', label: 'Weak', color: 'text-[var(--status-weak)]' },
  { key: 'decaying', label: 'Fading', color: 'text-[var(--status-fading)]' },
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
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="t-page-title mb-1">Progress</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {overallPercent}% of all subtopics mastered across {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {STAT_CARDS.map((stat) => (
            <div
              key={stat.key}
              className="surface p-5"
            >
              <p className={`t-stat ${stat.color}`}>
                {summary[stat.key]}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {bySubject.length > 0 && (
          <section className="mb-10">
            <h2 className="t-overline mb-3">
              By Subject
            </h2>
            <div className="surface p-5 space-y-4">
              {bySubject.map(({ subject, percent }) => (
                <div key={subject} className="flex items-center gap-4">
                  <span className="w-56 shrink-0 text-sm text-[var(--text-body)] truncate">{subject}</span>
                  <div className="flex-1 h-2 bg-[var(--surface-sunken)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--brand)] rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold text-[var(--brand)]">
                    {percent}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <Heatmap items={heatmapItems} subjects={subjects} />
      </div>
    </DashboardLayout>
  )
}
