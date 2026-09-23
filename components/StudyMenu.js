'use client'

import { useEffect, useRef, useState } from 'react'
import { IconArrowRight } from '@/components/Icons'

/**
 * One button that opens the ways to study.
 *
 * Four buttons in a row asks a student to choose before they know what the
 * choices mean, and spends the width of the header on a decision most people
 * make once. One button starts the obvious thing; the arrow beside it opens
 * the rest, each with a line saying what it will actually do to you.
 */
const MODES = [
  { key: 'flip', label: 'Flip through', hint: 'Read, turn it over, mark yourself. Best for cards you have just met.' },
  { key: 'write', label: 'Write it', hint: 'Type the answer. The app marks it, so you cannot round yourself up.' },
  { key: 'blank', label: 'Fill the blank', hint: 'One word missing from the answer. Gentler than writing the lot.' },
  { key: 'test', label: 'Test me', hint: 'A mixed paper, marked at the end. Nothing revealed until it is over.', min: 4 },
]

export default function StudyMenu({ count, primary = 'flip', label, onStart }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const available = MODES.filter((m) => !m.min || count >= m.min)

  return (
    <div ref={ref} className="relative flex items-center">
      <button onClick={() => onStart(primary)} className="btn btn-solid control-md rounded-r-none">
        {label}
        <IconArrowRight width={16} height={16} />
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Other ways to study"
        className="btn btn-solid control-md rounded-l-none border-l border-[color-mix(in_oklab,var(--bg)_30%,transparent)] px-2.5"
      >
        ▾
      </button>

      {open && (
        <div
          role="menu"
          className="elev-lg pop-enter absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-[12px] border"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          {available.map((m) => (
            <button
              key={m.key}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onStart(m.key)
              }}
              className="block w-full px-4 py-3 text-left hover:bg-[var(--surface-sunken)]"
            >
              <span className="block text-[13.5px] font-medium">{m.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                {m.hint}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
