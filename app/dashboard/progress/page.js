'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Heatmap from '@/components/Heatmap'
import { buildProgressMap, mergeSyllabusWithProgress, STATUS_LABELS, STATUS_COLORS } from '@/lib/progress'

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

      const heatmap = mergeSyllabusWithProgress(syllabusRows || [], buildProgressMap(progressRows))

      setSummary({
        total: heatmap.length,
        mastered: heatmap.filter((i) => i.status === 'mastered').length,
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
        <p className="text-[#1a2e1e]">Loading progress…</p>
      </div>
    )
  }

  const subjects = profile.subjects || []
  const overallPercent = summary.total
    ? Math.round((summary.mastered / summary.total) * 100)
    : 0

  return (
    <DashboardLayout profile={profile}>
      <div className="p-8 max-w-6xl mx-auto">
        <header className="mb-10">
          <p className="text-sm font-medium text-[#2D6A4F] uppercase tracking-wide mb-1">
            Progress
          </p>
          <h1 className="text-3xl font-bold text-[#1a2e1e]">Your overall progress</h1>
          <p className="text-[#6b7280] mt-2">
            {overallPercent}% of all subtopics mastered across {subjects.length} subjects
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total subtopics', value: summary.total, color: 'bg-[#f8f6f1]' },
            { label: 'Mastered', value: summary.mastered, color: STATUS_COLORS.mastered + ' text-white' },
            { label: 'Confident', value: summary.confident, color: STATUS_COLORS.confident },
            { label: 'In progress', value: summary.inProgress, color: STATUS_COLORS.in_progress },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl p-5 border border-gray-100 ${stat.color}`}
            >
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm mt-1 opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[#1a2e1e]">Overall completion</span>
            <span className="font-bold text-[#2D6A4F]">{overallPercent}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2D6A4F] rounded-full transition-all"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>

        <Heatmap items={heatmapItems} subjects={subjects} />
      </div>
    </DashboardLayout>
  )
}
