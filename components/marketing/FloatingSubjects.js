'use client'

import { useEffect, useRef } from 'react'
import { SubjectTile } from '@/components/marketing/SubjectIcons'

/**
 * Subjects drifting around the hero, stepping out of the pointer's way.
 *
 * Each tile floats on its own slow loop (CSS, on the inner element) and is
 * pushed away from the pointer when it comes close (a transform on the outer
 * one, eased by a transition with a little overshoot, which is the spring).
 * Placed in the space the headline leaves, so nothing ever sits on the text.
 * Nothing moves for anyone who has asked their system for less motion.
 */

// Around the right of the hero and in the strips above and below the
// headline, never on it. Two depths only, so the sizes read as distance
// rather than as a jumble: near tiles are full size, far ones smaller and
// fainter. [subject, top %, left %, far]
const DESKTOP = [
  ['physics', 14, 62, false],
  ['maths', 25, 86, false],
  ['biology', 41, 72, false],
  ['english', 58, 88, false],
  ['economics', 67, 63, false],
  ['history', 84, 78, false],
  ['chemistry', 6, 78, true],
  ['geography', 40, 93, true],
  ['computing', 8, 46, true],
  ['arts', 89, 58, true],
  ['languages', 91, 92, true],
  ['psychology', 90, 30, true],
  ['tok', 5, 22, true],
]

const REACH = 170 // px within which a tile moves away
const PUSH = 46 // px at the closest

export default function FloatingSubjects() {
  const tiles = useRef([])

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let px = -9999
    let py = -9999
    const apply = () => {
      frame = 0
      for (const el of tiles.current) {
        if (!el) continue
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const d = Math.hypot(px - cx, py - cy)
        if (d < REACH) {
          const a = Math.atan2(py - cy, px - cx)
          const f = (1 - d / REACH) * PUSH
          el.style.transform = `translate(${-Math.cos(a) * f}px, ${-Math.sin(a) * f}px)`
        } else if (el.style.transform) {
          el.style.transform = ''
        }
      }
    }
    const onMove = (e) => {
      px = e.clientX
      py = e.clientY
      if (!frame) frame = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
      {DESKTOP.map(([name, top, left, far], i) => (
        <div
          key={name}
          ref={(el) => {
            tiles.current[i] = el
          }}
          className="absolute"
          style={{
            top: `${top}%`,
            left: `${left}%`,
            transition: 'transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div className="float-in" style={{ animationDelay: `${300 + i * 70}ms` }}>
            <div
              className="float-drift"
              style={{
                animationDuration: `${7 + (i % 5) * 1.3}s`,
                animationDelay: `-${(i * 1.7) % 6}s`,
              }}
            >
              <SubjectTile name={name} size={far ? 44 : 58} status={i} style={far ? { opacity: 0.55 } : undefined} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** The phone version: a row under the buttons, drifting in place. */
export function FloatingSubjectsRow() {
  const row = ['physics', 'biology', 'maths', 'english', 'economics', 'arts']
  return (
    <div aria-hidden="true" className="mt-12 flex max-w-md justify-between gap-2 lg:hidden">
      {row.map((name, i) => (
        <div key={name} className="float-in" style={{ animationDelay: `${400 + i * 70}ms` }}>
          <div className="float-drift" style={{ animationDuration: `${6 + i}s`, animationDelay: `-${i * 1.3}s` }}>
            <SubjectTile name={name} size={44} status={i} />
          </div>
        </div>
      ))}
    </div>
  )
}
