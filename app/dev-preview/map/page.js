'use client'

/**
 * The subject map without signing in. Development only: a real syllabus,
 * with made-up progress so every colour shows. ?subject= picks the subject.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import SubjectMap from '@/components/map/SubjectMap'
import { createClient } from '@/lib/supabase'
import { buildGraph } from '@/lib/subject-graph'

const ENABLED = process.env.NODE_ENV !== 'production'
const STATUSES = ['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started', 'not_started', 'not_started']

function Preview() {
  const subject = useSearchParams().get('subject') || 'Biology HL'
  const [rows, setRows] = useState([])
  const supabase = createClient()
  useEffect(() => {
    supabase.from('syllabus_content').select('subject, topic, unit, code, subtopic, position, hl_only, hl_extension').eq('subject', subject).then(({ data }) => setRows(data || []))
  }, [supabase, subject])

  const graph = useMemo(() => {
    if (!rows.length) return null
    const effective = {}
    const details = {}
    rows.forEach((r, i) => {
      const k = `${subject}::${r.subtopic}`
      effective[k] = STATUSES[(i * 7) % STATUSES.length]
      details[k] = { points: (i * 37) % 100 }
    })
    return buildGraph({ subject, rows, details, effective, key: (s, t) => `${s}::${t}` })
  }, [rows, subject])

  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: [subject] }
  return (
    <DashboardLayout profile={profile}>
      <div className="h-[calc(100dvh-56px)] md:h-dvh">{graph && <SubjectMap key={subject} graph={graph} subjects={[subject]} onSubject={() => {}} />}</div>
    </DashboardLayout>
  )
}

export default function MapPreview() {
  if (!ENABLED) notFound()
  return (
    <Suspense>
      <Preview />
    </Suspense>
  )
}
