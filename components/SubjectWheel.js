'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSlugForSubject } from '@/lib/subject-map'
import { IconArrowLeft, IconArrowRight } from '@/components/Icons'

/**
 * Your programme as one shape, and a way into it.
 *
 * The Diploma is taught as a diagram — six subjects around a core — and this is
 * that diagram with your own marks in it. Each subject is a slice, ruled off
 * from its neighbours and filled from the inside out as far as your answers
 * have proved it. The core sits in a thinner ring inside, because it is
 * coursework and carries a target rather than a level you earned. A-Level and
 * AP have no core, so that ring is not drawn.
 *
 * Pressing a slice takes it out of the wheel: everything else fades, and the
 * slice you pressed turns around the centre until it is sitting at the bottom,
 * with what it contains written above it. It is the same motion as putting one
 * thing down on the desk and reading it.
 *
 * Every coordinate is rounded. Arc maths is floating point, and unrounded
 * values differ in the last digit between the server and the browser, which
 * React reports as a hydration mismatch.
 */

const SIZE = 600
const C = SIZE / 2

// The outer ring is nearly twice the inner one. They are different kinds of
// thing — six subjects you are marked on, three components you are not — and
// two rings of the same weight read as one ring split in half.
const R_SUBJ_IN = 196
const R_SUBJ_OUT = 268
const R_LABEL = 284

const R_CORE_IN = 128
const R_CORE_OUT = 168

const R_CENTRE = 116

const r2 = (n) => Math.round(n * 100) / 100

function polar(radius, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return [r2(C + radius * Math.cos(rad)), r2(C + radius * Math.sin(rad))]
}

/** A closed wedge between two radii. Sharp corners, no rounding. */
function wedge(rIn, rOut, a0, a1) {
  if (a1 - a0 <= 0.01) return ''
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = polar(rOut, a0)
  const [x1, y1] = polar(rOut, a1)
  const [x2, y2] = polar(rIn, a1)
  const [x3, y3] = polar(rIn, a0)
  return `M ${x0} ${y0} A ${rOut} ${rOut} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rIn} ${rIn} 0 ${large} 0 ${x3} ${y3} Z`
}

/**
 * An open arc for a label to sit on. Slices on the bottom half are drawn
 * anticlockwise, otherwise the text runs along the path upside down.
 */
function labelArc(radius, a0, a1) {
  const mid = (a0 + a1) / 2
  const flip = mid > 90 && mid < 270
  const [sa, ea] = flip ? [a1, a0] : [a0, a1]
  const [x0, y0] = polar(radius, sa)
  const [x1, y1] = polar(radius, ea)
  const sweep = flip ? 0 : 1
  return `M ${x0} ${y0} A ${radius} ${radius} 0 0 ${sweep} ${x1} ${y1}`
}

const CORE_SHORT = {
  'Theory of Knowledge': 'TOK',
  'Extended Essay': 'EE',
  'Creativity Activity Service': 'CAS',
}

/** Names are set on the slice, so they have to fit on it. */
function fit(name, chars) {
  return name.length > chars ? `${name.slice(0, chars - 1).trimEnd()}…` : name
}

