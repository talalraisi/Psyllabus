'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import ResourceHubDrawer from '@/components/ResourceHubDrawer'
import { resolveOnboardingNameFromSlug } from '@/lib/subject-map'
import {
  STATUS_PILL_ACTIVE,
  STATUS_LABELS,
  STATUS_VALUES,
  buildProgressMap,
  computeCompletionPercent,
  progressKey,
  groupByTopic,
  sortTopics,
} from '@/lib/progress'
import { buildProgressDetailMap, effectiveStatus, isDecayed, daysSince, DECAY_DAYS } from '@/lib/decay'

export default function SyllabusPage() {
  const { slug } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [subjectName, setSubjectName] = useState('')
  const [syllabusData, setSyllabusData] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedTopics, setExpandedTopics] = useState({})
  const [saving, setSaving] = useState(null)
  const [progressDetail, setProgressDetail] = useState({})
  const [hasQuestions, setHasQuestions] = useState(false)
  const [drawerItem, setDrawerItem] = useState(null)

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

      const resolved =
        resolveOnboardingNameFromSlug(slug) || decodeURIComponent(slug)

      if (!profileData.subjects?.includes(resolved)) {
        router.push('/dashboard')
        return
      }

      setSubjectName(resolved)

      const [{ data: syllabus }, { data: userProgress }, { count: questionCount }] =
        await Promise.all([
          supabase.from('syllabus_content').select('*').eq('subject', resolved),
          supabase
            .from('progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('subject', resolved),
          supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('subject', resolved)
            .eq('verified', true),
        ])

      const progressMap = buildProgressMap(userProgress)
      setSyllabusData(syllabus || [])
      setProgress(progressMap)
      setProgressDetail(buildProgressDetailMap(userProgress))
      setHasQuestions((questionCount || 0) > 0)

      const topics = [...new Set((syllabus || []).map((item) => item.topic))]
      setExpandedTopics(topics.reduce((acc, topic) => ({ ...acc, [topic]: true }), {}))
      setLoading(false)
    }
    loadData()
  }, [slug, router, supabase])

  const toggleTopic = (topic) => {
    setExpandedTopics((prev) => ({ ...prev, [topic]: !prev[topic] }))
  }

  const updateStatus = async (topic, subtopic, newStatus) => {
    const key = progressKey(subjectName, subtopic)
    setSaving(key)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('progress').upsert(
      {
        user_id: user.id,
        subject: subjectName,
        topic,
        subtopic,
        status: newStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,subject,subtopic' }
    )

    if (!error) {
      setProgress((prev) => ({ ...prev, [key]: newStatus }))
      setProgressDetail((prev) => ({
        ...prev,
        [key]: { status: newStatus, updatedAt: new Date().toISOString() },
      }))
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading syllabus…</p>
      </div>
    )
  }

  const groupedByTopic = groupByTopic(syllabusData)
  const effectiveMap = Object.fromEntries(
    Object.entries(progressDetail).map(([key, d]) => [
      key,
      effectiveStatus(d.status, d.updatedAt),
    ])
  )
  const completion = computeCompletionPercent(syllabusData, effectiveMap, subjectName)
  const slugPath = `/dashboard/syllabus/${slug}`

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm font-medium text-[#2D6A4F] mb-4 hover:underline"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[28px] font-bold text-[#1a2e1e]">{subjectName}</h1>
            <span className="shrink-0 rounded-full bg-[#f0fdf4] text-[#2D6A4F] text-sm font-semibold px-3 py-1">
              {completion}% mastered
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-[#6b7280]">
              {syllabusData.length} subtopic{syllabusData.length !== 1 ? 's' : ''}
            </p>
            {hasQuestions && (
              <Link
                href={`/dashboard/quiz?subject=${encodeURIComponent(subjectName)}&mode=mock&back=${encodeURIComponent(slugPath)}`}
                className="text-sm font-medium px-4 py-1.5 rounded-lg border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#f0fdf4] transition-colors"
              >
                Timed mock exam
              </Link>
            )}
          </div>

          <div className="mt-5 h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2D6A4F] rounded-full transition-all duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>
        </header>

        {syllabusData.length === 0 ? (
          <div className="bg-white rounded-xl p-10 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-center">
            <h2 className="text-base font-semibold text-[#1a2e1e]">Syllabus coming soon</h2>
            <p className="text-sm text-[#6b7280] mt-2">
              We are still preparing the content for this subject. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortTopics(Object.entries(groupedByTopic)).map(([topic, subtopics]) => {
              const topicMastered = subtopics.filter(
                (s) => progress[progressKey(subjectName, s.subtopic)] === 'mastered'
              ).length
              const expanded = !!expandedTopics[topic]

              return (
                <div
                  key={topic}
                  className="bg-white rounded-xl border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  <button
                    onClick={() => toggleTopic(topic)}
                    className="w-full bg-[#f9fafb] px-5 py-3.5 flex items-center justify-between hover:bg-[#f3f4f6] transition-colors"
                    aria-expanded={expanded}
                  >
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-[#1a2e1e]">{topic}</h3>
                      <p className="text-xs text-[#6b7280] mt-0.5">
                        {subtopics.length} subtopic{subtopics.length !== 1 ? 's' : ''} · {topicMastered} mastered
                      </p>
                    </div>
                    <span
                      className={`text-[#9ca3af] text-xs transition-transform duration-150 ${
                        expanded ? 'rotate-90' : ''
                      }`}
                      aria-hidden="true"
                    >
                      ▶
                    </span>
                  </button>

                  {expanded && (
                    <div className="divide-y divide-[#f3f4f6]">
                      {subtopics.map((item) => {
                        const key = progressKey(subjectName, item.subtopic)
                        const currentStatus = progress[key] || 'not_started'
                        const isSaving = saving === key

                        return (
                          <div
                            key={item.id}
                            className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5"
                          >
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="text-left text-sm text-[#374151] hover:text-[#2D6A4F] hover:underline underline-offset-2 transition-colors"
                                title="Open resources and practice quiz"
                              >
                                {item.subtopic}
                              </button>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {item.hl_only && (
                                  <span className="rounded-full bg-[#E8D5B0] px-2 py-0.5 text-[11px] font-medium text-[#1a2e1e]">
                                    HL only
                                  </span>
                                )}
                                {isDecayed(
                                  progressDetail[key]?.status,
                                  progressDetail[key]?.updatedAt
                                ) && (
                                  <span
                                    className="rounded-full bg-[#f59e0b] px-2 py-0.5 text-[11px] font-medium text-white"
                                    title={`Mastered ${daysSince(progressDetail[key]?.updatedAt)} days ago — retest within ${DECAY_DAYS}-day window to keep it green`}
                                  >
                                    Decaying
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 shrink-0">
                              {STATUS_VALUES.map((status) => (
                                <button
                                  key={status}
                                  disabled={isSaving}
                                  onClick={() => updateStatus(item.topic, item.subtopic, status)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150 ${
                                    currentStatus === status
                                      ? STATUS_PILL_ACTIVE[status]
                                      : 'bg-white text-[#9ca3af] border border-[#e5e7eb] hover:border-[#d1d5db]'
                                  } ${isSaving ? 'opacity-50' : ''}`}
                                >
                                  {STATUS_LABELS[status]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ResourceHubDrawer
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        subject={subjectName}
        topic={drawerItem?.topic}
        subtopic={drawerItem?.subtopic}
        hlOnly={drawerItem?.hl_only}
        quizHref={
          drawerItem
            ? `/dashboard/quiz?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(drawerItem.topic)}&subtopic=${encodeURIComponent(drawerItem.subtopic)}&back=${encodeURIComponent(slugPath)}`
            : null
        }
      />
    </DashboardLayout>
  )
}
