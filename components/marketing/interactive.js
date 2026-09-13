'use client'

import { useState, useMemo, useId } from 'react'
import { IconCheck, IconClose, IconArrowRight } from '@/components/Icons'

/**
 * The interactive parts of the homepage.
 *
 * Entrance animation pays off once. What keeps a page alive is being able to
 * operate the thing it is describing, and the useful constraint is that every
 * widget here demonstrates a mechanic that actually exists in the product: the
 * question format with its per-option feedback, the points model, decay, and
 * the planner. Nothing is a toy that does something the app cannot do.
 *
 * That also makes it the one section a competitor cannot copy. A marketing
 * animation is a weekend of work; a working demo of a mechanic requires having
 * built the mechanic.
 */

/* ------------------------------------------------------------------ heatmap */

/**
 * Real syllabus structure, so the map is readable rather than decorative.
 *
 * Numbered the way a course is actually numbered — topic 1, subtopic 1.1 — and
 * named, because a coloured square nobody can identify is decoration. Hovering
 * one has to tell you which subtopic it is and where you stand on it, or the
 * grid is just a pattern.
 */
const TOPICS = [
  { n: 1, name: 'Space, time and motion', subs: ['Kinematics', 'Forces and momentum', 'Work, energy and power', 'Circular motion', 'Gravitational fields'] },
  { n: 2, name: 'The particulate nature of matter', subs: ['Thermal energy transfers', 'Greenhouse effect', 'Current and circuits', 'Modelling a gas'] },
  { n: 3, name: 'Wave behaviour', subs: ['Simple harmonic motion', 'Wave model', 'Wave phenomena', 'Standing waves', 'Doppler effect'] },
  { n: 4, name: 'Fields', subs: ['Electric fields', 'Magnetic fields', 'Motion in fields', 'Induction'] },
  { n: 5, name: 'Nuclear and quantum physics', subs: ['Structure of the atom', 'Radioactive decay', 'Fission', 'Fusion and stars'] },
]

/** Flat list of every subtopic with its 1.1-style reference. */
const SUBTOPICS = TOPICS.flatMap((t) =>
  t.subs.map((name, i) => ({ ref: `${t.n}.${i + 1}`, name, topic: t.name }))
)

const STATUS_LABEL = {
  weak: 'Weak',
  developing: 'Developing',
  proficient: 'Proficient',
  mastered: 'Mastered',
  fading: 'Fading',
  untested: 'Not tested',
}

/**
 * Deterministic, and weighted so early topics are mostly proved and later ones
 * mostly untested, which is the shape of a real student mid-course. Mastery is
 * derived from the status so the readout can show a number that agrees with the
 * colour.
 */
function buildCells(count) {
  const noise = (i) => (((i + 1) * 2654435761) >>> 8) % 1000
  return Array.from({ length: count }, (_, i) => {
    const through = i / Math.max(1, count - 1)
    const r = noise(i) / 1000
    if (r < 0.08 + through * 0.6) return { status: 'untested', points: 0 }

    const q = (r - (0.08 + through * 0.6)) / Math.max(0.05, 1 - (0.08 + through * 0.6))
    const skill = q * 0.55 + (1 - through) * 0.45
    const status =
      skill > 0.78 ? 'mastered'
      : skill > 0.54 ? 'proficient'
      : skill > 0.32 ? 'developing'
      : skill > 0.14 ? 'weak'
      : 'fading'
    const points =
      status === 'mastered' ? 9 + Math.round(r * 10) / 10
      : status === 'proficient' ? 7 + Math.round(r * 19) / 10
      : status === 'developing' ? 5 + Math.round(r * 19) / 10
      : status === 'fading' ? 6 + Math.round(r * 29) / 10
      : 1 + Math.round(r * 39) / 10
    return { status, points: Math.min(10, points) }
  })
}

/**
 * The map, hoverable.
 *
 * Every cell is a real subtopic reference and the header becomes a readout, so
 * moving across it reads the course. The previous version numbered cells by
 * position in a grid whose width changed between the two places it was used,
 * so the same square reported two different subtopics depending on the layout —
 * the names are keyed off the cell index now rather than off the geometry.
 */
