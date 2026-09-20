'use client'

/**
 * The new pieces, on a page that needs no account.
 *
 * Signing in to look at a menu is a slow way to check a menu, and the pieces
 * here are the ones whose behaviour is easy to get subtly wrong: a popover
 * that will not close, a graph that draws a vertical line through tan(x).
 *
 * Not reachable in production.
 */

import { useState } from 'react'
import { notFound } from 'next/navigation'
import Calculator from '@/components/Calculator'
import QuestionMenu from '@/components/QuestionMenu'
import TodoList from '@/components/TodoList'
import SubjectWeb from '@/components/SubjectWeb'

const ENABLED = process.env.NODE_ENV !== 'production'

const QUESTION = {
  id: '00000000-0000-4000-8000-000000000001',
  stem: 'A ball is thrown vertically upwards at 12 m s⁻¹. What is its maximum height?',
  options: [
    { id: 'a', text: '3.7 m' },
    { id: 'b', text: '7.3 m' },
    { id: 'c', text: '12 m' },
    { id: 'd', text: '14.7 m' },
  ],
}

/** A course-shaped sample: three themes, a few units each, leaves with status. */
const STATUSES = ['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started']
const WEB_ROWS = [
  ['A. Space, time and motion', ['A.1 Kinematics', 7], ['A.2 Forces and momentum', 8], ['A.3 Work and energy', 5]],
  ['B. Particulate nature of matter', ['B.1 Thermal transfers', 5], ['B.3 Gas laws', 4], ['B.5 Current and circuits', 6]],
  ['C. Wave behaviour', ['C.1 Simple harmonic motion', 4], ['C.2 Wave model', 4], ['C.3 Wave phenomena', 9]],
].flatMap(([topic, ...units], t) =>
  units.flatMap(([unit, n], u) =>
    Array.from({ length: n }, (_, i) => ({
      subject: 'Physics SL',
      topic,
      unit,
      code: unit.split(' ')[0],
      subtopic: `${unit.replace(/^[A-Z]\.\d+ /, '')} point ${i + 1}`,
      status: STATUSES[(t + u + i) % STATUSES.length],
    }))
  )
)

export default function UiPreview() {
  const [calcOpen, setCalcOpen] = useState(true)

  if (!ENABLED) notFound()

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <h1 className="text-[22px] font-semibold">Question menu</h1>
      <div className="mt-4 flex items-start justify-between gap-4 rounded-[12px] border p-4" style={{ borderColor: 'var(--border-strong)' }}>
        <p className="text-[17px] font-medium leading-relaxed">{QUESTION.stem}</p>
        <QuestionMenu question={QUESTION} />
      </div>

      <h1 className="mt-10 text-[22px] font-semibold">Calculator</h1>
      <button onClick={() => setCalcOpen((v) => !v)} className="btn btn-outline control-md mt-3">
        {calcOpen ? 'Hide' : 'Show'} calculator
      </button>

      <h1 className="mt-10 text-[22px] font-semibold">Subject web</h1>
      {/* Wider than the rest of the page, because the map is the one thing
          here that is about being able to read something small. */}
      <div className="mt-4" style={{ width: 'min(96vw, 900px)' }}>
        <SubjectWeb subject="Physics SL" rows={WEB_ROWS} onPickSubtopic={() => {}} />
      </div>

      <h1 className="mt-10 text-[22px] font-semibold">To-do list</h1>
      <TodoList className="mt-4" subjects={['Physics SL', 'Economics HL']} />

      <Calculator open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  )
}
