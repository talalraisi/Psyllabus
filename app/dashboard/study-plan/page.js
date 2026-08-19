'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { getSlugForSubject } from '@/lib/subject-map'
import { progressKey, topicSortKey, STATUS_LABELS } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

const QUEUE_PRIORITY = { decaying: 0, in_progress: 1, not_started: 2 }

export default function StudyPlanPage() {
  const [profile, setProfile] = useState(null)
  const [groups, setGroups] = useState([])
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

      const progressMap = buildEffectiveProgressMap(progressRows)

      const todo = (syllabusRows || [])
        .map((row) => ({
          ...row,
          status: progressMap[progressKey(row.subject, row.subtopic)] || 'not_started',
        }))
        .filter((row) => row.status in QUEUE_PRIORITY)

      const grouped = subjects
        .map((subject) => ({
          subject,
          items: todo
            .filter((row) => row.subject === subject)
            .sort((a, b) => {
              const pi = QUEUE_PRIORITY[a.status] - QUEUE_PRIORITY[b.status]
              if (pi !== 0) return pi
              const ti = topicSortKey(a.topic) - topicSortKey(b.topic)
              if (ti !== 0) return ti
              return a.subtopic.localeCompare(b.subtopic)
            }),
        }))
        .filter((g) => g.items.length > 0)

      setGroups(grouped)
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Building your study plan…</p>
      </div>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="t-page-title mb-1">Study Plan</h1>
          <p className="text-sm text-[#6b7280]">
            Decaying skills first, then weak, then untested
          </p>
        </header>

        {groups.length === 0 ? (
          <div className="surface p-10 text-center">
            <h2 className="text-base font-semibold text-[#1a2e1e]">All caught up</h2>
            <p className="text-sm text-[#6b7280] mt-2">
              Nothing left to start. Keep reviewing to stay sharp.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ subject, items }) => (
              <section key={subject}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="t-overline">
                    {subject}
                  </h2>
                  <Link
                    href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
                    className="text-sm font-medium text-[#2D6A4F] hover:underline"
                  >
                    Open syllabus →
                  </Link>
                </div>
                <div className="surface divide-y divide-[#f3f4f6]">
                  {items.map((item) => (
                    <div key={item.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#9ca3af]">{item.topic}</p>
                        <p className="text-sm text-[#374151] truncate">{item.subtopic}</p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full ${
                          item.status === 'decaying'
                            ? 'bg-[#f59e0b] text-white'
                            : item.status === 'in_progress'
                              ? 'bg-[#fef2f2] text-[#dc2626]'
                              : 'bg-[#f3f4f6] text-[#6b7280]'
                        }`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
