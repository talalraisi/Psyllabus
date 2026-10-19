'use client'

import { useEffect, useRef, useState } from 'react'
import SyllabiMark from '@/components/SyllabiMark'

/**
 * Where a conversation with Syllabi starts: your subjects circling it.
 *
 * The same orbit as the subject map (SubjectWeb), turning slowly until you
 * touch it. Pick a subject and it swings to the top, then the chat opens on
 * it. Nothing here needs reading, which is the point of a first screen.
 */

const RADIUS = 37 // % of the stage
const SPEED = 5 // degrees per second

/** "Math Analysis & Approaches HL" → AA, "Computer Science SL" → CS, "Physics SL" → Ph. */
export function subjectCode(subject = '') {
  if (/^Math Analysis/i.test(subject)) return 'AA'
  if (/^Math Applications/i.test(subject)) return 'AI'
  if (/^Theory of Knowledge/i.test(subject)) return 'TOK'
  if (/^Extended Essay/i.test(subject)) return 'EE'
  if (/^(CAS\b|Creativity)/i.test(subject)) return 'CAS'
  const words = subject
    .replace(/\b(SL|HL|A:|B|ab initio)\b/gi, '')
    .split(/[\s:&,]+/)
    .filter((w) => /^[A-Za-z]/.test(w))
  if (words.length >= 2 && /^[A-Z]/.test(words[1])) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] || subject).slice(0, 2)
}

/** A name that fits under a node: "Math Analysis & Approaches HL" → "Maths AA". */
export function shortName(subject = '') {
  return subject
    .replace(/\s+(SL|HL)$/, '')
    .replace(/^Math Analysis & Approaches/i, 'Maths AA')
    .replace(/^Math Applications & Interpretation/i, 'Maths AI')
    .replace(/^Creativity,? Activity,? (and )?Service/i, 'CAS')
    .replace(/^English A: Language & Literature/i, 'English Lang & Lit')
    .replace(/^English A: Literature/i, 'English Lit')
    .replace(/^(\w+) A: Language & Literature/i, '$1 Lang & Lit')
}

const levelOf = (subject = '') => (subject.match(/\b(SL|HL)\b/) || [])[1] || ''

const turn = (a, b) => ((((b - a) % 360) + 540) % 360) - 180

export default function SubjectOrbit({ subjects = [], onPick }) {
  const [angle, setAngle] = useState(0)
  const [held, setHeld] = useState(false)
  const [picked, setPicked] = useState(null)
  const angleRef = useRef(0)
  const targetRef = useRef(null)
  const n = subjects.length || 1

  // One loop for the slow turn and the swing to a picked subject; it stops
  // itself when nothing needs to move, and never turns for reduced motion.
  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    const tick = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const target = targetRef.current
      let a = angleRef.current
      if (target != null) {
        const d = turn(a, target)
        a = Math.abs(d) < 0.2 ? target : a + d * Math.min(1, dt * 8)
      } else if (!held && !still) {
        a = (a + SPEED * dt) % 360
      } else {
        return
      }
      angleRef.current = a
      setAngle(a)
      if (target == null || a !== target) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [held, picked])

  const pick = (subject, i) => {
    if (picked) return
    targetRef.current = -90 - (i / n) * 360
    setPicked(subject)
    // Long enough to see it arrive at the top.
    setTimeout(() => onPick?.(subject), 650)
  }

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-[18px] border"
      style={{
        borderColor: 'var(--border)',
        background: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--brand) 9%, var(--surface)) 0%, var(--surface) 62%)',
        aspectRatio: '1 / 1',
        maxWidth: 'min(100%, 70vh, 640px)',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute rounded-full border" style={{ inset: `${50 - RADIUS}%`, borderColor: 'var(--border-strong)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute rounded-full border border-dashed" style={{ inset: `${50 - RADIUS * 0.6}%`, borderColor: 'var(--border)' }} />

      {/* Syllabi, in the middle of it all. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <span className="relative flex items-center justify-center">
          <span aria-hidden="true" className="absolute h-16 w-16 animate-ping rounded-full sm:h-24 sm:w-24" style={{ border: '1px solid color-mix(in srgb, var(--brand) 40%, transparent)', animationDuration: '2.6s' }} />
          <span
            className="relative flex h-16 w-16 items-center justify-center rounded-full sm:h-24 sm:w-24"
            style={{ background: 'var(--brand)', color: '#fff', boxShadow: '0 0 40px color-mix(in srgb, var(--brand) 45%, transparent)' }}
          >
            <SyllabiMark size={30} />
          </span>
        </span>
        <span className="mt-3 text-[13px] font-medium transition-opacity duration-300" style={{ color: 'var(--text-muted)', opacity: picked ? 0 : 1 }}>
          Pick a subject
        </span>
      </div>

      {subjects.map((s, i) => {
        const rad = (((i / n) * 360 + angle) * Math.PI) / 180
        const x = 50 + RADIUS * Math.cos(rad)
        const y = 50 + RADIUS * Math.sin(rad)
        const depth = (1 + Math.sin(rad)) / 2
        const on = picked === s
        const size = n > 8 ? 44 : 56
        return (
          <div
            key={s}
            className="absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: on ? 30 : 10 + Math.round(depth * 10),
              opacity: on ? 1 : picked ? 0.35 : 0.65 + 0.35 * depth,
              transition: 'opacity 300ms',
            }}
          >
            <button
              type="button"
              onClick={() => pick(s, i)}
              onPointerEnter={() => setHeld(true)}
              onPointerLeave={() => setHeld(false)}
              onFocus={() => setHeld(true)}
              onBlur={() => setHeld(false)}
              aria-label={`Ask about ${s}`}
              className="relative flex items-center justify-center rounded-full border-2 text-[13px] font-semibold transition-[transform,background-color,color] duration-300"
              style={{
                width: size,
                height: size,
                transform: on ? 'scale(1.3)' : undefined,
                background: on ? 'var(--text)' : 'var(--surface)',
                color: on ? 'var(--bg)' : 'var(--text)',
                borderColor: on ? 'var(--text)' : 'var(--border-strong)',
                boxShadow: on ? '0 8px 30px color-mix(in srgb, var(--text) 25%, transparent)' : '0 0 24px color-mix(in srgb, var(--text) 10%, transparent)',
              }}
            >
              {subjectCode(s)}
              {levelOf(s) && (
                <span
                  className="absolute -bottom-1.5 -right-1.5 rounded-full px-1.5 py-px text-[9px] font-semibold"
                  style={{ background: 'var(--brand)', color: '#fff' }}
                >
                  {levelOf(s)}
                </span>
              )}
            </button>
            <span
              // On a phone with many subjects the codes say enough; names would collide.
              className={`pointer-events-none absolute left-1/2 top-full mt-2.5 max-w-[8.5rem] -translate-x-1/2 truncate text-center text-[11.5px] font-medium ${n > 6 ? 'hidden sm:block' : ''}`}
              style={{ color: on ? 'var(--text)' : 'var(--text-muted)' }}
            >
              {shortName(s)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
