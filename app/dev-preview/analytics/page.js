'use client'

/**
 * The analytics page with made-up study, without signing in. Development
 * only. The numbers are generated here and are nobody's.
 */

import { useState } from 'react'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import AnalyticsView from '@/components/analytics/AnalyticsView'

const ENABLED = process.env.NODE_ENV !== 'production'
const SUBJECTS = {
  'Biology HL': ['Enzymes', 'Cell membranes', 'Photosynthesis', 'Gene expression'],
  'Economics HL': ['Price elasticity of demand', 'Market failure: externalities', 'Fiscal policy'],
  'Physics SL': ['Simple harmonic motion', 'Thermal energy transfers', 'Circular motion'],
  'Math Analysis & Approaches HL': ['Chain rule', 'Integration by parts', 'Binomial distribution'],
}

/** Six months of plausible study, the same every load. */
function sample(now) {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const names = Object.keys(SUBJECTS)
  const attempts = []
  const sessions = []
  const today = new Date(now)
  for (let back = 180; back >= 0; back--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back)
    if (rnd() < (day.getDay() === 5 ? 0.75 : 0.25) && back > 2) continue
    const runs = 1 + Math.floor(rnd() * 3)
    for (let k = 0; k < runs; k++) {
      const subject = names[Math.floor(rnd() * names.length)]
      const subtopic = SUBJECTS[subject][Math.floor(rnd() * SUBJECTS[subject].length)]
      const hour = rnd() < 0.7 ? 16 + Math.floor(rnd() * 5) : 7 + Math.floor(rnd() * 3)
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, Math.floor(rnd() * 50)).getTime()
      if (start > now) continue
      const minutes = 10 + Math.floor(rnd() * 55)
      sessions.push({ started_at: new Date(start).toISOString(), ended_at: new Date(start + minutes * 60000).toISOString(), subject: rnd() < 0.85 ? subject : null, subtopic: rnd() < 0.85 ? subtopic : null })
      if (rnd() < 0.6) {
        const total = 5 + Math.floor(rnd() * 6)
        const skill = 0.45 + (180 - back) / 400
        attempts.push({ completed_at: new Date(start + (minutes - 2) * 60000).toISOString(), elapsed_seconds: (6 + Math.floor(rnd() * 10)) * 60, subject, subtopic, total_questions: total, score: Math.min(total, Math.round(total * (skill + (rnd() - 0.5) * 0.3))) })
      }
    }
  }
  const progress = Object.entries(SUBJECTS).flatMap(([subject, list]) => list.map((subtopic, i) => ({ subject, subtopic, status: ['mastered', 'proficient', 'confident', 'in_progress', 'decaying'][i % 5] })))
  return { attempts, sessions, progress, now }
}

export default function AnalyticsPreview() {
  const [data] = useState(() => sample(Date.now()))
  if (!ENABLED) notFound()
  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', grad_year: '2028', subjects: Object.keys(SUBJECTS) }
  return (
    <DashboardLayout profile={profile}>
      <p className="mx-auto mt-4 w-fit rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: 'var(--flame-tint)', color: 'var(--flame)' }}>
        Sample study · preview only
      </p>
      <AnalyticsView {...data} profile={profile} />
    </DashboardLayout>
  )
}
