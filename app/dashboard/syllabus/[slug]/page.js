'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import { resolveOnboardingNameFromSlug } from '@/lib/subject-map'
import {
  STATUS_BUTTON_COLORS,
  STATUS_LABELS,
  STATUS_VALUES,
  buildProgressMap,
  computeCompletionPercent,
  progressKey,
  groupByTopic,
  sortTopics,
} from '@/lib/progress'

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

      const [{ data: syllabus }, { data: userProgress }] = await Promise.all([
        supabase
          .from('syllabus_content')
          .select('*')
          .eq('subject', resolved),
        supabase
          .from('progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('subject', resolved),
      ])

      const progressMap = buildProgressMap(userProgress)
      setSyllabusData(syllabus || [])
      setProgress(progressMap)

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
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-[#1a2e1e]">Loading syllabus…</p>
      </div>
    )
  }

  const groupedByTopic = groupByTopic(syllabusData)
  const completion = computeCompletionPercent(syllabusData, progress, subjectName)

  return (
    <DashboardLayout profile={profile}>
      <div className="p-8 max-w-4xl mx-auto">
        <header className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#2D6A4F] font-medium mb-4 hover:underline text-sm"
          >
            ← Back to Dashboard
          </button>
          <p className="text-sm font-medium text-[#2D6A4F] uppercase tracking-wide mb-1">
            Syllabus
          </p>
          <h1 className="text-3xl font-bold text-[#1a2e1e]">{subjectName}</h1>
          <p className="text-[#6b7280] mt-1">{syllabusData.length} subtopics</p>

          <div className="mt-6 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[#1a2e1e]">Overall completion</span>
              <span className="font-bold text-[#2D6A4F]">{completion}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="bg-[#2D6A4F] h-3 rounded-full transition-all duration-300"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
        </header>

        {syllabusData.length === 0 ? (
          <div className="bg-white rounded-xl p-10 shadow-sm border border-gray-100 text-center">
            <p className="text-[#6b7280]">
              Syllabus content for this subject is not available yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortTopics(Object.entries(groupedByTopic)).map(([topic, subtopics]) => {
              const topicMastered = subtopics.filter(
                (s) => progress[progressKey(subjectName, s.subtopic)] === 'mastered'
              ).length

              return (
                <div
                  key={topic}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <button
                    onClick={() => toggleTopic(topic)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#f8f6f1]/80 transition"
                  >
                    <div className="text-left">
                      <h3 className="font-semibold text-[#1a2e1e]">{topic}</h3>
                      <p className="text-xs text-[#6b7280] mt-0.5">
                        {topicMastered}/{subtopics.length} mastered
                      </p>
                    </div>
                    <span className="text-[#6b7280] text-sm">
                      {expandedTopics[topic] ? '▼' : '▶'}
                    </span>
                  </button>

                  {expandedTopics[topic] && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {subtopics.map((item) => {
                        const key = progressKey(subjectName, item.subtopic)
                        const currentStatus =
                          progress[key] || 'not_started'
                        const isSaving = saving === key

                        return (
                          <div
                            key={item.id}
                            className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[#1a2e1e] font-medium">{item.subtopic}</p>
                              {item.hl_only && (
                                <span className="inline-block mt-1 text-xs font-medium text-[#2D6A4F] bg-[#E8D5B0]/50 px-2 py-0.5 rounded">
                                  HL only
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 shrink-0">
                              {STATUS_VALUES.map((status) => (
                                <button
                                  key={status}
                                  disabled={isSaving}
                                  onClick={() => updateStatus(item.topic, item.subtopic, status)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                                    currentStatus === status
                                      ? STATUS_BUTTON_COLORS[status]
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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
    </DashboardLayout>
  )
}
