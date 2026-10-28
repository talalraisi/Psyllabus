'use client'

/**
 * The study plan's Today view with sample data, without signing in.
 *
 * Not reachable in production — same gate as the parent harness.
 *
 * Nothing here writes anywhere: skip, move and done change local state only,
 * and the settings panel's save is not wired. (Do not press Start on the
 * session timer while signed in: the timer is the real one and records the
 * run to the signed-in account.) ?style=focus|questions|reading|50|long
 * switches the student's style.
 */

import { Suspense, useMemo, useState } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import TodayPlan from '@/components/plan/TodayPlan'
import { resolveSettings, buildCandidates, buildPlan, nextDeadline, dateKey } from '@/lib/study-plan'

const ENABLED = process.env.NODE_ENV !== 'production'
const SUBJECTS = ['Physics HL', 'Economics SL', 'History SL']

function sample(now) {
  const items = []
  let position = 0
  const statuses = ['in_progress', 'confident', 'not_started', 'decaying', 'proficient', 'mastered']
  for (const subject of SUBJECTS) {
    for (let t = 1; t <= 5; t++) {
      for (let s = 1; s <= 4; s++) {
        items.push({ subject, topic: `Topic ${t}`, subtopic: `${t}.${s} ${subject.split(' ')[0]} subtopic ${t}.${s}`, position: position++, status: statuses[(t * 4 + s + subject.length) % statuses.length] })
      }
    }
  }
  const covered = new Set(items.filter((_, i) => i % 3 !== 0).map((i) => `${i.subject}::${i.subtopic}`))
  const details = Object.fromEntries(items.filter((i) => i.status === 'decaying').map((i, n) => [`${i.subject}::${i.subtopic}`, { updatedAt: new Date(now.getTime() - (16 + n * 5) * 86400000).toISOString() }]))
  const events = [{ subject: 'Economics SL', title: 'Econ unit test', due_at: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3).toISOString() }]
  const mistakes = [
    { subject: 'Physics HL', next_review_at: new Date(now.getTime() - 86400000).toISOString() },
    { subject: 'Physics HL', next_review_at: now.toISOString() },
  ]
  return { items, covered, details, events, mistakes }
}

function Inner() {
  const variant = useSearchParams().get('style') || ''
  // Mid-afternoon today, so the painted free time is still ahead of it.
  const [now] = useState(() => { const d = new Date(); d.setHours(15, 0, 0, 0); return d })
  const [adjustments, setAdjustments] = useState([])
  const [done, setDone] = useState(() => new Set())

  const profile = useMemo(() => {
    const style = {}
    if (variant === 'focus') style.mix = 'focus'
    if (variant === 'questions' || variant === 'reading') style.order = variant
    if (variant === '50' || variant === 'long') style.rhythm = variant
    return {
      curriculum: 'IB',
      grad_year: 2027,
      plan: 'premium',
      subjects: SUBJECTS,
      target_grades: { 'Physics HL': '7', 'Economics SL': '5', 'History SL': '6' },
      plan_settings: {
        slots: { 0: [[960, 1080], [1140, 1230]], 1: [[960, 1080], [1140, 1230]], 2: [[960, 1080], [1140, 1230]], 3: [[960, 1080], [1140, 1230]], 4: [[960, 1080], [1140, 1230]], 5: [], 6: [[600, 780]] },
        style,
      },
    }
  }, [variant])
  const data = useMemo(() => sample(now), [now])
  const settings = useMemo(() => resolveSettings(profile), [profile])
  const plan = useMemo(() => {
    const candidates = buildCandidates({ ...data, profile, settings, predicted: { 'Physics HL': '5', 'Economics SL': '5', 'History SL': '5' }, subjectSizes: { 'Physics HL': 20, 'Economics SL': 20, 'History SL': 20 }, now })
    return buildPlan({ candidates, settings, mistakes: data.mistakes, adjustments, now })
  }, [data, profile, settings, adjustments, now])
  const deadline = nextDeadline({ events: data.events, profile, settings, subjects: SUBJECTS, now })

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Study Plan</h1>
        <p className="mb-8 mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
          {deadline ? `${deadline.title} in ${deadline.days} days` : ''}
        </p>
        <TodayPlan
          day={plan.days[0]}
          tomorrowKey={plan.days[1]?.date}
          style={settings.style}
          isDone={(t) => done.has(t.id)}
          hrefFor={(t) => (t.quizzable ? '#' : null)}
          onNotes={() => {}}
          onAdjust={(task, kind, to) => {
            if (kind === 'done') setDone((d) => new Set([...d, task.id]))
            else if (kind === 'undone') setDone((d) => new Set([...d].filter((x) => x !== task.id)))
            else setAdjustments((a) => [...a, { task_id: task.id, kind, on_date: dateKey(now), to_date: to || null }])
          }}
        />
      </div>
    </main>
  )
}

export default function PlanPreview() {
  if (!ENABLED) notFound()
  return (
    <Suspense>
      <Inner />
    </Suspense>
  )
}
