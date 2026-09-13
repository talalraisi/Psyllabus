'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSlugForSubject } from '@/lib/subject-map'
import { IconArrowLeft, IconArrowRight } from '@/components/Icons'

/**
 * Your programme as one shape, and a way into it.
 *
 * The Diploma is taught as a diagram — six subjects around a core — and this is
 * that diagram with your own marks in it. The outer ring is one arc per
 * subject, filled as far as your answers have proved it. The inner ring is the
 * core, which is coursework and cannot be quizzed, so it carries the grade you
 * are aiming for rather than a level you earned.
 *
 * Pressing a subject opens it: the ring becomes that subject's topics and the
 * middle becomes that subject's count, so the same shape carries you one level
 * down instead of sending you to another page. A-Level and AP have no core, so
 * the inner ring simply is not drawn.
 *
 * Arcs are strokes rather than filled wedges. A wedge has four corners and
 * needs a gap on both sides to stay legible; a stroke with round caps needs
 * neither, which is most of the difference between this reading as a chart and
 * reading as a dial.
 *
 * Every coordinate is rounded. Arc maths is floating point, and unrounded
 * values differ in the last digit between the server and the browser, which
 * React reports as a hydration mismatch.
 */

const SIZE = 440
const C = SIZE / 2

const R_RING = 176 // centre-line of the outer ring
const W_RING = 30
const R_CORE = 124 // centre-line of the core ring
const W_CORE = 26
const R_CENTRE = 96

/** Degrees of empty space between neighbouring arcs. */
const GAP = 3

const r2 = (n) => Math.round(n * 100) / 100

function polar(radius, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return [r2(C + radius * Math.cos(rad)), r2(C + radius * Math.sin(rad))]
}

