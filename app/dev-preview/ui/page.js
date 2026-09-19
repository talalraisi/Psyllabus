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

      <Calculator open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  )
}
