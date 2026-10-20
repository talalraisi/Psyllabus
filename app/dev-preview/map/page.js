'use client'

/**
 * The subject map without signing in, on a real syllabus. Development only.
 *
 * The progress here is SAMPLE progress, made up for the preview so the
 * mastery colours have something to show. It is labelled on the page and is
 * nobody's results.
 *
 *   /dev-preview/map?subject=Economics HL
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import SubjectMap from '@/components/map/SubjectMap'
import { buildGraph } from '@/lib/subject-graph'
import { progressKey } from '@/lib/progress'

const ENABLED = process.env.NODE_ENV !== 'production'
const CYCLE = ['mastered', 'proficient', 'mastered', 'confident', 'proficient', 'in_progress', 'not_started', 'decaying', 'not_started', 'mastered', 'not_started', 'confident']

function Preview() {
  const params = useSearchParams()
  const [subject, setSubject] = useState(params.get('subject') || 'Economics HL')
  const [data, setData] = useState(null)

  useEffect(() => {
    let off = false
    fetch(`/dev-preview/map/data?subject=${encodeURIComponent(subject)}`)
      .then((r) => r.json())
      .then((d) => !off && setData(d))
    return () => {
      off = true
    }
  }, [subject])

  const graph = useMemo(() => {
    if (!data) return null
    const details = {}
    const effective = {}
    data.rows.forEach((r, i) => {
      const status = CYCLE[(i * 5 + r.topic.length) % CYCLE.length]
      if (status === 'not_started') return
      const k = progressKey(subject, r.subtopic)
      effective[k] = status
      details[k] = { status, points: { mastered: 11, proficient: 8, confident: 5, in_progress: 2.5, decaying: 7 }[status], updatedAt: new Date(Date.UTC(2026, 9, 20) - i * 86400000).toISOString() }
    })
    return buildGraph({ subject, rows: data.rows, details, effective, key: progressKey })
  }, [data, subject])

  if (!ENABLED) notFound()
  return (
    <DashboardLayout profile={{ is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', grad_year: '2028', subjects: [subject] }}>
      <div className="relative h-[calc(100dvh-56px)] md:h-dvh">
        {graph && (
          <SubjectMap
            key={subject}
            graph={graph}
            subjects={['Economics HL', 'Biology HL', 'Physics SL', 'History HL', 'Math Analysis & Approaches HL']}
            onSubject={setSubject}
            syllabi
            initialAt={params.get('at')}
          />
        )}
        <p className="pointer-events-none absolute right-4 top-16 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'var(--flame-tint)', color: 'var(--flame)' }}>
          Sample progress · preview only
        </p>
      </div>
    </DashboardLayout>
  )
}

export default function MapPreview() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
