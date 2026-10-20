'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import MapCanvas from '@/components/map/MapCanvas'
import { buildGraph } from '@/lib/subject-graph'
import { radialLayout, fitView } from '@/lib/map-layout'
import { progressKey } from '@/lib/progress'

/**
 * A subject's overview from the map, for the dashboard: the same drawing,
 * framed and still. Selecting a topic, or its arrow, opens the full map at
 * that topic.
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

  const [view, setView] = useState({ x: 0, y: 0, k: 0.5 })
  const onSize = useCallback((s) => setView(fitView(radialLayout(graph, graph.rootId).bounds, s.w, s.h, { pad: 24, max: 0.9 })), [graph])
  const open = (id) => router.push(`/dashboard/map?subject=${encodeURIComponent(subject)}${id && id !== graph.rootId ? `&at=${encodeURIComponent(id)}` : ''}`)

  return (
    <div className="overflow-hidden rounded-[18px] border" style={{ height, borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <MapCanvas
        graph={graph}
        focusId={graph.rootId}
        view={view}
        onView={() => {}}
        onSize={onSize}
        onSelect={open}
        onEnter={open}
        onExpand={open}
        minimap={false}
        interactive={false}
      />
    </div>
  )
}
