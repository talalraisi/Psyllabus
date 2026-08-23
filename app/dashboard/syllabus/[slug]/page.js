'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import DashboardLayout from '@/components/DashboardLayout'
import ResourceHubDrawer from '@/components/ResourceHubDrawer'
import { resolveOnboardingNameFromSlug } from '@/lib/subject-map'
import { isSubjectLocked, isPremium } from '@/lib/access'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_TEXT_COLORS,
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
  const [progressDetail, setProgressDetail] = useState({})
  const [hasQuestions, setHasQuestions] = useState(false)
  const [drawerItem, setDrawerItem] = useState(null)

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

      const resolved =
        resolveOnboardingNameFromSlug(slug) || decodeURIComponent(slug)

      if (!profileData.subjects?.includes(resolved)) {
        router.push('/dashboard')
        return
      }

      // Free accounts may open one subject; the DP core is always available.
      if (isSubjectLocked(resolved, profileData)) {
        router.push('/dashboard/profile#unlock')
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
            <h1 className="t-page-title">{subjectName}</h1>
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
                className="btn btn-outline control-sm"
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
          <div className="surface p-10 text-center">
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
                  className="surface overflow-hidden"
                >
                  <button
                    onClick={() => toggleTopic(topic)}
                    className="w-full bg-[#f9fafb] px-5 py-4 flex items-center justify-between hover:bg-[#f3f4f6] transition-colors"
                    aria-expanded={expanded}
                  >
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-[#1a2e1e]">{topic}</h3>
                      <p className="text-xs text-[#6b7280] mt-1">
                        {subtopics.length} subtopic{subtopics.length !== 1 ? 's' : ''} · {topicMastered} mastered
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {hasQuestions && (
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(
                              `/dashboard/quiz?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topic)}&mode=topic&back=${encodeURIComponent(slugPath)}`
                            )
                          }}
                          className="btn btn-outline control-sm text-xs cursor-pointer"
                        >
                          Topic test
                        </span>
                      )}
                      <span
                        className={`text-[#9ca3af] text-xs transition-transform duration-150 ${
                          expanded ? 'rotate-90' : ''
                        }`}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="divide-y divide-[#f3f4f6]">
                      {subtopics.map((item) => {
                        const key = progressKey(subjectName, item.subtopic)
                        const currentStatus = isDecayed(
                          progressDetail[key]?.status,
                          progressDetail[key]?.updatedAt
                        )
                          ? 'decaying'
                          : progress[key] || 'not_started'

                        return (
                          <div
                            key={item.id}
                            className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="text-left text-sm text-[#374151] hover:text-[#2D6A4F] hover:underline underline-offset-2 transition-colors"
                                title="Open resources and practice quiz"
                              >
                                {item.subtopic}
                              </button>
                              {item.hl_only && (
                                <span className="inline-block mt-1 rounded-full bg-[#E8D5B0] px-2 py-1 text-[11px] font-medium text-[#1a2e1e]">
                                  HL only
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="btn btn-quiet control-sm text-xs"
                                title="Lessons, videos and notes for this subtopic"
                              >
                                Resources
                              </button>
                              <span
                                className={`flex items-center gap-2 text-xs font-medium ${STATUS_TEXT_COLORS[currentStatus]}`}
                                title={
                                  currentStatus === 'decaying'
                                    ? `Mastered ${daysSince(progressDetail[key]?.updatedAt)} days ago. Retest within the ${DECAY_DAYS}-day window to keep it green.`
                                    : 'Status is set by quiz results only'
                                }
                              >
                                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[currentStatus]}`} />
                                {STATUS_LABELS[currentStatus]}
                              </span>
                              <Link
                                href={`/dashboard/quiz?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(item.topic)}&subtopic=${encodeURIComponent(item.subtopic)}&back=${encodeURIComponent(slugPath)}`}
                                className="btn btn-outline control-sm text-xs"
                              >
                                Practice quiz
                              </Link>
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
