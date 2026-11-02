'use client'

import { useMemo, useState } from 'react'

/**
 * Progress over the last twelve weeks, in two plain charts.
 *
 *   Lines   subtopics tested and subtopics proved, to date, each week. A
 *           subtopic counts as tested from its first quiz and as proved from
 *           the last time it was answered right while proved: the progress
 *           table keeps where each subtopic stands, not its whole history,
 *           so these are the best dates there are.
 *   Bars    questions answered each week, with how many were right.
 *
 * Every number is written on the chart, not left to a tooltip.
 *
 * items: subtopics with { status, testedAt, provedAt } (ms or null).
 * attempts: quizzes with { created_at, total_questions, score }.
 */

const WEEKS = 12
const DAY = 86400000
const PROVED = new Set(['proficient', 'mastered'])

/** The Monday a date's week starts on, at midnight. */
function weekStart(t) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

const short = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export default function ProgressOverTime({ items, attempts, now }) {
  const [hover, setHover] = useState(null)

  const weeks = useMemo(() => {
    const first = weekStart(now) - (WEEKS - 1) * 7 * DAY
    return Array.from({ length: WEEKS }, (_, i) => {
      const from = first + i * 7 * DAY
      const to = from + 7 * DAY
      const inWeek = attempts.filter((a) => {
        const t = new Date(a.created_at).getTime()
        return t >= from && t < to
      })
      const asked = inWeek.reduce((n, a) => n + (a.total_questions || 0), 0)
      const right = inWeek.reduce((n, a) => n + (a.score || 0), 0)
      return {
        from,
        tested: items.filter((r) => r.status !== 'not_started' && r.testedAt != null && r.testedAt < to).length,
        proved: items.filter((r) => PROVED.has(r.status) && r.provedAt != null && r.provedAt < to).length,
        asked,
        right,
      }
    })
  }, [items, attempts, now])

  const last = weeks.at(-1)
  const prev = weeks.at(-2)
  const top = Math.max(4, ...weeks.map((w) => w.tested))
  const step = top <= 10 ? 2 : top <= 40 ? 10 : top <= 100 ? 25 : top <= 250 ? 50 : 100
  const yMax = Math.ceil(top / step) * step
  const maxAsked = Math.max(1, ...weeks.map((w) => w.asked))

  const W = 640
  const H = 190
  const L = 34
  const R = 46
  const T = 12
  const B = 22
  const x = (i) => L + (i / (WEEKS - 1)) * (W - L - R)
  const y = (v) => T + (1 - v / yMax) * (H - T - B)
  const path = (key) => weeks.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w[key]).toFixed(1)}`).join(' ')

  const pct = last.asked ? Math.round((last.right / last.asked) * 100) : null
  const change = last.asked - prev.asked

  return (
    <div>
      {/* This week, in words and numbers, before any chart. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          ['This week', last.asked ? `${last.asked}` : '0', last.asked ? `questions${change ? `, ${change > 0 ? '+' : ''}${change} on last week` : ''}` : 'questions so far'],
          ['Right', pct == null ? '–' : `${pct}%`, pct == null ? 'no quizzes yet' : `${last.right} of ${last.asked}`],
          ['Proved', `${last.proved}`, `${last.proved - weeks[0].proved >= 0 ? '+' : ''}${last.proved - weeks[0].proved} in 12 weeks`],
        ].map(([label, big, small]) => (
          <div key={label} className="rounded-[12px] px-3 py-2.5" style={{ background: 'var(--surface-sunken)' }}>
            <p className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>
              {label}
            </p>
            <p className="mt-0.5 text-[22px] font-semibold leading-tight tracking-[-0.02em]" style={{ fontVariantNumeric: 'proportional-nums' }}>
              {big}
            </p>
            <p className="truncate text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              {small}
            </p>
          </div>
        ))}
      </div>

      {/* Tested and proved, to date. */}
      <div className="mt-5 flex items-center gap-4 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: 'color-mix(in oklab, var(--brand) 40%, var(--border-strong))' }} />
          Subtopics tested
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: 'var(--brand)' }} />
          Subtopics proved
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" role="img" aria-label={`Over 12 weeks: ${last.tested} subtopics tested and ${last.proved} proved so far.`}>
        {Array.from({ length: yMax / step + 1 }, (_, k) => k * step).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={v ? '3 5' : undefined} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
              {v}
            </text>
          </g>
        ))}
        <path d={`${path('tested')} L${x(WEEKS - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--brand)" opacity="0.07" />
        <path d={path('tested')} fill="none" stroke="color-mix(in oklab, var(--brand) 40%, var(--border-strong))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path('proved')} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* The numbers now, at the end of each line. */}
        <text x={x(WEEKS - 1) + 8} y={y(last.tested) + 4} fontSize="12" fontWeight="600" fill="var(--text-muted)">
          {last.tested}
        </text>
        <text x={x(WEEKS - 1) + 8} y={Math.max(y(last.proved) + 4, y(last.tested) + 18)} fontSize="12" fontWeight="600" fill="var(--brand)">
          {last.proved}
        </text>
        {weeks.map((w, i) =>
          i % 2 === 1 || i === WEEKS - 1 ? (
            <text key={w.from} x={x(i)} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--text-faint)">
              {i === WEEKS - 1 ? 'This week' : short(w.from)}
            </text>
          ) : null
        )}
      </svg>

      {/* Questions answered each week. */}
      <p className="mt-4 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
        Questions answered each week
      </p>
      <div className="mt-2 flex h-24 items-end gap-1.5">
        {weeks.map((w, i) => (
          <div
            key={w.from}
            className="relative flex h-full flex-1 flex-col items-center justify-end"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            {w.asked > 0 && (
              <span className="mb-1 text-[10.5px] font-semibold tabular-nums" style={{ color: hover === i ? 'var(--text)' : 'var(--text-muted)' }}>
                {w.asked}
              </span>
            )}
            <span className="flex w-full flex-col justify-end overflow-hidden rounded-t-[4px]" style={{ height: `${Math.max(w.asked ? 6 : 2, (w.asked / maxAsked) * 64)}px`, background: w.asked ? 'color-mix(in oklab, var(--brand) 18%, var(--surface-sunken))' : 'var(--border)' }}>
              <span className="block w-full" style={{ height: `${w.asked ? (w.right / w.asked) * 100 : 0}%`, background: 'var(--brand)', opacity: 0.85 }} />
            </span>
            {hover === i && w.asked > 0 && (
              <span className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                {short(w.from)}: {w.right} of {w.asked} right
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        Green is the share answered right.
      </p>
    </div>
  )
}
