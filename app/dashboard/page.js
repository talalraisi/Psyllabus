'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import ProgressRing from '@/components/ProgressRing'
import { getSlugForSubject } from '@/lib/subject-map'
import { computeCompletionPercent, progressKey } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [subjectStats, setSubjectStats] = useState({})
  const [overall, setOverall] = useState(0)
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

      const progressMap = buildEffectiveProgressMap(progressRows)
      const stats = {}
      for (const subject of subjects) {
        const subtopics = (syllabusRows || []).filter((r) => r.subject === subject)
        stats[subject] = computeCompletionPercent(subtopics, progressMap, subject)
      }

      const total = (syllabusRows || []).length
      const mastered = (syllabusRows || []).filter(
        (r) => progressMap[progressKey(r.subject, r.subtopic)] === 'mastered'
      ).length

      setSubjectStats(stats)
      setOverall(total ? Math.round((mastered / total) * 100) : 0)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading your dashboard…</p>
      </div>
    )
  }

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const subjects = profile.subjects || []

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold text-[#1a2e1e] mb-1">
            {greeting()}, {firstName}
          </h1>
          <p className="text-sm text-[#6b7280]">
            {profile.curriculum} · Class of {profile.grad_year} · {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
          </p>
        </header>

        <div className="mb-10 flex items-center gap-4">
          <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2D6A4F] rounded-full transition-all duration-500"
              style={{ width: `${overall}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-[#2D6A4F] shrink-0">
            {overall}% mastered
          </span>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">
              Your Subjects
            </h2>
            <Link
              href="/dashboard/subjects"
              className="text-sm font-medium text-[#2D6A4F] hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.map((subject) => {
              const progressPercent = subjectStats[subject] ?? 0
              const targetGrade = profile.target_grades?.[subject] || '—'
              const slug = getSlugForSubject(subject)

              return (
                <div
                  key={subject}
                  className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#e0e0e0] transition-all flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-[#1a2e1e] leading-snug">
                        {subject}
                      </h3>
                      <span className="inline-block mt-2 rounded-full bg-[#E8D5B0] px-2.5 py-0.5 text-xs font-medium text-[#1a2e1e]">
                        Target grade {targetGrade}
                      </span>
                    </div>
                    <ProgressRing progress={progressPercent} size={60} />
                  </div>
                  <Link
                    href={`/dashboard/syllabus/${slug}`}
                    className="mt-auto block w-full text-center py-2.5 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors"
                  >
                    Open syllabus
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
