'use client'

import { useState } from 'react'
import { IconArrowRight } from '@/components/Icons'

/**
 * How to study a set of cards, and the button to start.
 *
 * The four ways sit in a row you can see and tap, with one line under them
 * saying what the chosen one does, and one plain button to begin. They used
 * to hide behind a little ▾ on a split button that also carried a count,
 * which was the least obvious way to offer a choice that changes how the
 * whole session works. The last way picked is remembered on this device.
 */
const MODES = [
  { key: 'flip', label: 'Flip', hint: 'Read it, turn it over, mark yourself. Best for cards you have just met.' },
  { key: 'write', label: 'Write', hint: 'Type the answer and the app marks it, so you cannot round yourself up.' },
  { key: 'blank', label: 'Blank', hint: 'One word missing from the answer. Gentler than writing the lot.' },
  { key: 'test', label: 'Test', hint: 'A mixed paper, marked at the end. Nothing shown until it is over.', min: 4 },
]

const KEY = 'psyllabus:study-mode'

function Icon({ k }) {
  const p = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (k === 'flip') return <svg {...p}><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M9 12h6M13 10l2 2-2 2" /></svg>
  if (k === 'write') return <svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
  if (k === 'blank') return <svg {...p}><path d="M4 12h3M17 12h3" /><rect x="9" y="9" width="6" height="6" rx="1.5" strokeDasharray="2 2" /></svg>
  return <svg {...p}><path d="M9 4h6M10 4v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V4" /></svg>
}

export default function StudyMenu({ count, primary = 'flip', verb = 'Review', onStart, compact = false }) {
  const available = MODES.filter((m) => !m.min || count >= m.min)
  const [mode, setMode] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && localStorage.getItem(KEY)
      if (saved && available.some((m) => m.key === saved)) return saved
    } catch {
      // Not remembered; the default stands.
    }
    return primary
  })
  const current = available.find((m) => m.key === mode) || available[0]

  const pick = (k) => {
    setMode(k)
    try {
      localStorage.setItem(KEY, k)
    } catch {
      // As above.
    }
  }

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-2.5'}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full p-0.5" style={{ background: 'var(--surface-sunken)' }} role="radiogroup" aria-label="How to study">
          {available.map((m) => {
            const on = current.key === m.key
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={on}
                title={m.hint}
                onClick={() => pick(m.key)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
                style={on ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.25)' } : { color: 'var(--text-muted)' }}
              >
                <Icon k={m.key} />
                {m.label}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => onStart(current.key)} className="btn btn-solid control-md">
          {verb}
          <IconArrowRight width={15} height={15} />
        </button>
      </div>
      {!compact && (
        <p className="text-[12px] leading-snug" style={{ color: 'var(--text-faint)' }}>
          {current.hint}
        </p>
      )}
    </div>
  )
}
