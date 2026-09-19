'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getSyllabus, getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import ResourceHubDrawer from '@/components/ResourceHubDrawer'
import PaperPicker from '@/components/PaperPicker'
import { Page, PageHeader, EmptyState } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconArrowLeft, IconChevronRight } from '@/components/Icons'
import { resolveSubjectFromSlug } from '@/lib/subject-map'
import { isSubjectLocked, isPremium } from '@/lib/access'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  displaySubtopic,
  STATUS_TEXT_COLORS,
  buildProgressMap,
  computeCompletionPercent,
  progressKey,
  groupByTopic,
  groupByUnit,
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

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight. A page that has arrived but has no data yet is the
  // part that feels broken.
  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])
  const [expandedTopics, setExpandedTopics] = useState({})
  const [progressDetail, setProgressDetail] = useState({})
  const [hasQuestions, setHasQuestions] = useState(false)
  const [drawerItem, setDrawerItem] = useState(null)
  const [papersOpen, setPapersOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }

      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })

      if (!profileData) {
        router.push('/onboarding')
        return
      }

      setProfile(profileData)

      // Resolved against this student's own subjects, so it works for every
      // curriculum rather than only the ones in the IB map.
      const resolved = resolveSubjectFromSlug(slug, profileData.subjects || [])

      if (!resolved) {
        router.push('/dashboard')
        return
      }

      // Free accounts may open one subject; the DP core is always available.
      if (isSubjectLocked(resolved, profileData)) {
        router.push('/dashboard/profile#unlock')
        return
      }

      setSubjectName(resolved)

      const [syllabus, { data: userProgress }, { count: questionCount }] =
        await Promise.all([
          getSyllabus(supabase, [resolved]),
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

      // Everything starts closed. A syllabus is 40 to 300 subtopics, and
      // dropping all of them on the page at once means scrolling past nine
      // topics to reach the one you actually came for.
      setExpandedTopics({})
      setLoading(false)
    }
    loadData()
  }, [slug, router, supabase])

  const toggleTopic = (topic) => {
    setExpandedTopics((prev) => ({ ...prev, [topic]: !prev[topic] }))
  }

  const setAllTopics = (open) => {
    const topics = [...new Set(syllabusData.map((item) => item.topic))]
    setExpandedTopics(open ? Object.fromEntries(topics.map((t) => [t, true])) : {})
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">Loading syllabus…</p>
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
  const topicCount = new Set(syllabusData.map((i) => i.topic)).size
  const unitCount = new Set(syllabusData.map((i) => i.unit).filter(Boolean)).size
  const anyOpen = Object.values(expandedTopics).some(Boolean)
  const slugPath = `/dashboard/syllabus/${slug}`

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <button
          onClick={() => router.push('/dashboard/subjects')}
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-150 hover:text-[var(--text)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <IconArrowLeft width={13} height={13} />
          My Subjects
        </button>

        <PageHeader
          eyebrow="Syllabus"
          title={subjectName}
          subtitle={
            unitCount
              ? `${topicCount} topic${topicCount !== 1 ? 's' : ''} · ${unitCount} unit${unitCount !== 1 ? 's' : ''} · ${syllabusData.length} subtopic${syllabusData.length !== 1 ? 's' : ''}`
              : `${topicCount} topic${topicCount !== 1 ? 's' : ''} · ${syllabusData.length} subtopic${syllabusData.length !== 1 ? 's' : ''}`
          }
          action={
            <div className="flex items-center gap-2">
              {syllabusData.length > 0 && (
                <button onClick={() => setAllTopics(!anyOpen)} className="btn btn-quiet control-sm">
                  {anyOpen ? 'Collapse all' : 'Expand all'}
                </button>
              )}
              {hasQuestions && (
                <button onClick={() => setPapersOpen(true)} className="btn btn-outline control-sm">
                  Test
                </button>
              )}
            </div>
          }
        />

        {/* Mastery, stated once and large, rather than as a pill beside the
            title where it competed with the subject name. */}
        <div className="mb-12 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-baseline justify-between gap-4">
            <span
              className="text-[30px] font-semibold leading-none tracking-[-0.028em] tabular-nums"
              style={{ color: 'var(--brand)' }}
            >
              {completion}%
            </span>
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              mastered
            </span>
          </div>
          <div
            className="mt-4 h-1 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--border-strong)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${completion}%`, background: 'var(--brand)' }}
            />
          </div>
        </div>

        {syllabusData.length === 0 ? (
          <EmptyState
            title="Syllabus coming soon"
            description="We are still preparing the content for this subject. Check back soon."
          />
        ) : (
          <div className="flex flex-col">
            {sortTopics(Object.entries(groupedByTopic)).map(([topic, subtopics]) => {
              const topicMastered = subtopics.filter(
                (s) => progress[progressKey(subjectName, s.subtopic)] === 'mastered'
              ).length
              const expanded = !!expandedTopics[topic]
              const topicUnits = new Set(subtopics.map((s) => s.unit).filter(Boolean)).size

              return (
                <section
                  key={topic}
                  className="border-t last:border-b"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-4 py-4">
                    <button
                      onClick={() => toggleTopic(topic)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <IconChevronRight
                        width={13}
                        height={13}
                        className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--text-faint)' }}
                      />
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-medium">{topic}</span>
                        <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--text-faint)' }}>
                          {topicUnits ? `${topicUnits} unit${topicUnits !== 1 ? 's' : ''} · ` : ''}
                          {subtopics.length} subtopic{subtopics.length !== 1 ? 's' : ''} ·{' '}
                          {topicMastered} mastered
                        </span>
                      </span>
                    </button>
                    {hasQuestions && (
                      <Link
                        href={`/dashboard/quiz?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topic)}&mode=topic&back=${encodeURIComponent(slugPath)}`}
                        className="btn btn-quiet control-sm shrink-0"
                      >
                        Topic test
                      </Link>
                    )}
                  </div>

                  {expanded && (
                    <div className="mb-3 flex flex-col pl-6">
                      {/* The middle level. A theme with twenty-two subtopics
                          under it is a wall; the guide's own units are how a
                          teacher refers to them, so they are the heading. */}
                      {groupByUnit(subtopics).map(({ unit, code, items }) => (
                        <div key={unit || 'ungrouped'}>
                          {unit && (
                            <div className="flex items-baseline gap-2 pt-4 pb-1">
                              {code && (
                                <span
                                  className="text-[11.5px] font-semibold tabular-nums"
                                  style={{ color: 'var(--text-faint)' }}
                                >
                                  {code}
                                </span>
                              )}
                              <span className="text-[13px] font-medium">{unit}</span>
                            </div>
                          )}
                          <ul className="flex flex-col">
                      {items.map((item) => {
                        const key = progressKey(subjectName, item.subtopic)
                        const currentStatus = isDecayed(
                          progressDetail[key]?.status,
                          progressDetail[key]?.updatedAt
                        )
                          ? 'decaying'
                          : progress[key] || 'not_started'

                        return (
                          <li
                            key={item.id}
                            className="group flex flex-col gap-2 border-t py-3 sm:flex-row sm:items-center sm:gap-4"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <span
                              className={`hidden h-2 w-2 shrink-0 rounded-full sm:block ${STATUS_COLORS[currentStatus]}`}
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="text-left text-[14px] underline-offset-2 transition-colors hover:text-[var(--brand)] hover:underline"
                                style={{ color: 'var(--text-body)' }}
                                title="Open resources and practice quiz"
                              >
                                {displaySubtopic(item.subtopic)}
                              </button>
                              {item.hl_only && (
                                <span
                                  title="Higher level only"
                                  className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-[0.1em]"
                                  style={{ color: 'var(--text-faint)' }}
                                >
                                  HL
                                </span>
                              )}
                              {/* Shared with SL, taken further at HL: not the
                                  same thing as HL-only, and a student planning
                                  revision needs to see the difference. */}
                              {item.hl_extension && (
                                <span
                                  title="Studied at both levels, in more depth at HL"
                                  className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-[0.1em]"
                                  style={{ color: 'var(--text-faint)' }}
                                >
                                  HL depth
                                </span>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-4">
                              <span
                                className={`text-[12.5px] font-medium ${STATUS_TEXT_COLORS[currentStatus]}`}
                                title={
                                  currentStatus === 'decaying'
                                    ? `Mastered ${daysSince(progressDetail[key]?.updatedAt)} days ago. Retest within the ${DECAY_DAYS}-day window to keep it green.`
                                    : 'Status is set by quiz results only'
                                }
                              >
                                {STATUS_LABELS[currentStatus]}
                              </span>
                              <button
                                onClick={() => setDrawerItem(item)}
                                className="text-[12.5px] font-medium underline-offset-2 hover:underline"
                                style={{ color: 'var(--text-muted)' }}
                                title="Lessons, videos and notes for this subtopic"
                              >
                                Resources
                              </button>
                              {/* Five questions, marked as you go. The long
                                  version is a click further on, in the test
                                  builder; this is the one that gets done. */}
                              <Link
                                href={`/dashboard/quiz?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(item.topic)}&subtopic=${encodeURIComponent(item.subtopic)}&count=5&review=practice&back=${encodeURIComponent(slugPath)}`}
                                className="btn btn-outline control-sm"
                              >
                                Quick 5
                              </Link>
                            </div>
                          </li>
                        )
                      })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </Page>

      <PaperPicker
        open={papersOpen}
        onClose={() => setPapersOpen(false)}
        subject={subjectName}
        curriculum={profile?.curriculum}
        backHref={slugPath}
      />

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
