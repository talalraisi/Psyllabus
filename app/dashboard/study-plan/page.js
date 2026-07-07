'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { getSlugForSubject } from '@/lib/subject-map'
import { buildProgressMap, STATUS_LABELS } from '@/lib/progress'

export default function StudyPlanPage() {
  const [profile, setProfile] = useState(null)
  const [recommendations, setRecommendations] = useState([])
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

      const progressMap = buildProgressMap(progressRows)
      const priority = { not_started: 0, in_progress: 1, confident: 2, mastered: 3 }

      const items = (syllabusRows || [])
        .map((row) => ({
          ...row,
          status: progressMap[`${row.subject}::${row.subtopic}`] || 'not_started',
        }))
        .filter((row) => row.status !== 'mastered')
        .sort((a, b) => priority[a.status] - priority[b.status])
        .slice(0, 12)

      setRecommendations(items)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-[#1a2e1e]">Building your study plan…</p>
      </div>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <div className="p-8 max-w-4xl mx-auto">
        <header className="mb-10">
          <p className="text-sm font-medium text-[#2D6A4F] uppercase tracking-wide mb-1">
            Study Plan
          </p>
          <h1 className="text-3xl font-bold text-[#1a2e1e]">What to study today</h1>
          <p className="text-[#6b7280] mt-2">
            Subtopics that need attention — not started and in progress come first
          </p>
        </header>

        {recommendations.length === 0 ? (
          <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center">
            <p className="text-4xl mb-4">🎉</p>
            <h2 className="text-xl font-bold text-[#1a2e1e]">All caught up!</h2>
            <p className="text-[#6b7280] mt-2">
              Every subtopic is marked mastered. Keep reviewing to stay sharp.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center gap-4"
              >
                <span className="w-8 h-8 rounded-full bg-[#E8D5B0] flex items-center justify-center text-sm font-bold text-[#1a2e1e] shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#6b7280]">{item.subject} · {item.topic}</p>
                  <p className="font-medium text-[#1a2e1e] truncate">{item.subtopic}</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#f8f6f1] text-[#6b7280] shrink-0">
                  {STATUS_LABELS[item.status]}
                </span>
                <Link
                  href={`/dashboard/syllabus/${getSlugForSubject(item.subject)}`}
                  className="text-sm font-medium text-[#2D6A4F] hover:underline shrink-0"
                >
                  Go →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
