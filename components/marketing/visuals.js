'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView } from './scroll'

/**
 * Drawings for the pages you reach from the bar.
 *
 * Those pages were paragraphs. Every one of them explained in prose something
 * that is faster to look at than to read — a code going out to a year group, a
 * plan that reorders itself, six subjects and two years. A page made entirely
 * of sentences asks the reader to build the picture themselves, and most of
 * them will not bother.
 *
 * Same vocabulary as the feature graphics: cells, bars, rings, rows, one
 * accent colour, nothing looping. They draw once when you reach them and then
 * hold still, because a page that keeps moving after you have arrived is
 * competing with its own text.
 */

/* ------------------------------------------------------------------ shared */

function useSeen(threshold = 0.35) {
  return useInView({ threshold })
}

/** The frame everything here sits in, so the pages share one silhouette. */
export function Panel({ children, className = '', ...rest }) {
  return (
    <div
      className={`elev rounded-[14px] border p-6 ${className}`}
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      {...rest}
    >
      {children}
    </div>
  )
}

export function Eyebrow({ children }) {
  return (
    <p
      className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: 'var(--text-faint)' }}
    >
      {children}
    </p>
  )
}

/* ----------------------------------------------------- one code, many seats */

/**
 * A code going out to a year group.
 *
 * The schools page said "one code opens it for the whole year group" three
 * different ways. This is the sentence.
 */
export function CodeFanout({ seats = 24 }) {
  const [ref, seen] = useSeen(0.4)
  return (
    <Panel>
      <Eyebrow>One code</Eyebrow>
      <div
        className="mt-4 inline-flex items-center rounded-[8px] border px-3 py-2 font-mono text-[15px] font-semibold tracking-[0.22em]"
        style={{
          borderColor: 'var(--brand)',
          color: 'var(--brand)',
          background: 'var(--brand-tint)',
        }}
      >
        ABA-26
      </div>

      <div ref={ref} className="mt-6 grid grid-cols-8 gap-2">
        {Array.from({ length: seats }, (_, i) => (
          <span
            key={i}
            className="aspect-square rounded-full"
            style={{
              background: 'var(--brand)',
              opacity: seen ? 0.85 : 0,
              transform: seen ? 'none' : 'scale(0.4)',
              transition: `all 380ms cubic-bezier(0.16,1,0.3,1) ${i * 34}ms`,
            }}
          />
        ))}
      </div>
      <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        Each student types it once. The limit is the size of the group, so it cannot quietly
        become a public unlock.
      </p>
    </Panel>
  )
}

/* ------------------------------------------------------- nobody is watching */

/**
 * What a teacher sees, which is nothing.
 *
 * The page asserted this in a list. Drawn, it is one image: a class, and no
 * way to open any of it.
 */
