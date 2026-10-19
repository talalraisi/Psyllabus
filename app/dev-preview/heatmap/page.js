'use client'

/**
 * The dashboard's "Time studied" heatmap, without needing to sign in.
 *
 * Not reachable in production — same gate as the parent harness.
 *
 * The data is shaped like the real thing rather than like the component's
 * own demo: quiz-sized sessions of a few minutes to half an hour, clustered
 * in term time, with gaps, and a short streak ending today. ?empty shows a
 * year with nothing in it, which the dashboard never renders but the
 * component should still survive.
 */

import { Suspense, useMemo } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import { ActivityHeatmap, toKey } from '@/components/ui/activity-heatmap'

const ENABLED = process.env.NODE_ENV !== 'production'

function formatStudyTime(minutes) {
  if (minutes <= 0) return '0 min'
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  return `${h}h ${String(Math.round(minutes - h * 60)).padStart(2, '0')}m`
}

function sample() {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const out = []
  const today = new Date()
  for (let i = 0; i < 182; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const weekend = d.getDay() === 5 || d.getDay() === 6
    const streak = i < 4
    if (streak || rand() < (weekend ? 0.18 : 0.42)) {
      out.push({ date: toKey(d), value: 2 + rand() * (rand() < 0.15 ? 70 : 28) })
    }
  }
  return out
}

function Inner() {
  const empty = useSearchParams().has('empty')
  const data = useMemo(() => (empty ? [] : sample()), [empty])
  return (
    <main className="min-h-screen px-5 py-12" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-5 border-b pb-3 text-[15px] font-semibold tracking-[-0.012em]" style={{ borderColor: 'var(--border)' }}>
          Time studied
        </h2>
        <div className="rounded-[16px] border p-5 sm:p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <ActivityHeatmap data={data} days={182} cellSize={13} color="var(--brand)" formatValue={formatStudyTime} />
        </div>
      </div>
    </main>
  )
}

export default function HeatmapPreview() {
  if (!ENABLED) notFound()
  return (
    <Suspense>
      <Inner />
    </Suspense>
  )
}
