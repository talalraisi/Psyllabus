'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { CONFIDENCE_LEVELS, dotColor } from '@/lib/confidence'

export default function SyllabusViewer({ subjectName, syllabusYear = '26/27' }) {
  const [topics, setTopics] = useState([])
  const [progress, setProgress] = useState({})
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function loadSyllabus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

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
          .select('topic_id, confidence')
          .eq('user_id', user.id)
          .in('topic_id', topicIds)

        const progressMap = {}
        ;(userProgress || []).forEach((p) => {
          progressMap[p.topic_id] = p.confidence
        })
        setProgress(progressMap)
      }

      setLoading(false)
    }

    loadSyllabus()
  }, [subjectName])

  const setConfidence = async (topicId, confidence) => {
    if (!userId) return
    setSaving(topicId)

    const { error } = await supabase.from('user_topic_progress').upsert({
      user_id: userId,
      topic_id: topicId,
      confidence,
      updated_at: new Date().toISOString(),
    })

    if (!error) {
      setProgress((prev) => ({ ...prev, [topicId]: confidence }))
    }

    setSaving(null)
  }

  const parentTopics = topics.filter((t) => t.topic_type === 'topic')
  const getSubtopics = (parentId) => topics.filter((t) => t.parent_id === parentId)
  const rated = Object.keys(progress).length
  const total = topics.filter((t) => t.topic_type === 'subtopic').length

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
          {rated}/{total} subtopics rated
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 justify-center">
        {CONFIDENCE_LEVELS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
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
                const current = progress[sub.id]
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-[var(--radius-sm)] border border-border bg-bg-subtle"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 min-w-[12px] min-h-[12px]"
                        style={{ background: dotColor(current) }}
                      />
                      <span className="text-sm text-text truncate">{sub.title}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {CONFIDENCE_LEVELS.map((btn) => (
                        <button
                          key={btn.level}
                          onClick={() => setConfidence(sub.id, btn.level)}
                          disabled={saving === sub.id}
                          title={btn.title}
                          className="w-7 h-7 rounded-full border-2 transition-all disabled:opacity-50"
                          style={{
                            backgroundColor: current === btn.level ? btn.color : 'transparent',
                            borderColor: btn.color,
                            opacity: current === btn.level ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </div>
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
