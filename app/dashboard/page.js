'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { getSlugForSubject } from '@/lib/subject-map'
import {
  computeCompletionPercent,
  progressKey,
  topicSortKey,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

const FOCUS_PRIORITY = { decaying: 0, in_progress: 1, confident: 2, not_started: 3 }

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
  const [counts, setCounts] = useState({ mastered: 0, weak: 0, decaying: 0, due: 0 })
  const [focus, setFocus] = useState([])
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

      const [{ data: syllabusRows }, { data: progressRows }, { count: dueCount }] =
        await Promise.all([
          subjects.length
            ? supabase.from('syllabus_content').select('*').in('subject', subjects)
            : { data: [] },
          supabase.from('progress').select('*').eq('user_id', user.id),
          supabase
            .from('mistakes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .lte('next_review_at', new Date().toISOString()),
        ])

      const progressMap = buildEffectiveProgressMap(progressRows)
      const merged = (syllabusRows || []).map((row) => ({
        ...row,
        status: progressMap[progressKey(row.subject, row.subtopic)] || 'not_started',
      }))

      const stats = {}
      for (const subject of subjects) {
        stats[subject] = computeCompletionPercent(
          merged.filter((r) => r.subject === subject),
          progressMap,
          subject
        )
      }

      const mastered = merged.filter((r) => r.status === 'mastered').length
      setCounts({
        mastered,
        weak: merged.filter((r) => r.status === 'in_progress').length,
        decaying: merged.filter((r) => r.status === 'decaying').length,
        due: dueCount || 0,
      })
      setOverall(merged.length ? Math.round((mastered / merged.length) * 100) : 0)

      const focusItems = merged
        .filter((r) => r.status in FOCUS_PRIORITY)
        .sort((a, b) => {
          const pi = FOCUS_PRIORITY[a.status] - FOCUS_PRIORITY[b.status]
          if (pi !== 0) return pi
          const si = subjects.indexOf(a.subject) - subjects.indexOf(b.subject)
          if (si !== 0) return si
          return topicSortKey(a.topic) - topicSortKey(b.topic)
        })
        .slice(0, 5)
      setFocus(focusItems)

      setSubjectStats(stats)
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

  const statCards = [
    { label: 'Mastered', value: counts.mastered, color: 'text-[#2D6A4F]' },
    { label: 'Decaying', value: counts.decaying, color: 'text-[#f59e0b]' },
    { label: 'Weak', value: counts.weak, color: 'text-[#dc2626]' },
    { label: 'Reviews due', value: counts.due, color: 'text-[#d97706]', href: '/dashboard/mistakes' },
  ]

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

        <div className="mb-8 flex items-center gap-4">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {statCards.map((stat) => {
            const card = (
              <div className="bg-white rounded-xl p-4 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] h-full">
                <p className={`text-[28px] font-bold leading-tight ${stat.color}`}>{stat.value}</p>
                <p className="text-sm text-[#6b7280] mt-0.5">{stat.label}</p>
              </div>
            )
            return stat.href ? (
              <Link key={stat.label} href={stat.href} className="block hover:opacity-80 transition-opacity">
                {card}
              </Link>
            ) : (
              <div key={stat.label}>{card}</div>
            )
          })}
        </div>

        <section className="mb-10">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-3">
            Today&apos;s Focus
          </h2>
          {focus.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-center">
              <p className="text-sm text-[#6b7280]">
                Nothing queued yet. Open a syllabus and take your first quiz.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-[#f3f4f6]">
              {focus.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[item.status]}`}
                    title={STATUS_LABELS[item.status]}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#9ca3af] truncate">
                      {item.subject} · {item.topic}
                    </p>
                    <p className="text-sm text-[#374151] truncate">{item.subtopic}</p>
                  </div>
                  <span className={`hidden sm:block text-xs font-medium shrink-0 ${STATUS_TEXT_COLORS[item.status]}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                  <Link
                    href={`/dashboard/quiz?subject=${encodeURIComponent(item.subject)}&topic=${encodeURIComponent(item.topic)}&subtopic=${encodeURIComponent(item.subtopic)}&back=/dashboard`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#f0fdf4] transition-colors shrink-0"
                  >
                    Quiz
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

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
          <div className="bg-white rounded-xl border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-[#f3f4f6]">
            {subjects.map((subject) => {
              const pct = subjectStats[subject] ?? 0
              return (
                <Link
                  key={subject}
                  href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-[#f9fafb] transition-colors"
                >
                  <span className="w-52 shrink-0 text-sm text-[#1a2e1e] font-medium truncate">
                    {subject}
                  </span>
                  <div className="flex-1 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2D6A4F] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold text-[#2D6A4F]">
                    {pct}%
                  </span>
                  <span className="text-[#9ca3af] text-xs shrink-0" aria-hidden="true">
                    ▶
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