/** An open arc, drawn as a stroke along `radius`. */
function arc(radius, a0, a1) {
  const span = a1 - a0
  if (span <= 0.01) return ''
  // A full circle cannot be drawn as one arc: start and end coincide and the
  // renderer draws nothing. Split it.
  if (span >= 359.99) {
    const [sx, sy] = polar(radius, 0)
    const [mx, my] = polar(radius, 180)
    return `M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${mx} ${my} A ${radius} ${radius} 0 1 1 ${sx} ${sy}`
  }
  const large = span > 180 ? 1 : 0
  const [x0, y0] = polar(radius, a0)
  const [x1, y1] = polar(radius, a1)
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`
}

const CORE_SHORT = {
  'Theory of Knowledge': 'TOK',
  'Extended Essay': 'EE',
  'Creativity Activity Service': 'CAS',
}

function Ring({ items, radius, width, activeIndex, onEnter, onSelect }) {
  const step = 360 / items.length
  const anyActive = activeIndex !== null && activeIndex !== undefined
  return (
    <g>
      {items.map((item, i) => {
        const a0 = i * step + GAP / 2
        const a1 = (i + 1) * step - GAP / 2
        const on = activeIndex === i
        const filled = a0 + (a1 - a0) * Math.max(0, Math.min(1, item.fraction))
        // The active arc steps out of the ring; the rest step back and fade.
        const r = on ? radius + 7 : radius
        const w = on ? width + 4 : width

        return (
          <g
            key={item.key}
            style={{
              opacity: anyActive && !on ? 0.3 : 1,
              transition: 'opacity 220ms ease',
            }}
          >
            <path
              d={arc(r, a0, a1)}
              fill="none"
              stroke="var(--surface-sunken)"
              strokeWidth={w}
              strokeLinecap="round"
              style={{ transition: 'stroke-width 200ms ease, d 200ms ease' }}
            />
            {item.fraction > 0 && (
              <path
                d={arc(r, a0, filled)}
                fill="none"
                stroke={item.locked ? 'transparent' : 'var(--brand)'}
                strokeWidth={w}
                strokeLinecap="round"
                style={{ transition: 'stroke-width 200ms ease' }}
              />
            )}
            {/* A transparent stroke on top, so the pointer target is the whole
                arc rather than whichever layer happens to be under the cursor. */}
            <path
              d={arc(radius, a0, a1)}
              fill="none"
              stroke="transparent"
              strokeWidth={width + 16}
              strokeLinecap="round"
              tabIndex={0}
              role="button"
              aria-label={item.label}
              style={{ cursor: 'pointer', outline: 'none' }}
              onMouseEnter={() => onEnter(i)}
              onFocus={() => onEnter(i)}
              onClick={() => {
                onEnter(i)
                onSelect?.(i)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onEnter(i)
                  onSelect?.(i)
                }
              }}
            />
          </g>
        )
      })}
    </g>
  )
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
  const [open, setOpen] = useState(null) // the subject you have pressed into
  const [at, setAt] = useState(null) // the arc under the pointer

  if (!subjects.length) return null

  const masteredIn = (subject) => breakdown[subject]?.mastered || 0
  const sizeOf = (subject) => counts[subject] || 0

  const subjectItems = subjects.map((subject) => ({
    key: subject,
    label: `${subject}, ${masteredIn(subject)} of ${sizeOf(subject)} subtopics mastered`,
    fraction: sizeOf(subject) ? masteredIn(subject) / sizeOf(subject) : 0,
    locked: lockedSubjects.includes(subject),
  }))

  const openTopics = open ? topicsBySubject[open] || [] : []
  const topicItems = openTopics.map((t) => ({
    key: t.topic,
    label: `${t.topic}, ${t.mastered} of ${t.total} subtopics mastered`,
    fraction: t.total ? t.mastered / t.total : 0,
    locked: false,
  }))

  const ringItems = open ? topicItems : subjectItems
  const hovered = at === null ? null : ringItems[at]

  // What the middle says, and what the block above the wheel says. Both are
  // kept in one place so they can never describe different things.
  const centre = open
    ? { big: `${masteredIn(open)}/${sizeOf(open)}`, small: 'mastered' }
    : { big: `${overall}%`, small: 'mastered' }

  const close = () => {
    setOpen(null)
    setAt(null)
  }

  const selectSubject = (i) => {
    const subject = subjects[i]
    if (!topicsBySubject[subject]?.length) return
    setOpen(subject)
    setAt(null)
  }

  const openTopicHref = (topic) =>
    `/dashboard/quiz?subject=${encodeURIComponent(open)}&topic=${encodeURIComponent(topic)}&mode=topic&back=/dashboard`

  return (
    <div className="flex flex-col items-center">
      {/* The readout. Fixed height so opening a subject does not shunt the
          wheel up and down the page. */}
      <div className="flex min-h-[128px] w-full max-w-xl flex-col items-center justify-end pb-8 text-center">
        {open ? (
          <>
            <button
              onClick={close}
              className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors duration-150 hover:text-[var(--text)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <IconArrowLeft width={13} height={13} />
              All subjects
            </button>
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {open}
            </p>
            <p className="mt-2.5 text-[clamp(1.2rem,2.6vw,1.6rem)] font-semibold leading-tight tracking-[-0.025em]">
              {hovered ? hovered.key : `${openTopics.length} topics`}
            </p>
            <p className="mt-2 text-[13.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {hovered
                ? `${openTopics[at].mastered} of ${openTopics[at].total} subtopics mastered`
                : 'Point at a topic to see where it stands.'}
            </p>
          </>
        ) : (
          <>
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {hovered ? (hovered.locked ? 'Locked on the free plan' : 'Subject') : 'Your programme'}
            </p>
            <p className="mt-2.5 text-[clamp(1.2rem,2.6vw,1.6rem)] font-semibold leading-tight tracking-[-0.025em]">
              {hovered
                ? hovered.key
                : `${subjects.length} subject${subjects.length === 1 ? '' : 's'}${core.length ? ' and the core' : ''}`}
            </p>
            <p className="mt-2 text-[13.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {hovered
                ? `${masteredIn(hovered.key)} of ${sizeOf(hovered.key)} subtopics mastered${
                    targets[hovered.key] ? ` · target ${targets[hovered.key]}` : ''
                  }`
                : 'Point at an arc. Press it to open the subject.'}
            </p>
          </>
        )}
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[min(100%,440px)]"
        role="img"
        aria-label={
          open
            ? `${open}, ${openTopics.length} topics`
            : `Your ${subjects.length} subjects, ${overall}% of the syllabus mastered`
        }
        onMouseLeave={() => setAt(null)}
      >
        {/* Keyed so React replaces the group rather than mutating it, which is
            what lets the level change animate in as a whole. */}
        <g key={open || 'root'} className="wheel-level">
          <Ring
            items={ringItems}
            radius={R_RING}
            width={W_RING}
            activeIndex={at}
            onEnter={setAt}
            onSelect={open ? undefined : selectSubject}
          />

          {/* The core. It belongs to the programme, not to one subject, so it
              steps back rather than disappearing when a subject is open. */}
          {core.length > 0 &&
            core.map((component, i) => {
              const step = 360 / core.length
              const a0 = i * step + GAP / 2
              const a1 = (i + 1) * step - GAP / 2
              const [lx, ly] = polar(R_CORE, (a0 + a1) / 2)
              const grade = targets[component]
              return (
                <g key={component} style={{ opacity: open ? 0.3 : 1, transition: 'opacity 260ms ease' }}>
                  <path
                    d={arc(R_CORE, a0, a1)}
                    fill="none"
                    stroke="var(--surface-sunken)"
                    strokeWidth={W_CORE}
                    strokeLinecap="round"
                  />
                  <text
                    x={lx}
                    y={ly - 2}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    letterSpacing="0.08em"
                    fill="var(--text-muted)"
                  >
                    {CORE_SHORT[component] || component}
                  </text>
                  <text
                    x={lx}
                    y={ly + 11}
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

          <circle cx={C} cy={C} r={R_CENTRE} fill="var(--surface)" />
          <text
            x={C}
            y={C + 4}
            textAnchor="middle"
            fontSize={centre.big.length > 5 ? 30 : 38}
            fontWeight="600"
            letterSpacing="-0.03em"
            fill="var(--text)"
          >
            {centre.big}
          </text>
          <text x={C} y={C + 26} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
            {centre.small}
          </text>
        </g>
      </svg>

      {/* The way out of the wheel, once you have found what you were looking
          for in it. */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {open ? (
          <>
            {hovered && (
              <Link href={openTopicHref(hovered.key)} className="btn btn-solid control-md">
                Test {hovered.key}
                <IconArrowRight width={16} height={16} />
              </Link>
            )}
            <Link
              href={`/dashboard/syllabus/${getSlugForSubject(open)}`}
              className="btn btn-outline control-md"
            >
              Open {open}
            </Link>
          </>
        ) : hovered ? (
          <Link
            href={
              hovered.locked
                ? '/dashboard/profile#unlock'
                : `/dashboard/syllabus/${getSlugForSubject(hovered.key)}`
            }
            className="btn btn-outline control-md"
          >
            {hovered.locked ? 'Unlock it' : `Open ${hovered.key}`}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
