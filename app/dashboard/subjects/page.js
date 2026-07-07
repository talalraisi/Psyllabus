'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import ProgressRing from '@/components/ProgressRing'
import { getSlugForSubject } from '@/lib/subject-map'
import { buildProgressMap, computeCompletionPercent } from '@/lib/progress'

export default function SubjectsPage() {
  const [profile, setProfile] = useState(null)
  const [subjectStats, setSubjectStats] = useState({})
  const [subtopicCounts, setSubtopicCounts] = useState({})
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

      const stats = {}
      const counts = {}
      for (const subject of subjects) {
        const subtopics = (syllabusRows || []).filter((r) => r.subject === subject)
        counts[subject] = subtopics.length
        const progressMap = buildProgressMap(
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
      <div className="p-8 max-w-6xl mx-auto">
        <header className="mb-10">
          <p className="text-sm font-medium text-[#2D6A4F] uppercase tracking-wide mb-1">
            My Subjects
          </p>
          <h1 className="text-3xl font-bold text-[#1a2e1e]">Your syllabus library</h1>
          <p className="text-[#6b7280] mt-2">
            Track every topic and subtopic across your {profile.curriculum} programme
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {subjects.map((subject) => {
            const slug = getSlugForSubject(subject)
            const progressPercent = subjectStats[subject] ?? 0
            const count = subtopicCounts[subject] ?? 0
            const targetGrade = profile.target_grades?.[subject] || '—'

            return (
              <div
                key={subject}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex gap-5"
              >
                <ProgressRing progress={progressPercent} size={72} />
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-[#1a2e1e] text-lg">{subject}</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    {count} subtopics · Target {targetGrade}
                  </p>
                  <Link
                    href={`/dashboard/syllabus/${slug}`}
                    className="inline-block mt-4 px-5 py-2.5 bg-[#2D6A4F] text-white rounded-xl text-sm font-medium hover:bg-[#245a42] transition"
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