export function NoDashboard() {
  const [ref, seen] = useSeen(0.4)
  return (
    <Panel>
      <Eyebrow>What a teacher sees</Eyebrow>
      <div ref={ref} className="relative mt-4 overflow-hidden rounded-[8px]">
        <div className="flex flex-col gap-1.5" style={{ filter: 'blur(3.5px)', opacity: 0.45 }}>
          {['A. Rahman', 'C. Okafor', 'D. Silva', 'E. Haddad'].map((n, i) => (
            <div
              key={n}
              className="flex items-center justify-between rounded-[6px] border px-3 py-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-[11.5px]">{n}</span>
              <span className="flex gap-1">
                {['mastered', 'weak', 'proficient', 'developing'].map((t, j) => (
                  <span
                    key={j}
                    className="h-2 w-5 rounded-full"
                    style={{ background: `var(--status-${(i + j) % 2 ? t : 'untested'})` }}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: 'color-mix(in oklab, var(--surface) 72%, transparent)',
            opacity: seen ? 1 : 0,
            transition: 'opacity 500ms ease 220ms',
          }}
        >
          <span
            className="rounded-full border px-4 py-2 text-[12px] font-medium"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            Does not exist
          </span>
        </div>
      </div>
      <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        No teacher account, no class dashboard, no export of who is behind. On every plan.
      </p>
    </Panel>
  )
}

/* --------------------------------------------------------- the three steps */

/** A rollout, as three states rather than three paragraphs. */
export function RolloutTrack({ steps }) {
  const [ref, seen] = useSeen(0.3)
  return (
    <div ref={ref} className="grid gap-3 md:grid-cols-3">
      {steps.map(([term, detail], i) => (
        <div
          key={term}
          className="elev relative overflow-hidden rounded-[14px] border p-5"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--surface)',
            opacity: seen ? 1 : 0,
            transform: seen ? 'none' : 'translateY(10px)',
            transition: `all 460ms cubic-bezier(0.16,1,0.3,1) ${i * 130}ms`,
          }}
        >
          <span
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: 'var(--brand)',
              transformOrigin: 'left',
              transform: seen ? 'scaleX(1)' : 'scaleX(0)',
              transition: `transform 620ms cubic-bezier(0.16,1,0.3,1) ${i * 130 + 200}ms`,
            }}
          />
          <p className="text-[11px] font-semibold tabular-nums tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
            {String(i + 1).padStart(2, '0')}
          </p>
          <p className="mt-3 text-[15px] font-semibold tracking-[-0.015em]">{term}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {detail}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------ coverage, as a bar */

/** Three curricula as one bar, so the split is a shape rather than a list. */
export function CoverageBar({ parts }) {
  const [ref, seen] = useSeen(0.5)
  const total = parts.reduce((n, p) => n + p.value, 0)
  return (
    <div ref={ref}>
      <div
        className="flex h-3 overflow-hidden rounded-full"
        style={{ background: 'var(--surface-sunken)' }}
      >
        {parts.map((p, i) => (
          <span
            key={p.label}
            className="block h-full"
            style={{
              width: `${(p.value / total) * 100}%`,
              background: p.tone,
              transformOrigin: 'left',
              transform: seen ? 'scaleX(1)' : 'scaleX(0)',
              transition: `transform 760ms cubic-bezier(0.16,1,0.3,1) ${i * 150}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.tone }} />
            <span className="text-[13px] font-medium">{p.label}</span>
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {p.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- course search */

/**
 * Find your course.
 *
 * A page listing 128 courses in twenty boxes is a page you scan with your
 * finger. One field, filtering as you type, answers the only question anybody
 * brings to it — is mine in here — in about a second.
 */
export function CourseFinder({ curricula }) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()

  const all = useMemo(
    () =>
      curricula.flatMap(({ id, groups }) =>
        groups.flatMap((g) => g.courses.map((c) => ({ ...c, curriculum: id, group: g.name })))
      ),
    [curricula]
  )

  const hits = term ? all.filter((c) => c.course.toLowerCase().includes(term)).slice(0, 12) : []

  return (
    <div>
      <label className="sr-only" htmlFor="course-finder">
        Search courses
      </label>
      <input
        id="course-finder"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find your course: try physics, history, spanish…"
        className="input w-full"
        autoComplete="off"
      />

      {term && (
        <div
          className="elev-lg mt-3 overflow-hidden rounded-[12px] border"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          {hits.length === 0 ? (
            <p className="px-4 py-4 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              Nothing matching “{q.trim()}”. Tell us the course and the board and it goes on the
              list.
            </p>
          ) : (
            hits.map((c) => (
              <div
                key={`${c.curriculum}-${c.course}`}
                className="flex items-baseline justify-between gap-4 border-b px-4 py-2.5 last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="min-w-0 text-[13.5px]">{c.course}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {c.levels.length > 0 && (
                    <span className="text-[10.5px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                      {c.levels.join(' · ')}
                    </span>
                  )}
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
                  >
                    {c.curriculum}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------- the six-subject me */

/** The about page's opening fact, as a shape: six subjects, two years. */
export function SubjectLoad({ subjects }) {
  const [ref, seen] = useSeen(0.4)
  return (
    <Panel>
      <Eyebrow>What I am carrying</Eyebrow>
      <div ref={ref} className="mt-4 flex flex-wrap gap-2">
        {subjects.map(([name, level], i) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px]"
            style={{
              borderColor: 'var(--border-strong)',
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateY(6px)',
              transition: `all 380ms cubic-bezier(0.16,1,0.3,1) ${i * 70}ms`,
            }}
          >
            {name}
            <span
              className="rounded-full px-1.5 text-[10px] font-semibold"
              style={{
                background: level === 'HL' ? 'var(--brand-tint)' : 'var(--surface-sunken)',
                color: level === 'HL' ? 'var(--brand)' : 'var(--text-faint)',
              }}
            >
              {level}
            </span>
          </span>
        ))}
      </div>
    </Panel>
  )
}

/* --------------------------------------------------- eight at once vs sorted */

/**
 * The evening the product exists to fix.
 *
 * Left: everything you could study, undifferentiated, which is what an
 * eight o'clock start actually looks like. Right: the same list with an order
 * and a reason. Two columns say it in one glance.
 */
export function PickOrPlan() {
  const [ref, seen] = useSeen(0.35)
  const rows = [
    ['Complex numbers', 'weak', 'you got 3 of 10 wrong'],
    ['Wave characteristics', 'fading', 'proved 18 days ago'],
    ['Market failure', 'developing', 'unlocks 4 later topics'],
    ['Cell respiration', 'proficient', 'holding'],
    ['Nuclear physics', 'untested', 'never tested'],
  ]
  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-2">
      <Panel>
        <Eyebrow>Without this</Eyebrow>
        <div className="mt-4 flex flex-col gap-2">
          {rows.map(([name]) => (
            <div
              key={name}
              className="rounded-[6px] border px-3 py-2 text-[12.5px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {name}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          Pick whichever feels worst and hope.
        </p>
      </Panel>

      <Panel>
        <Eyebrow>With it</Eyebrow>
        <div className="mt-4 flex flex-col gap-2">
          {[...rows]
            .sort((a, b) => ['weak', 'fading', 'developing', 'untested', 'proficient'].indexOf(a[1]) -
              ['weak', 'fading', 'developing', 'untested', 'proficient'].indexOf(b[1]))
            .map(([name, tone, why], i) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 rounded-[6px] border px-3 py-2"
                style={{
                  borderColor: 'var(--border-strong)',
                  opacity: seen ? 1 : 0,
                  transform: seen ? 'none' : 'translateX(-10px)',
                  transition: `all 420ms cubic-bezier(0.16,1,0.3,1) ${i * 90}ms`,
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--status-${tone})` }} />
                  <span className="truncate text-[12.5px]">{name}</span>
                </span>
                <span className="shrink-0 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
                  {why}
                </span>
              </div>
            ))}
        </div>
        <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          Ordered, with a reason on every line so you can disagree with it.
        </p>
      </Panel>
    </div>
  )
}

/* -------------------------------------------------------- price, as a shape */

/** What a year costs next to the things a student already buys. */
export function PriceCompare({ items }) {
  const [ref, seen] = useSeen(0.4)
  const max = Math.max(...items.map((i) => i.value))
  return (
    <div ref={ref} className="flex flex-col gap-3">
      {items.map(({ label, value, note, ours }, i) => (
        <div key={label} className="flex items-center gap-4">
          <span className="w-36 shrink-0 text-[13px]" style={{ color: ours ? 'var(--text)' : 'var(--text-muted)' }}>
            {label}
          </span>
          <span className="h-7 flex-1 overflow-hidden rounded-[5px]" style={{ background: 'var(--surface-sunken)' }}>
            <span
              className="flex h-full items-center justify-end rounded-[5px] px-2.5"
              style={{
                width: seen ? `${Math.max(12, (value / max) * 100)}%` : 0,
                background: ours ? 'var(--brand-solid)' : 'var(--border-strong)',
                transition: `width 780ms cubic-bezier(0.16,1,0.3,1) ${i * 120}ms`,
              }}
            >
              <span
                className="text-[12px] font-semibold tabular-nums"
                style={{ color: ours ? '#fff' : 'var(--text-body)' }}
              >
                ${value}
              </span>
            </span>
          </span>
          <span className="hidden w-40 shrink-0 text-[11.5px] sm:block" style={{ color: 'var(--text-faint)' }}>
            {note}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- a live count */

/**
 * A number that counts up when you reach it.
 *
 * CountUp in scroll.js does this already; this wraps it with the label
 * underneath so the pages stop rebuilding the same three-line block.
 */
export function StatRow({ stats }) {
  const ref = useRef(null)
  return (
    <div ref={ref} className="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-4">
      {stats.map(({ value, suffix, label }) => (
        <div key={label}>
          <p className="text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-none tracking-[-0.03em]">
            <Counter to={value} suffix={suffix} />
          </p>
          <p className="mt-2.5 text-[13px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  )
}

function Counter({ to, suffix = '' }) {
  const [ref, seen] = useSeen(0.5)
  const [n, setN] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    if (!seen) return
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900)
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [seen, to])

  return (
    <span ref={ref} className="tabular-nums">
      {seen ? n : 0}
      {suffix}
    </span>
  )
}

/* ------------------------------------------------- a subject, broken down */

/**
 * What "mapped topic by topic" actually means.
 *
 * The subjects page says it in four words and everybody nods without picturing
 * it. Drawn, it is obvious: a course opens into topics, a topic opens into the
 * things you are actually tested on, and the last level is where a colour goes.
 */
export function SyllabusTree() {
  const [ref, seen] = useSeen(0.4)
  const rows = [
    { depth: 0, text: 'Physics HL', note: '11 topics' },
    { depth: 1, text: 'Topic 6: Circular motion and gravitation', note: '4 subtopics' },
    { depth: 2, text: '6.1  Circular motion', tone: 'proficient' },
    { depth: 2, text: '6.2  Newton’s law of gravitation', tone: 'weak' },
    { depth: 2, text: '6.3  Orbital motion', tone: 'untested' },
    { depth: 2, text: '6.4  Gravitational fields', tone: 'fading' },
  ]
  return (
    <Panel>
      <Eyebrow>One subject, opened up</Eyebrow>
      <div ref={ref} className="mt-4 flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div
            key={r.text}
            className="flex items-center gap-2.5 rounded-[6px] py-1.5"
            style={{
              paddingLeft: r.depth * 18,
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateX(-10px)',
              transition: `all 400ms cubic-bezier(0.16,1,0.3,1) ${i * 90}ms`,
            }}
          >
            {r.depth > 0 && (
              <span
                className="h-px shrink-0"
                style={{ width: 10, background: 'var(--border-strong)' }}
              />
            )}
            {r.tone ? (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: `var(--status-${r.tone})` }}
              />
            ) : (
              <span className="h-2.5 w-2.5 shrink-0" />
            )}
            <span
              className="min-w-0 truncate"
              style={{
                fontSize: r.depth === 0 ? 14 : 12.5,
                fontWeight: r.depth === 0 ? 600 : 400,
                color: r.depth === 2 ? 'var(--text-body)' : 'var(--text)',
              }}
            >
              {r.text}
            </span>
            {r.note && (
              <span className="ml-auto shrink-0 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                {r.note}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        The colour goes on the bottom level, because that is the size of thing a question can
        actually prove.
      </p>
    </Panel>
  )
}

/* ------------------------------------------------------------ five levels */

/**
 * The ladder, as a ladder.
 *
 * "Five levels" appears on nearly every page and is spelled out on none of
 * them. Each rung says what it takes to get there and what takes it away.
 */
const LEVELS = [
  ['Untested', 'untested', 'No questions yet. Grey rather than green, because it is the absence of a level.'],
  ['Weak', 'weak', 'You got more wrong than right. Top of tonight’s plan.'],
  ['Developing', 'developing', 'Getting there. Still comes round often.'],
  ['Proficient', 'proficient', 'Right more often than not, across more than one sitting.'],
  ['Mastered', 'mastered', 'Right consistently, on hard questions. Only time moves it now.'],
  ['Fading', 'fading', 'Was proved, then left two weeks. Back for a short retest.'],
]

export function LevelLadder() {
  const [ref, seen] = useSeen(0.25)
  return (
    <div ref={ref} className="flex flex-col gap-2">
      {LEVELS.map(([name, tone, detail], i) => (
        <div
          key={name}
          className="elev flex items-start gap-4 rounded-[12px] border p-4"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--surface)',
            opacity: seen ? 1 : 0,
            transform: seen ? 'none' : 'translateY(10px)',
            transition: `all 440ms cubic-bezier(0.16,1,0.3,1) ${i * 80}ms`,
          }}
        >
          <span
            className="mt-[3px] h-4 w-4 shrink-0 rounded-[4px]"
            style={{ background: `var(--status-${tone})` }}
          />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold tracking-[-0.01em]">{name}</p>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {detail}
            </p>
          </div>
          <span
            className="ml-auto hidden shrink-0 self-center sm:block"
            style={{ width: 92 }}
            aria-hidden="true"
          >
            <span
              className="block h-1.5 rounded-full"
              style={{
                background: `var(--status-${tone})`,
                transformOrigin: 'left',
                transform: seen ? `scaleX(${[0.04, 0.22, 0.45, 0.72, 1, 0.58][i]})` : 'scaleX(0)',
                transition: `transform 700ms cubic-bezier(0.16,1,0.3,1) ${i * 80 + 160}ms`,
              }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------- a question, marked */

/**
 * What one wrong answer actually does.
 *
 * Four states in a row: the question, the answer, what it says about the
 * mistake, and where the subtopic ends up. The whole product is this loop, and
 * it had never been drawn anywhere.
 */
export function MarkingWalk() {
  const [ref, seen] = useSeen(0.35)
  const steps = [
    { k: 'Question', v: 'A satellite’s orbital radius doubles. Its speed…', tone: null },
    { k: 'You answer', v: 'halves', tone: 'weak' },
    { k: 'Marked', v: 'No. It falls by √2. You used v ∝ 1/r rather than v ∝ 1/√r.', tone: null },
    { k: 'Subtopic moves', v: '6.3 Orbital motion → Weak, and into the mistake bank', tone: 'weak' },
  ]
  return (
    <Panel>
      <Eyebrow>One question, end to end</Eyebrow>
      <div ref={ref} className="mt-5 flex flex-col gap-3">
        {steps.map((s, i) => (
          <div
            key={s.k}
            className="flex gap-3"
            style={{
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateY(8px)',
              transition: `all 420ms cubic-bezier(0.16,1,0.3,1) ${i * 220}ms`,
            }}
          >
            <span className="flex flex-col items-center">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.tone ? `var(--status-${s.tone})` : 'var(--border-strong)' }}
              />
              {i < steps.length - 1 && (
                <span className="mt-1 w-px flex-1" style={{ background: 'var(--border)' }} />
              )}
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
                {s.k}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                {s.v}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
        It names the mistake rather than marking it wrong and moving on. That is the difference
        between a score and a diagnosis.
      </p>
    </Panel>
  )
}

/* --------------------------------------------------- forty minutes, spent */

/**
 * Tonight, as a bar you can read in one look.
 *
 * "Tell it how long you have and it builds a session" is the planner's whole
 * pitch, and prose makes it sound like a to-do list. Drawn to scale, it is
 * obviously a plan: forty minutes, cut up, with the worst thing first.
 */
export function SessionBar({ minutes = 40 }) {
  const [ref, seen] = useSeen(0.45)
  const blocks = [
    ['Complex numbers', 15, 'weak'],
    ['Wave characteristics', 10, 'fading'],
    ['Market failure', 10, 'developing'],
    ['Review', 5, 'proficient'],
  ]
  return (
    <Panel>
      <div className="flex items-baseline justify-between">
        <Eyebrow>Tonight</Eyebrow>
        <span className="text-[13px] font-semibold tabular-nums">{minutes} min</span>
      </div>

      <div ref={ref} className="mt-4 flex h-9 overflow-hidden rounded-[6px]" style={{ background: 'var(--surface-sunken)' }}>
        {blocks.map(([name, mins, tone], i) => (
          <span
            key={name}
            title={`${name} · ${mins} min`}
            className="block h-full"
            style={{
              width: `${(mins / minutes) * 100}%`,
              background: `var(--status-${tone})`,
              opacity: seen ? 0.9 : 0,
              transform: seen ? 'none' : 'scaleX(0.2)',
              transformOrigin: 'left',
              transition: `all 560ms cubic-bezier(0.16,1,0.3,1) ${i * 130}ms`,
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {blocks.map(([name, mins, tone]) => (
          <div key={name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--status-${tone})` }} />
              <span className="truncate text-[12.5px]">{name}</span>
            </span>
            <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {mins} min
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
