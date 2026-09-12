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

const SUBTOPIC_NAMES = [
  'Motion in a straight line', 'Forces and free-body diagrams', 'Work, energy and power',
  'Momentum and impulse', 'Circular motion', 'Gravitational fields', 'Thermal concepts',
  'Modelling a gas', 'Simple harmonic motion', 'Wave characteristics', 'Wave behaviour',
  'Standing waves', 'Electric fields', 'Electric current', 'Resistance and circuits',
  'Magnetic effects', 'Electromagnetic induction', 'Nuclear structure', 'Radioactive decay',
  'Energy production',
]

const STATUS_LABEL = {
  weak: 'Weak',
  developing: 'Developing',
  proficient: 'Proficient',
  mastered: 'Mastered',
  fading: 'Fading',
  untested: 'Not tested yet',
}

function buildCells(cols, rows) {
  const noise = (i) => (((i + 1) * 2654435761) >>> 8) % 1000
  const out = []
  for (let i = 0; i < cols * rows; i++) {
    const through = Math.floor(i / cols) / (rows - 1)
    const r = noise(i) / 1000
    const untestedChance = 0.08 + through * 0.62
    if (r < untestedChance) out.push('untested')
    else {
      const q = (r - untestedChance) / (1 - untestedChance)
      const skill = q * 0.55 + (1 - through) * 0.45
      out.push(
        skill > 0.78 ? 'mastered'
        : skill > 0.54 ? 'proficient'
        : skill > 0.32 ? 'developing'
        : skill > 0.14 ? 'weak'
        : 'fading'
      )
    }
  }
  return out
}

/**
 * Hoverable. The header becomes a readout, so moving across the grid reads the
 * map rather than just looking at it, and the point of the colours explains
 * itself without a paragraph saying what they mean.
 */