export default function SubjectWheel({
  subjects,
  core = [],
  breakdown = {},
  counts = {},
  targets = {},
  overall = 0,
  lockedSubjects = [],
  topicsBySubject = {},
}) {
  const [open, setOpen] = useState(null) // index of the slice on the desk
  const [at, setAt] = useState(null) // index under the pointer

  if (!subjects.length) return null

  const step = 360 / subjects.length
  const masteredIn = (s) => breakdown[s]?.mastered || 0
  const sizeOf = (s) => counts[s] || 0
  const fractionOf = (s) => (sizeOf(s) ? masteredIn(s) / sizeOf(s) : 0)

  const openSubject = open === null ? null : subjects[open]
  const openTopics = openSubject ? topicsBySubject[openSubject] || [] : []
  const hoveredSubject = at === null ? null : subjects[at]

  // How far the wheel has to turn to bring the open slice to the bottom.
  const spin = open === null ? 0 : r2(180 - (open * step + step / 2))

  // Room for the label ring, which sits outside the slices.
  const PAD = 40
  const viewBox = `${-PAD} ${-PAD} ${SIZE + PAD * 2} ${SIZE + PAD * 2}`

  const close = () => {
    setOpen(null)
    setAt(null)
  }

  return (
    <div className="flex flex-col items-center">
      {/* What the wheel is showing, written above it. Fixed height, so opening
          a slice does not shunt the wheel up and down the page. */}
      <div className="flex min-h-[150px] w-full max-w-2xl flex-col items-center justify-end pb-6 text-center">
        {openSubject ? (
          <>
            <button
              onClick={close}
              className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors duration-150 hover:text-[var(--text)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <IconArrowLeft width={13} height={13} />
              Back to the wheel
            </button>
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {lockedSubjects.includes(openSubject) ? 'Locked on the free plan' : 'Subject'}
            </p>
            <h3 className="mt-2.5 text-[clamp(1.5rem,3.4vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em]">
              {openSubject}
            </h3>
            <p className="mt-2.5 text-[14px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {masteredIn(openSubject)} of {sizeOf(openSubject)} subtopics mastered
              {targets[openSubject] ? ` · target ${targets[openSubject]}` : ''}
            </p>
          </>
        ) : (
          <>
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {hoveredSubject
                ? lockedSubjects.includes(hoveredSubject)
                  ? 'Locked on the free plan'
                  : 'Subject'
                : 'Your programme'}
            </p>
            <h3 className="mt-2.5 text-[clamp(1.4rem,3vw,1.9rem)] font-semibold leading-tight tracking-[-0.03em]">
              {hoveredSubject ||
                `${subjects.length} subject${subjects.length === 1 ? '' : 's'}${core.length ? ' and the core' : ''}`}
            </h3>
            <p className="mt-2.5 text-[14px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {hoveredSubject
                ? `${masteredIn(hoveredSubject)} of ${sizeOf(hoveredSubject)} subtopics mastered${
                    targets[hoveredSubject] ? ` · target ${targets[hoveredSubject]}` : ''
                  }`
                : 'Each slice fills as you prove a subtopic. Press one to take it out.'}
            </p>
          </>
        )}
      </div>

      <div className="relative w-full max-w-[min(100%,620px)]">
        <svg
          viewBox={viewBox}
          className="block w-full"
          role="img"
          aria-label={
            openSubject
              ? `${openSubject}, ${masteredIn(openSubject)} of ${sizeOf(openSubject)} subtopics mastered`
              : `Your ${subjects.length} subjects, ${overall}% of the syllabus mastered`
          }
          onMouseLeave={() => setAt(null)}
        >
          {/* The slices. The whole group turns, which is what carries the one you
              pressed down to the bottom. */}
          <g
            style={{
              // Turning brings the pressed slice to the bottom; the scale is
            // what makes it read as coming toward you rather than as the wheel
            // merely rotating.
            transform: `rotate(${spin}deg)${open === null ? '' : ' scale(1.12)'}`,
              transformOrigin: `${C}px ${C}px`,
              transition: 'transform 620ms cubic-bezier(0.22, 0.68, 0.24, 1)',
            }}
          >
            {subjects.map((subject, i) => {
              const a0 = i * step
              const a1 = (i + 1) * step
              const locked = lockedSubjects.includes(subject)
              const frac = locked ? 0 : fractionOf(subject)
              const rFill = R_SUBJ_IN + (R_SUBJ_OUT - R_SUBJ_IN) * frac
              const isOpen = open === i
              const on = at === i || isOpen
              // Everything that is not the slice you pressed gets out of the way.
              const faded = open !== null && !isOpen
              const labelId = `wheel-label-${i}`

              return (
                <g
                  key={subject}
                  style={{
                    opacity: faded ? 0 : open === null && at !== null && !on ? 0.32 : 1,
                    pointerEvents: faded ? 'none' : 'auto',
                    transition: 'opacity 380ms ease',
                  }}
                >
                  <path
                    d={wedge(R_SUBJ_IN, R_SUBJ_OUT, a0, a1)}
                    fill="var(--surface-sunken)"
                    stroke={on ? 'var(--text)' : 'var(--border-strong)'}
                    strokeWidth={on ? 2 : 1}
                    style={{ transition: 'stroke 180ms ease, stroke-width 180ms ease' }}
                  />
                  {frac > 0 && (
                    <path d={wedge(R_SUBJ_IN, rFill, a0, a1)} fill="var(--brand)" opacity={on ? 1 : 0.92} />
                  )}

                  {/* The name, curved along the outside of its own slice. */}
                  <path id={labelId} d={labelArc(R_LABEL, a0 + 1.5, a1 - 1.5)} fill="none" />
                  <text
                    fontSize="14"
                    fontWeight="600"
                    letterSpacing="-0.01em"
                    fill={on ? 'var(--text)' : 'var(--text-muted)'}
                    style={{ opacity: open === null ? 1 : 0, transition: 'opacity 240ms ease' }}
                  >
                    <textPath href={`#${labelId}`} startOffset="50%" textAnchor="middle">
                      {fit(subject, 26)}
                    </textPath>
                  </text>

                  <path
                    d={wedge(R_SUBJ_IN, R_SUBJ_OUT, a0, a1)}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${subject}, ${masteredIn(subject)} of ${sizeOf(subject)} subtopics mastered`}
                    style={{ cursor: 'pointer', outline: 'none' }}
                    onMouseEnter={() => setAt(i)}
                    onFocus={() => setAt(i)}
                    onClick={() => setOpen(open === i ? null : i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setOpen(open === i ? null : i)
                      }
                    }}
                  />
                </g>
              )
            })}
          </g>

          {/* The core. Thinner, unlabelled by mastery, and it steps aside when a
              subject is open because it does not belong to any one of them. */}
          <g
            style={{
              opacity: open === null ? 1 : 0,
              pointerEvents: open === null ? 'auto' : 'none',
              transition: 'opacity 380ms ease',
            }}
          >
            {core.map((component, i) => {
              const coreStep = 360 / core.length
              const a0 = i * coreStep
              const a1 = (i + 1) * coreStep
              const [lx, ly] = polar((R_CORE_IN + R_CORE_OUT) / 2, (a0 + a1) / 2)
              const grade = targets[component]
              return (
                <g key={component}>
                  <path
                    d={wedge(R_CORE_IN, R_CORE_OUT, a0, a1)}
                    fill="var(--surface)"
                    stroke="var(--border-strong)"
                    strokeWidth={1}
                  />
                  <text
                    x={lx}
                    y={ly - 2}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="0.08em"
                    fill="var(--text-muted)"
                  >
                    {CORE_SHORT[component] || component}
                  </text>
                  <text
                    x={lx}
                    y={ly + 13}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={grade ? 'var(--brand)' : 'var(--text-faint)'}
                  >
                    {grade || '—'}
                  </text>
                </g>
              )
            })}
          </g>

          {/* The middle never turns. */}
          <g
            style={{
              opacity: open === null ? 1 : 0,
              transition: 'opacity 300ms ease',
            }}
          >
            <circle cx={C} cy={C} r={R_CENTRE} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
            <text
              x={C}
              y={C + 6}
              textAnchor="middle"
              fontSize="46"
              fontWeight="600"
              letterSpacing="-0.03em"
              fill="var(--text)"
            >
              {overall}%
            </text>
            <text x={C} y={C + 32} textAnchor="middle" fontSize="12" fill="var(--text-muted)">
              mastered
            </text>
          </g>
        </svg>

        {/* What the slice contains, in the space the rest of the wheel has
            just left. The slice itself stays visible underneath, at the
            bottom, so it is clear what you are looking inside. */}
        {openSubject && (
          <div className="wheel-topics absolute inset-x-[6%] top-[9%] max-h-[64%] overflow-y-auto">
            {openTopics.length > 0 ? (
              <ul>
                {openTopics.map((t) => (
                  <li
                    key={t.topic}
                    className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className="min-w-0 flex-1 truncate text-left text-[13px]">{t.topic}</span>
                    <span
                      className="hidden h-[3px] w-16 shrink-0 overflow-hidden sm:block"
                      style={{ background: 'var(--surface-sunken)' }}
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: `${t.total ? (t.mastered / t.total) * 100 : 0}%`,
                          background: 'var(--brand)',
                        }}
                      />
                    </span>
                    <span
                      className="w-10 shrink-0 text-right text-[12px] tabular-nums"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {t.mastered}/{t.total}
                    </span>
                    <Link
                      href={`/dashboard/quiz?subject=${encodeURIComponent(openSubject)}&topic=${encodeURIComponent(t.topic)}&mode=topic&back=/dashboard`}
                      className="btn btn-quiet control-sm shrink-0"
                    >
                      Test
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                No topics loaded for this subject yet.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {openSubject ? (
          <Link
            href={
              lockedSubjects.includes(openSubject)
                ? '/dashboard/profile#unlock'
                : `/dashboard/syllabus/${getSlugForSubject(openSubject)}`
            }
            className="btn btn-solid control-md"
          >
            {lockedSubjects.includes(openSubject) ? 'Unlock it' : `Open ${openSubject}`}
            <IconArrowRight width={16} height={16} />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
