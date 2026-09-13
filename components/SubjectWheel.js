'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSlugForSubject } from '@/lib/subject-map'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'

/**
 * Your programme as one shape.
 *
 * The Diploma is taught as a diagram — six subjects around a core — and this is
 * that diagram with your own marks in it. The outer ring is one arc per
 * subject, filled as far as you have proved it. The inner ring is the core,
 * which is coursework and cannot be quizzed, so it carries the grade you are
 * aiming for rather than a level you earned. The middle is the whole syllabus
 * in one number.
 *
 * A-Level and AP have no core, so the inner ring simply is not drawn. The ring
 * of subjects is the part that carries the information either way.
 *
 * Every coordinate is rounded. Arc maths is floating point, and unrounded
 * values differ in the last digit between the server and the browser, which
 * React reports as a hydration mismatch.
 */

const SIZE = 320
const C = SIZE / 2

const R_SUBJ_OUT = 150
const R_SUBJ_IN = 112
const R_CORE_OUT = 98
const R_CORE_IN = 74
const R_CENTRE = 66

/** Degrees of empty space between neighbouring arcs. */
const GAP = 2.4

const r2 = (n) => Math.round(n * 100) / 100

function polar(radius, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return [r2(C + radius * Math.cos(rad)), r2(C + radius * Math.sin(rad))]
}

/** One ring segment, as a closed path. */
function arc(rIn, rOut, a0, a1) {
  if (a1 - a0 <= 0.01) return ''
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = polar(rOut, a0)
  const [x1, y1] = polar(rOut, a1)
  const [x2, y2] = polar(rIn, a1)
  const [x3, y3] = polar(rIn, a0)
  return `M ${x0} ${y0} A ${rOut} ${rOut} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rIn} ${rIn} 0 ${large} 0 ${x3} ${y3} Z`
}

const CORE_SHORT = {
  'Theory of Knowledge': 'TOK',
  'Extended Essay': 'EE',
  'Creativity Activity Service': 'CAS',
}

export default function SubjectWheel({ subjects, core = [], breakdown = {}, counts = {}, targets = {}, overall = 0, lockedSubjects = [] }) {
  const [at, setAt] = useState(null)

  if (!subjects.length) return null

  const step = 360 / subjects.length
  const active = at === null ? null : subjects[at]

  const mastered = (subject) => breakdown[subject]?.mastered || 0
  const total = (subject) => counts[subject] || 0
  const fraction = (subject) => (total(subject) ? mastered(subject) / total(subject) : 0)

  const coreStep = core.length ? 360 / core.length : 0

  return (
    <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-10">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-[260px] shrink-0 sm:w-[300px]"
        role="img"
        aria-label={`Your ${subjects.length} subjects, ${overall}% of the syllabus mastered`}
        onMouseLeave={() => setAt(null)}
      >
        {/* Subjects */}
        {subjects.map((subject, i) => {
          const a0 = i * step + GAP / 2
          const a1 = (i + 1) * step - GAP / 2
          const locked = lockedSubjects.includes(subject)
          const filled = a0 + (a1 - a0) * (locked ? 0 : fraction(subject))
          const on = at === i

          return (
            <g key={subject}>
              <path
                d={arc(R_SUBJ_IN, R_SUBJ_OUT, a0, a1)}
                fill="var(--surface-sunken)"
                stroke={on ? 'var(--text)' : 'var(--border)'}
                strokeWidth={on ? 1.5 : 1}
              />
              <path
                d={arc(R_SUBJ_IN, R_SUBJ_OUT, a0, filled)}
                fill={locked ? 'transparent' : 'var(--brand)'}
                opacity={on ? 1 : 0.85}
              />
              {/* The hit area sits on top so the fill underneath cannot swallow
                  the pointer at the edge between track and progress. */}
              <path
                d={arc(R_SUBJ_IN, R_SUBJ_OUT, a0, a1)}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${subject}, ${mastered(subject)} of ${total(subject)} subtopics mastered`}
                style={{ cursor: 'pointer', outline: 'none' }}
                onMouseEnter={() => setAt(i)}
                onFocus={() => setAt(i)}
                onBlur={() => setAt(null)}
                onClick={() => setAt(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setAt(i)
                  }
                }}
              />
            </g>
          )
        })}

        {/* The core, if this programme has one. */}
        {core.map((component, i) => {
          const a0 = i * coreStep + GAP / 2
          const a1 = (i + 1) * coreStep - GAP / 2
          const mid = (a0 + a1) / 2
          const [lx, ly] = polar((R_CORE_IN + R_CORE_OUT) / 2, mid)
          const grade = targets[component]
          return (
            <g key={component}>
              <path
                d={arc(R_CORE_IN, R_CORE_OUT, a0, a1)}
                fill="var(--surface-sunken)"
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={lx}
                y={ly - 3}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                letterSpacing="0.06em"
                fill="var(--text-muted)"
              >
                {CORE_SHORT[component] || component}
              </text>
              <text
                x={lx}
                y={ly + 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={grade ? 'var(--brand)' : 'var(--text-faint)'}
              >
                {grade || '—'}
              </text>
            </g>
          )
        })}

        {/* The whole thing in one number. */}
        <circle cx={C} cy={C} r={R_CENTRE} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        <text
          x={C}
          y={C - 2}
          textAnchor="middle"
          fontSize="30"
          fontWeight="600"
          letterSpacing="-0.03em"
          fill="var(--text)"
        >
          {overall}%
        </text>
        <text x={C} y={C + 18} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
          mastered
        </text>
      </svg>

      {/* The readout. Point at an arc and it says what it is; otherwise it
          names the programme, so the panel is never empty. */}
      <div className="min-w-0 flex-1 text-center sm:text-left">
        {active ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              {lockedSubjects.includes(active) ? 'Locked on the free plan' : 'Subject'}
            </p>
            <p className="mt-2 text-[19px] font-semibold leading-snug tracking-[-0.02em]">{active}</p>
            <p className="mt-2 text-[14px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {mastered(active)} of {total(active)} subtopics mastered
              {targets[active] ? ` · target ${targets[active]}` : ''}
            </p>
            <Link
              href={
                lockedSubjects.includes(active)
                  ? '/dashboard/profile#unlock'
                  : `/dashboard/syllabus/${getSlugForSubject(active)}`
              }
              className="btn btn-outline control-sm mt-5"
            >
              {lockedSubjects.includes(active) ? 'Unlock it' : 'Open syllabus'}
            </Link>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              Your programme
            </p>
            <p className="mt-2 text-[19px] font-semibold leading-snug tracking-[-0.02em]">
              {subjects.length} subject{subjects.length === 1 ? '' : 's'}
              {core.length ? ' and the core' : ''}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Each arc fills as you prove a subtopic.
              {core.length
                ? ' The inner ring is coursework, so it carries your target rather than a level.'
                : ''}{' '}
              Point at one.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export { IB_CORE_SUBJECTS }