export function Heatmap({ cols = 12, rows = 8, readout = true }) {
  const cells = useMemo(() => buildCells(cols, rows), [cols, rows])
  const [at, setAt] = useState(null)

  return (
    <div>
      {readout && (
        <div className="mb-4 flex min-h-[34px] items-baseline justify-between gap-4">
          {at === null ? (
            <>
              <p className="text-[13px] font-semibold">Physics SL</p>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                {cols * rows} subtopics · hover one
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-[13px] font-semibold">
                {SUBTOPIC_NAMES[at % SUBTOPIC_NAMES.length]}
              </p>
              <p
                className="shrink-0 text-[12px] font-medium"
                style={{ color: `var(--${cells[at]})` }}
              >
                {STATUS_LABEL[cells[at]]}
              </p>
            </>
          )}
        </div>
      )}

      <div
        className="grid gap-[5px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        onMouseLeave={() => setAt(null)}
      >
        {cells.map((s, i) => (
          <button
            key={i}
            onMouseEnter={() => setAt(i)}
            onFocus={() => setAt(i)}
            aria-label={`${SUBTOPIC_NAMES[i % SUBTOPIC_NAMES.length]}: ${STATUS_LABEL[s]}`}
            className="cell aspect-square rounded-[3px] transition-transform duration-100 hover:scale-[1.18]"
            style={{
              background: `var(--${s})`,
              animationDelay: `${200 + (i % cols) * 26 + Math.floor(i / cols) * 46}ms`,
              outline: at === i ? '2px solid var(--text)' : 'none',
              outlineOffset: '1px',
            }}
          />
        ))}
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
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
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
                borderColor: tone ? `var(--${tone})` : 'var(--border-strong)',
                background: tone ? `color-mix(in oklab, var(--${tone}) 12%, transparent)` : 'transparent',
              }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
                style={{ borderColor: tone ? `var(--${tone})` : 'var(--border-strong)', color: tone ? `var(--${tone})` : 'var(--muted)' }}
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
            <p className="text-[13.5px]" style={{ color: 'var(--body)' }}>
              <span className="font-semibold">Hint. </span>
              {DEMO.hint}
            </p>
          ) : (
            <button
              onClick={() => setShowHint(true)}
              className="text-[13px] font-medium underline underline-offset-2"
              style={{ color: 'var(--muted)' }}
            >
              Show a hint
            </button>
          )}
        </div>
      )}

      {answered && (
        <div className="rise mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          {!right && chosen?.why && (
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--weak)' }}>
              <span className="font-semibold">You picked {picked.toUpperCase()}. </span>
              {chosen.why}
            </p>
          )}
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--body)' }}>
            {DEMO.working}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-[200px] flex-1">
              <div className="mb-2 flex items-baseline justify-between text-[12.5px]">
                <span style={{ color: 'var(--muted)' }}>Mastery of this subtopic</span>
                <span className="font-semibold tabular-nums">{after.toFixed(2)} / 10</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--sunken)' }}>
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${after * 10}%`, background: 'var(--proficient)' }}
                />
              </div>
              <p className="mt-2 text-[12.5px]" style={{ color: 'var(--faint)' }}>
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
              style={{ borderColor: 'var(--border-strong)', color: 'var(--body)' }}
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
  const status = weeks < 2 ? 'mastered' : 'fading'
  const label = weeks < 2 ? 'Mastered' : 'Fading'

  const W = 300
  const H = 96
  const x = (w) => 8 + (w / 9) * (W - 16)
  const y = (r) => H - 12 - r * (H - 26)
  const path = Array.from({ length: 46 }, (_, i) => {
    const w = (i / 45) * 9
    return `${i === 0 ? 'M' : 'L'}${x(w).toFixed(1)},${y(Math.exp(-0.34 * w)).toFixed(1)}`
  }).join(' ')

  return (
    <div
      className="rounded-[12px] border p-6 md:p-7"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <div className="flex items-center gap-4">
        <span
          className="h-12 w-12 shrink-0 rounded-[8px] transition-colors duration-400"
          style={{ background: `var(--${status})` }}
        />
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold">Wave characteristics</p>
          <p
            className="text-[12.5px] font-medium transition-colors duration-400"
            style={{ color: `var(--${status})` }}
          >
            {label}
            {weeks >= 2 && ' · back in your plan'}
          </p>
        </div>
        <span className="ml-auto shrink-0 text-right">
          <span className="block text-[19px] font-semibold tabular-nums">{pct}%</span>
          <span className="block text-[10.5px]" style={{ color: 'var(--faint)' }}>
            retained
          </span>
        </span>
      </div>

      {/* The curve, with a marker that tracks the slider. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-5 w-full" role="img" aria-label={`Retention after ${weeks} weeks: about ${pct}%`}>
        <line x1="8" x2={W - 8} y1={y(0)} y2={y(0)} stroke="var(--border)" />
        <path d={path} fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
        <path
          d={path}
          fill="none"
          stroke={`var(--${status})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            strokeDasharray: 400,
            strokeDashoffset: 400 - (weeks / 9) * 400,
            transition: 'stroke-dashoffset 220ms linear, stroke 400ms ease',
          }}
        />
        <circle
          cx={x(weeks)}
          cy={y(retention)}
          r="4.5"
          fill={`var(--${status})`}
          style={{ transition: 'all 220ms linear' }}
        />
      </svg>

      <label htmlFor={id} className="mt-4 block text-[12.5px] font-medium" style={{ color: 'var(--body)' }}>
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
        className="mt-2.5 w-full"
        style={{ accentColor: 'var(--brand)' }}
      />

      <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--faint)' }}>
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
        <label htmlFor={id} className="block text-[13px] font-medium" style={{ color: 'var(--body)' }}>
          I have{' '}
          <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
            {minutes >= 60
              ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
              : `${minutes} min`}
          </span>{' '}
          tonight
        </label>
        <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--faint)' }}>
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
        className="mt-3 w-full"
        style={{ accentColor: 'var(--brand)' }}
      />

      <ul className="mt-6 flex flex-col">
        {items.map((q, i) => (
          <li
            key={q.t}
            className="flex items-center gap-3 border-t py-3 first:border-t-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="w-5 shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: 'var(--faint)' }}>
              {i + 1}
            </span>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--${q.tone})` }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{q.t}</span>
              <span className="block text-[12.5px]" style={{ color: 'var(--muted)' }}>{q.why}</span>
            </span>
            <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--faint)' }}>
              {q.m} min
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--faint)' }}>
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
                style={{ transform: isOpen ? 'rotate(45deg)' : 'none', color: 'var(--muted)' }}
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
                style={{ color: 'var(--body)' }}
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
