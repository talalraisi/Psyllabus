'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import OrbitCanvas from '@/components/map/OrbitCanvas'
import { buildGraph } from '@/lib/subject-graph'
import { progressKey } from '@/lib/progress'

/**
 * A subject's constellation, for the dashboard: the same drawing as the
 * subject map, framed. Clicking a topic opens the full map at it; the centre
 * opens the map itself.
 *
 * `rows` are syllabus rows already carrying the student's status, as the
 * dashboard has them.
 */
export default function MapPreview({ subject, rows, height = 420 }) {
  const router = useRouter()
  const graph = useMemo(() => {
    const effective = {}
    for (const r of rows) if (r.status && r.status !== 'not_started') effective[progressKey(subject, r.subtopic)] = r.status
    return buildGraph({ subject, rows, effective, key: progressKey })
  }, [subject, rows])

  const open = (id) => router.push(`/dashboard/map?subject=${encodeURIComponent(subject)}${id && id !== graph.rootId ? `&at=${encodeURIComponent(id)}` : ''}`)

  return (
    <div className="overflow-hidden rounded-[18px] border" style={{ height, borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <OrbitCanvas graph={graph} focusId={graph.rootId} selectedId={null} onSelect={open} onEnter={open} legend={false} />
    </div>
  )
}
