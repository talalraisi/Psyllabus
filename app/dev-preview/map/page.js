'use client'

/**
 * The subject map without signing in. Development only: a made-up syllabus
 * and progress, so every colour shows. Opens on you; ?subject= opens one.
 */

import { Suspense, useMemo } from 'react'
import { notFound, useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import SubjectMap from '@/components/map/SubjectMap'
import YouMap from '@/components/map/YouMap'
import { buildGraph } from '@/lib/subject-graph'

const ENABLED = process.env.NODE_ENV !== 'production'
const STATUSES = ['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started', 'not_started', 'not_started']

const SAMPLE = (subject) => {
  const topics = ['Unity and diversity', 'Form and function', 'Interaction and interdependence', 'Continuity and change']
  const out = []
  topics.forEach((topic, t) =>
    [1, 2, 3].forEach((u) =>
      [1, 2, 3, 4].forEach((k) => {
        const code = `${'ABCD'[t]}${u}.${k}`
        out.push({ subject, topic: `${'ABCD'[t]}. ${topic}`, unit: `${'ABCD'[t]}${u} Unit ${u} of ${topic.toLowerCase()}`, code, subtopic: `${code} Subtopic ${k} of unit ${u}`, position: out.length })
      })
    )
  )
  return out
}

const SUBJECTS = ['Biology HL', 'Economics HL', 'Math Analysis & Approaches HL', 'English A: Literature HL', 'History SL', 'Spanish B SL']

/** A subject as a graph, from the sample syllabus, with made-up progress (each subject a little different). */
const sampleGraph = (subject, n) => {
  const rows = SAMPLE(subject).slice(0, 24 + n * 8)
  const effective = {}
  const details = {}
  rows.forEach((r, i) => {
    const k = `${subject}::${r.subtopic}`
    effective[k] = STATUSES[(i * 7 + n * 3) % STATUSES.length]
    details[k] = { points: (i * 37) % 100 }
  })
  return { graph: buildGraph({ subject, rows, details, effective, key: (s, t) => `${s}::${t}` }), items: rows.map((r) => ({ ...r, status: effective[`${subject}::${r.subtopic}`] })) }
}

function Preview() {
  const params = useSearchParams()
  const router = useRouter()
  const subject = params.get('subject')
  const samples = useMemo(() => SUBJECTS.map((s, i) => ({ subject: s, ...sampleGraph(s, i) })), [])
  const graphs = samples.map(({ subject: s, graph: g }) => ({ subject: s, graph: g }))
  const graph = subject && graphs.find((g) => g.subject === subject)?.graph
  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: SUBJECTS }
  return (
    <DashboardLayout profile={profile}>
      {graph ? (
        <div className="h-[calc(100dvh-56px)] md:h-dvh">
          <SubjectMap key={subject} graph={graph} subjects={SUBJECTS} initialAt={params.get('at')} onSubject={(s) => router.replace(`/dev-preview/map?subject=${encodeURIComponent(s)}`)} onOverview={() => router.push('/dev-preview/map')} />
        </div>
      ) : (
        <YouMap graphs={graphs} items={samples.flatMap((x) => x.items)} name={profile.full_name} onOpen={(s, at) => router.push(`/dev-preview/map?subject=${encodeURIComponent(s)}${at ? `&at=${encodeURIComponent(at)}` : ''}`)} />
      )}
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
