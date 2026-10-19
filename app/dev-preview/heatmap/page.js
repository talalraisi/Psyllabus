'use client'

/**
 * The dashboard's "Time studied" heatmap, without needing to sign in.
 *
 * Not reachable in production — same gate as the parent harness.
 *
 * Data shaped like the real thing: quiz-sized sessions of a few minutes to
 * half an hour, thicker in term time and thinning out the further back it
 * goes, so every frame from 1M to 5Y has something to show. ?empty shows the
 * no-data case, which the dashboard never renders but the component should
 * still survive.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import StudyHeatmap, { dayKey } from '@/components/StudyHeatmap'

const ENABLED = process.env.NODE_ENV !== 'production'

function sample() {
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const out = []
  const today = new Date()
  for (let i = 0; i < 900; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const holiday = d.getMonth() === 6 || d.getMonth() === 7
    const weekend = d.getDay() === 5 || d.getDay() === 6
    const fade = i < 200 ? 1 : i < 500 ? 0.55 : 0.25
    const chance = (weekend ? 0.18 : 0.45) * (holiday ? 0.4 : 1) * fade
    if (i < 4 || rand() < chance) out.push({ date: dayKey(d), value: 2 + rand() * (rand() < 0.15 ? 70 : 28) })
  }
  return out
}

function Inner() {
  const empty = useSearchParams().has('empty')
  const data = useMemo(() => (empty ? [] : sample()), [empty])
  // Client only, like the dashboard, which only draws the heatmap once its
  // data has arrived in the browser. The heatmap reads the clock and the
  // remembered frame in its first render, which a server render cannot do.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const show = () => setMounted(true)
    show()
  }, [])
  return (
    <main className="min-h-screen px-5 py-12" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-5 border-b pb-3 text-[15px] font-semibold tracking-[-0.012em]" style={{ borderColor: 'var(--border)' }}>
          Time studied
        </h2>
        <div className="rounded-[16px] border p-5 sm:p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          {mounted && <StudyHeatmap data={data} />}
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
