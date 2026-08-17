'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import ProgressRing from '@/components/ProgressRing'
import { getSlugForSubject } from '@/lib/subject-map'
import { computeCompletionPercent } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

export default function SubjectsPage() {
  const [profile, setProfile] = useState(null)
  const [subjectStats, setSubjectStats] = useState({})
  const [subtopicCounts, setSubtopicCounts] = useState({})
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

      const stats = {}
      const counts = {}
      for (const subject of subjects) {
        const subtopics = (syllabusRows || []).filter((r) => r.subject === subject)
        counts[subject] = subtopics.length
        const progressMap = buildEffectiveProgressMap(
          (progressRows || []).filter((p) => p.subject === subject)
        )
        stats[subject] = computeCompletionPercent(subtopics, progressMap, subject)
      }

      setSubjectStats(stats)
      setSubtopicCounts(counts)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-[#1a2e1e]">Loading subjects…</p>
      </div>
    )
  }

  const subjects = profile.subjects || []

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold text-[#1a2e1e] mb-1">My Subjects</h1>
          <p className="text-sm text-[#6b7280]">
            Track every topic and subtopic across your {profile.curriculum} programme
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {subjects.map((subject) => {
            const slug = getSlugForSubject(subject)
            const progressPercent = subjectStats[subject] ?? 0
            const count = subtopicCounts[subject] ?? 0
            const targetGrade = profile.target_grades?.[subject] || '—'

            return (
              <div
                key={subject}
                className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#e0e0e0] transition-all flex gap-5"
              >
                <ProgressRing progress={progressPercent} size={72} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-[#1a2e1e]">{subject}</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    {count} subtopic{count !== 1 ? 's' : ''} · Target grade {targetGrade}
                  </p>
                  <Link
                    href={`/dashboard/syllabus/${slug}`}
                    className="inline-block mt-4 px-5 py-2 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors"
                  >
                    Open syllabus
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
