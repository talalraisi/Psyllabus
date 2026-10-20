'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * "For students of" and the three curricula, all on screen at once.
 *
 * It was one big grey line with a word rolling in and out of it, which hid
 * two of the three answers at any moment and was the loudest thing in the
 * hero after the headline. Now all three sit in one small pill and a green
 * highlight glides between them, so a reader finds theirs at a glance and
 * the movement is one soft slide rather than text jumping. It pauses while
 * pointed at, and a tap picks one. With reduced motion it simply sits still.
 */
export default function CurriculumSwitch({ items = ['IB Diploma', 'A-Levels', 'AP'], ms = 2600 }) {
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  const pill = useRef(null)
  const labels = useRef([])

  // The highlight is placed straight onto the element, measured from the
  // label it sits behind, so it fits each word exactly.
  useEffect(() => {
    const place = () => {
      const el = labels.current[at]
      const hi = pill.current
      if (!el || !hi) return
      hi.style.width = `${el.offsetWidth}px`
      hi.style.transform = `translateX(${el.offsetLeft}px)`
      hi.style.opacity = '1'
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [at])

  useEffect(() => {
    if (paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setTimeout(() => setAt((i) => (i + 1) % items.length), ms)
    return () => clearTimeout(t)
  }, [at, paused, ms, items.length])

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[15px] font-medium" style={{ color: 'var(--text-muted)' }}>
        For students of
      </span>
      <span
        className="relative inline-flex rounded-full border p-1"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span
          ref={pill}
          aria-hidden="true"
          className="absolute left-0 top-1 bottom-1 rounded-full"
          style={{
            background: 'var(--brand)',
            opacity: 0,
            boxShadow: '0 6px 16px -8px var(--brand)',
            transition: 'transform 520ms cubic-bezier(0.34, 1.3, 0.64, 1), width 520ms cubic-bezier(0.34, 1.3, 0.64, 1), opacity 200ms',
          }}
        />
        {items.map((item, i) => (
          <button
            key={item}
            ref={(el) => {
              labels.current[i] = el
            }}
            type="button"
            onClick={() => setAt(i)}
            aria-pressed={i === at}
            className="relative z-10 rounded-full px-3.5 py-1.5 text-[14px] font-semibold tracking-[-0.01em] transition-colors duration-300"
            style={{ color: i === at ? '#fff' : 'var(--text-muted)' }}
          >
            {item}
          </button>
        ))}
      </span>
    </span>
  )
}