export function Heatmap({ cols = 12, rows = 8, subject = 'Physics SL' }) {
  const count = cols * rows
  const cells = useMemo(() => buildCells(count), [count])
  const [at, setAt] = useState(null)
  const active = at === null ? null : cells[at]
  const meta = at === null ? null : SUBTOPICS[at % SUBTOPICS.length]

  return (
    <div>
      <div className="mb-3 flex min-h-[40px] items-start justify-between gap-4">
        {meta ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold">
                <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>{meta.ref}</span>{' '}
                {meta.name}
              </p>
              <p className="truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
                Topic {meta.ref.split('.')[0]} · {meta.topic}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[12px] font-semibold" style={{ color: `var(--status-${active.status})` }}>
                {STATUS_LABEL[active.status]}
              </p>
              <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                {active.status === 'untested' ? 'no points yet' : `${active.points.toFixed(1)} / 10`}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-[12.5px] font-semibold">{subject}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {count} subtopics · point at one
              </p>
            </div>
            <p className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {cells.filter((c) => c.status === 'mastered').length} mastered
            </p>
          </>
        )}
      </div>

      <div
        className="grid gap-[5px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        onMouseLeave={() => setAt(null)}
      >
        {cells.map((c, i) => {
          const m = SUBTOPICS[i % SUBTOPICS.length]
          return (
            <button
              key={i}
              onMouseEnter={() => setAt(i)}
              onFocus={() => setAt(i)}
              onBlur={() => setAt(null)}
              title={`${m.ref} ${m.name} — ${STATUS_LABEL[c.status]}`}
              aria-label={`${m.ref} ${m.name}, ${STATUS_LABEL[c.status]}`}
              className="aspect-square rounded-[3px] transition-transform duration-100 hover:scale-[1.2]"
              style={{
                background: `var(--status-${c.status})`,
                outline: at === i ? '2px solid var(--text)' : 'none',
                outlineOffset: '1px',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- try a question */

const DEMO = {
  stem: 'A 2.0 kg mass moves in a circle of radius 0.50 m at a constant speed of 3.0 m/s. Calculate the centripetal force.',
  heat: 'Hot',
  points: 1,
  options: [
    { id: 'a', text: '12 N', why: 'Used v instead of v², so the speed was never squared.' },
    { id: 'b', text: '18 N', why: 'Used the diameter, 1.0 m, where the formula wants the radius.' },
    { id: 'c', text: '36 N', why: null },
    { id: 'd', text: '72 N', why: 'Doubled it. F = mv²/r has no factor of two in it.' },
  ],
  correct: 'c',
  working: 'F = mv²/r = 2.0 × 3.0² ÷ 0.50 = 36 N',
  hint: 'Start from F = mv²/r, and check which length the question gives you.',
}

/**
 * The whole loop in one widget: sit a question, get told the specific mistake
 * behind the option you picked, and watch mastery points move by an amount
 * that depends on how hard the question was.
 */
export function TryQuestion() {
  const [picked, setPicked] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const answered = picked !== null
  const right = picked === DEMO.correct
  const chosen = DEMO.options.find((o) => o.id === picked)

  const before = 7.25
  const after = right ? before + DEMO.points : before

  return (
    <div
      className="rounded-2xl border p-6 md:p-7"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span
          className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
          style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
        >
          {DEMO.heat} · {DEMO.points} point
        </span>
        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Physics SL · Circular motion
        </span>
      </div>

      <p className="text-[16px] font-medium leading-relaxed">{DEMO.stem}</p>

      <div className="mt-5 flex flex-col gap-2">
        {DEMO.options.map((o) => {
          const isPicked = picked === o.id
          const isAnswer = o.id === DEMO.correct
          const tone =
            !answered ? null : isAnswer ? 'proficient' : isPicked ? 'weak' : null

          return (
            <button
              key={o.id}
              disabled={answered}
              onClick={() => setPicked(o.id)}
              className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14.5px] transition-colors duration-150 disabled:cursor-default"
              style={{
                borderColor: tone ? `var(--status-${tone})` : 'var(--border-strong)',
                background: tone ? `color-mix(in oklab, var(--status-${tone}) 12%, transparent)` : 'transparent',
                // Set rather than inherited. A button with no author colour
                // falls back to the system `buttontext`, which follows
                // color-scheme instead of the palette, and in light mode that
                // rendered these options as near-white text on white.
                color: 'var(--text)',
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
                style={{ borderColor: tone ? `var(--status-${tone})` : 'var(--border-strong)', color: tone ? `var(--status-${tone})` : 'var(--text-muted)' }}
              >
                {answered && isAnswer ? <IconCheck width={11} height={11} /> : answered && isPicked ? <IconClose width={11} height={11} /> : o.id}
              </span>
              <span className="flex-1">{o.text}</span>
            </button>
          )
        })}
      </div>

      {!answered && (
        <div className="mt-5 flex items-center gap-4">
          {showHint ? (
            <p className="text-[13.5px]" style={{ color: 'var(--text-body)' }}>
              <span className="font-semibold">Hint. </span>
              {DEMO.hint}
            </p>
          ) : (
            <button
              onClick={() => setShowHint(true)}
              className="text-[13px] font-medium underline underline-offset-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Show a hint
            </button>
          )}
        </div>
      )}

      {answered && (
        <div className="rise mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          {!right && chosen?.why && (
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--status-weak)' }}>
              <span className="font-semibold">You picked {picked.toUpperCase()}. </span>
              {chosen.why}
            </p>
          )}
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {DEMO.working}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-[200px] flex-1">
              <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
                <span style={{ color: 'var(--text-muted)' }}>Mastery of this subtopic</span>
                <span className="font-semibold tabular-nums">{after.toFixed(2)} / 10</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-sunken)' }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${after * 10}%`, background: 'var(--status-proficient)' }}
                />
              </div>
              <p className="mt-2 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                {right
                  ? `A Hot question is worth ${DEMO.points} point. Easy ones are worth half of that.`
                  : 'Only correct answers pay, and each question pays once.'}
              </p>
            </div>

            <button
              onClick={() => {
                setPicked(null)
                setShowHint(false)
              }}
              className="rounded-full border px-4 py-2.5 text-[13px] font-medium"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- decay demo */

/**
 * Drag time forward and watch something you proved slip back.
 *
 * Driven by the forgetting curve itself rather than by a straight line, and
 * tuned to fall at the rate it actually falls: retention is roughly halved
 * within a fortnight of doing nothing, not gently eroded over a term. A slider
 * that drifts down politely misrepresents the one thing this feature exists to
 * point out.
 */
export function DecayDemo() {
  const [weeks, setWeeks] = useState(0)
  const id = useId()

  // Ebbinghaus in the shape that matters here: steep early, flattening late.
  const retention = Math.exp(-0.34 * weeks)
  const pct = Math.round(retention * 100)

  // Three states on the way down, not two. Fading means slipping and still
  // recoverable with a retest; below about a third retained it is not slipping
  // any more, it is gone, and calling that Fading would be flattering.
  const status = weeks < 2 ? 'mastered' : weeks < 4 ? 'fading' : 'weak'
  const label = status === 'mastered' ? 'Mastered' : status === 'fading' ? 'Fading' : 'Weak'
  const note =
    status === 'mastered' ? null
    : status === 'fading' ? 'back in your plan for a retest'
    : 'treated as untested again'

  const W = 300
  const H = 96
  // Rounded for the same reason the big curve is: these attributes are
  // rendered on the server and again in the browser, and Math.exp can differ
  // in the last bits between engines.
  const r2 = (n) => Math.round(n * 100) / 100
  const x = (w) => r2(8 + (w / 9) * (W - 16))
  const y = (r) => r2(H - 12 - r * (H - 26))

  const curveTo = (end, steps = 45) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const w = (i / steps) * end
      return `${i === 0 ? 'M' : 'L'}${x(w)},${y(Math.exp(-0.34 * w))}`
    }).join(' ')

  const path = curveTo(9)
  const travelled = weeks > 0 ? curveTo(weeks, Math.max(2, Math.round(weeks * 6))) : null

  return (
    <div
      className="rounded-[12px] border p-6 md:p-7"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <div className="flex items-center gap-4">
        <span
          className="h-12 w-12 shrink-0 rounded-[8px] transition-colors duration-400"
          style={{ background: `var(--status-${status})` }}
        />
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold">Wave characteristics</p>
          <p
            className="text-[12.5px] font-medium transition-colors duration-400"
            style={{ color: `var(--status-${status})` }}
          >
            {label}
            {note && ` · ${note}`}
          </p>
        </div>
        <span className="ml-auto shrink-0 text-right">
          <span className="block text-[19px] font-semibold tabular-nums">{pct}%</span>
          <span className="block text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
            retained
          </span>
        </span>
      </div>

      {/* The curve, with a marker that tracks the slider. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img" aria-label={`Retention after ${weeks} weeks: about ${pct}%`}>
        <line x1="8" x2={W - 8} y1={y(0)} y2={y(0)} stroke="var(--border)" />
        <line x1="8" x2={W - 8} y1={y(1)} y2={y(1)} stroke="var(--border)" strokeDasharray="2 4" />
        <path d={path} fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
        {travelled && (
          <path
            d={travelled}
            fill="none"
            stroke={`var(--status-${status})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ transition: 'stroke 400ms ease' }}
          />
        )}
        {/* Drawn last so the marker sits on top of the line rather than under
            it, and so the coloured stroke never crosses over the dot. */}
        <circle
          cx={x(weeks)}
          cy={y(retention)}
          r="4.5"
          fill={`var(--status-${status})`}
          stroke="var(--surface)"
          strokeWidth="2"
        />
      </svg>

      <label htmlFor={id} className="mt-4 block text-[12.5px] font-medium" style={{ color: 'var(--text-body)' }}>
        Untouched for{' '}
        <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
          {weeks} {weeks === 1 ? 'week' : 'weeks'}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={9}
        value={weeks}
        onChange={(e) => setWeeks(Number(e.target.value))}
        className="slider mt-2.5"
      />

      <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Nothing else takes a green tick away from you. Forgetting happens whether an app admits
        it or not.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------- plan demo */

/**
 * Minutes are per subtopic, and they differ.
 *
 * The planner used eight minutes for everything, which is not how long
 * anything takes: eight minutes is a short quiz, not working through a
 * subtopic you are weak on. Something you have never been tested on needs
 * reading before it needs testing, and something merely fading needs a retest
 * rather than relearning, so the estimates are not uniform either.
 */
const QUEUE = [
  { t: 'Circular motion and gravitation', why: 'Weak, needs work', tone: 'weak', m: 35 },
  { t: 'Complex numbers', why: 'Weak, needs work', tone: 'weak', m: 35 },
  { t: 'Wave characteristics', why: 'Fading, last proved 18 days ago', tone: 'fading', m: 15 },
  { t: 'Price elasticity of demand', why: 'Developing, not secure yet', tone: 'developing', m: 25 },
  { t: 'Thermal concepts', why: 'Not tested yet', tone: 'untested', m: 40 },
  { t: 'Momentum and impulse', why: 'Developing, not secure yet', tone: 'developing', m: 25 },
  { t: 'Standing waves', why: 'Nearly there, a few more points', tone: 'proficient', m: 15 },
  { t: 'Radioactive decay', why: 'Not tested yet', tone: 'untested', m: 40 },
]

/** How long have you got. The list is the answer, and it is ordered. */
export function PlanDemo() {
  const [minutes, setMinutes] = useState(90)
  const id = useId()

  // Fill the session with whatever fits, in order, rather than by a flat rate.
  const items = []
  let left = minutes
  for (const q of QUEUE) {
    if (q.m > left) continue
    items.push(q)
    left -= q.m
  }
  if (!items.length) items.push(QUEUE[2])
  const used = items.reduce((sum, q) => sum + q.m, 0)

  return (
    <div
      className="rounded-2xl border p-6 md:p-7"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="block text-[13px] font-medium" style={{ color: 'var(--text-body)' }}>
          I have{' '}
          <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
            {minutes >= 60
              ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
              : `${minutes} min`}
          </span>{' '}
          tonight
        </label>
        <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {used} min planned
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={15}
        max={240}
        step={15}
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        className="slider mt-3"
      />

      <ul className="mt-6 flex flex-col">
        {items.map((q, i) => (
          <li
            key={q.t}
            className="flex items-center gap-3 border-t py-3 first:border-t-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="w-5 shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {i + 1}
            </span>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--status-${q.tone})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{q.t}</span>
              <span className="block text-[12.5px]" style={{ color: 'var(--text-muted)' }}>{q.why}</span>
            </span>
            <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {q.m} min
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Ordered by what you got wrong, what is fading, and which foundations unlock later
        topics. Every line says why it is there, so you can disagree with it.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ accordion */

/** FAQ that is closed until asked. Twelve paragraphs on screen is a wall. */
export function Faq({ items }) {
  const [open, setOpen] = useState(0)

  return (
    <ul className="flex flex-col">
      {items.map(({ q, a }, i) => {
        const isOpen = open === i
        return (
          <li key={q} className="border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 py-5 text-left"
            >
              <span className="flex-1 text-[16px] font-semibold leading-snug tracking-[-0.013em]">
                {q}
              </span>
              <span
                className="shrink-0 transition-transform duration-200"
                style={{ transform: isOpen ? 'rotate(45deg)' : 'none', color: 'var(--text-muted)' }}
                aria-hidden="true"
              >
                <IconClose width={16} height={16} />
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <p
                className="overflow-hidden text-[14.5px] leading-[1.7]"
                style={{ color: 'var(--text-body)' }}
              >
                <span className="block pb-6 pr-10">{a}</span>
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export { IconArrowRight }
