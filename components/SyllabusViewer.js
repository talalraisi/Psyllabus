'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { STATUS_LEVELS, dotColorForStatus, statusFromAccuracy } from '@/lib/quiz-status'

export default function SyllabusViewer({ subjectName, subjectSlug, syllabusYear = '26/27' }) {
  const [topics, setTopics] = useState([])
  const [progress, setProgress] = useState({})
  const [questionCounts, setQuestionCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function loadSyllabus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: subject } = await supabase
        .from('subjects')
        .select('id, name, syllabus_year')
        .eq('name', subjectName)
        .single()

      if (!subject) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const { data: allTopics } = await supabase
        .from('topics')
        .select('*')
        .eq('subject_id', subject.id)
        .order('sort_order')

      setTopics(allTopics || [])

      const topicIds = (allTopics || []).map((t) => t.id)
      if (topicIds.length > 0) {
        const { data: userProgress } = await supabase
          .from('user_topic_progress')
          .select('topic_id, accuracy, attempt_count, status')
          .eq('user_id', user.id)
          .in('topic_id', topicIds)

        const progressMap = {}
        ;(userProgress || []).forEach((p) => {
          progressMap[p.topic_id] = {
            accuracy: p.accuracy,
            attemptCount: p.attempt_count,
            status: p.status || statusFromAccuracy(p.accuracy, p.attempt_count),
          }
        })
        setProgress(progressMap)

        const subtopicIds = (allTopics || [])
          .filter((t) => t.topic_type === 'subtopic')
          .map((t) => t.id)

        if (subtopicIds.length > 0) {
          const { data: questions } = await supabase
            .from('questions')
            .select('topic_id')
            .in('topic_id', subtopicIds)
            .eq('verified', true)

          const counts = {}
          ;(questions || []).forEach((q) => {
            counts[q.topic_id] = (counts[q.topic_id] || 0) + 1
          })
          setQuestionCounts(counts)
        }
      }

      setLoading(false)
    }

    loadSyllabus()
  }, [subjectName, supabase])

  const parentTopics = topics.filter((t) => t.topic_type === 'topic')
  const getSubtopics = (parentId) => topics.filter((t) => t.parent_id === parentId)
  const subtopics = topics.filter((t) => t.topic_type === 'subtopic')
  const tested = subtopics.filter((s) => progress[s.id]?.attemptCount > 0).length
  const total = subtopics.length

  const backHref = subjectSlug
    ? `/dashboard/syllabus/${subjectSlug}`
    : '/dashboard'

  if (loading) {
    return <p className="text-text-muted text-sm py-12 text-center">Loading syllabus…</p>
  }

  if (notFound) {
    return (
      <div className="card card-pad text-center">
        <p className="text-text-muted text-sm">
          Syllabus data for this subject is not imported yet. Check back soon.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="card card-pad mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">{subjectName}</h1>
        <p className="text-text-muted text-sm mb-3">IB · Syllabus {syllabusYear}</p>
        <p className="text-sm font-semibold text-accent">
          {tested}/{total} subtopics tested
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 justify-center">
        {STATUS_LEVELS.map((item) => (
          <div key={item.status} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: item.color }}
            />
            <span className="text-text-muted text-xs">{item.label}</span>
          </div>
        ))}
      </div>

      {parentTopics.length === 0 ? (
        <p className="text-text-faint text-center text-sm">No topics found.</p>
      ) : (
        parentTopics.map((parent) => (
          <div key={parent.id} className="card card-pad mb-4">
            <h2 className="font-bold text-base text-text mb-4">{parent.title}</h2>
            <div className="space-y-2">
              {getSubtopics(parent.id).map((sub) => {
                const prog = progress[sub.id]
                const status = prog?.status || 'untested'
                const hasQuestions = (questionCounts[sub.id] || 0) > 0
                const quizHref = `/dashboard/quiz/${sub.id}?type=subtopic&back=${encodeURIComponent(backHref)}`

                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-[var(--radius-sm)] border border-border bg-bg-subtle"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 min-w-[12px] min-h-[12px]"
                        style={{ background: dotColorForStatus(status) }}
                      />
                      <div className="min-w-0">
                        <span className="text-sm text-text truncate block">{sub.title}</span>
                        {prog?.attemptCount > 0 && (
                          <span className="text-xs text-text-faint">
                            {Math.round((prog.accuracy || 0) * 100)}% · {prog.attemptCount} attempt{prog.attemptCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {hasQuestions ? (
                      <Link
                        href={quizHref}
                        className="btn-primary text-xs px-3 py-1.5 flex-shrink-0"
                      >
                        Take quiz
                      </Link>
                    ) : (
                      <span className="text-xs text-text-faint flex-shrink-0">Soon</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </>
  )
}
