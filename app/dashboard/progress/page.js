'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Heatmap from '@/components/Heatmap'
import { mergeSyllabusWithProgress } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

const STAT_CARDS = [
  { key: 'total', label: 'Total tracked', color: 'text-[#1a2e1e]' },
  { key: 'mastered', label: 'Mastered', color: 'text-[#2D6A4F]' },
  { key: 'decaying', label: 'Decaying', color: 'text-[#f59e0b]' },
  { key: 'confident', label: 'Shaky', color: 'text-[#d97706]' },
  { key: 'inProgress', label: 'Weak', color: 'text-[#dc2626]' },
]

export default function ProgressPage() {
  const [profile, setProfile] = useState(null)
  const [heatmapItems, setHeatmapItems] = useState([])
  const [summary, setSummary] = useState({ total: 0, mastered: 0, inProgress: 0, confident: 0 })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
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

      const [{ data: syllabusRows }, { data: progressRows }] = await Promise.all([
        subjects.length
          ? supabase.from('syllabus_content').select('*').in('subject', subjects)
          : { data: [] },
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
      })
      setHeatmapItems(heatmap)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading progress…</p>
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
          <h1 className="text-[28px] font-bold text-[#1a2e1e] mb-1">Progress</h1>
          <p className="text-sm text-[#6b7280]">
            {overallPercent}% of all subtopics mastered across {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {STAT_CARDS.map((stat) => (
            <div
              key={stat.key}
              className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <p className={`text-[32px] font-bold leading-tight ${stat.color}`}>
                {summary[stat.key]}
              </p>
              <p className="text-sm text-[#6b7280] mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {bySubject.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-3">
              By Subject
            </h2>
            <div className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
              {bySubject.map(({ subject, percent }) => (
                <div key={subject} className="flex items-center gap-4">
                  <span className="w-56 shrink-0 text-sm text-[#374151] truncate">{subject}</span>
                  <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2D6A4F] rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold text-[#2D6A4F]">
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
