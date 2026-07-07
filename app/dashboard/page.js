'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import ProgressRing from '@/components/ProgressRing'
import Heatmap from '@/components/Heatmap'
import { getSlugForSubject } from '@/lib/subject-map'
import { buildProgressMap, computeCompletionPercent, mergeSyllabusWithProgress } from '@/lib/progress'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [heatmapItems, setHeatmapItems] = useState([])
  const [subjectStats, setSubjectStats] = useState({})
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
          ? supabase
              .from('syllabus_content')
              .select('*')
              .in('subject', subjects)
          : { data: [] },
        supabase.from('progress').select('*').eq('user_id', user.id),
      ])

      const stats = {}
      for (const subject of subjects) {
        const subtopics = (syllabusRows || []).filter((r) => r.subject === subject)
        const progressMap = buildProgressMap(
          (progressRows || []).filter((p) => p.subject === subject)
        )
        stats[subject] = computeCompletionPercent(subtopics, progressMap, subject)
      }

      const heatmap = mergeSyllabusWithProgress(syllabusRows || [], buildProgressMap(progressRows))
      heatmap.sort((a, b) => {
        const si = subjects.indexOf(a.subject) - subjects.indexOf(b.subject)
        if (si !== 0) return si
        if (a.topic !== b.topic) return a.topic.localeCompare(b.topic)
        return a.subtopic.localeCompare(b.subtopic)
      })

      setSubjectStats(stats)
      setHeatmapItems(heatmap)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-[#1a2e1e]">Loading your dashboard…</p>
      </div>
    )
  }

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const subjects = profile.subjects || []

  return (
    <DashboardLayout profile={profile}>
      <div className="p-8 max-w-6xl mx-auto">
        <header className="mb-10">
          <p className="text-sm font-medium text-[#2D6A4F] uppercase tracking-wide mb-1">
            Dashboard
          </p>
          <h1 className="text-3xl font-bold text-[#1a2e1e]">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-[#6b7280] mt-2">
            Class of {profile.grad_year} · {profile.curriculum} · {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </p>
        </header>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#1a2e1e]">Your Subjects</h2>
            <Link
              href="/dashboard/subjects"
              className="text-sm font-medium text-[#2D6A4F] hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {subjects.map((subject) => {
              const progressPercent = subjectStats[subject] ?? 0
              const targetGrade = profile.target_grades?.[subject] || '—'
              const slug = getSlugForSubject(subject)

              return (
                <div
                  key={subject}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#E8D5B0] transition-all group"
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#1a2e1e] text-lg leading-snug">{subject}</h3>
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E8D5B0]/50 px-3 py-1">
                        <span className="text-xs text-[#6b7280]">Target grade</span>
                        <span className="text-sm font-bold text-[#1a2e1e]">{targetGrade}</span>
                      </div>
                    </div>
                    <ProgressRing progress={progressPercent} />
                  </div>
                  <Link
                    href={`/dashboard/syllabus/${slug}`}
                    className="block w-full text-center py-3 bg-[#2D6A4F] text-white rounded-xl font-medium hover:bg-[#245a42] transition group-hover:shadow-sm"
                  >
                    Open syllabus
                  </Link>
                </div>
              )
            })}
          </div>
        </section>

        <Heatmap items={heatmapItems} subjects={subjects} />
      </div>
    </DashboardLayout>
  )
}
