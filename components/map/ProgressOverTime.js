'use client'

import { useMemo } from 'react'

/**
 * How much you have proved, week by week, over the last twelve weeks: the
 * one thing Progress tracks over time. (How much you studied, and how
 * accurately, is the Analytics page's business.)
 *
 * A subtopic counts as tested from its first quiz and as proved from the
 * last time it was answered right while proved: the progress table keeps
 * where each subtopic stands, not its whole history, so these are the best
 * dates there are. The numbers now are written at the ends of the lines.
 *
 * items: subtopics with { status, testedAt, provedAt } (ms or null).
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

export default function ProgressOverTime({ items, now }) {

  const weeks = useMemo(() => {
    const first = weekStart(now) - (WEEKS - 1) * 7 * DAY
    return Array.from({ length: WEEKS }, (_, i) => {
      const from = first + i * 7 * DAY
      const to = from + 7 * DAY
      return {
        from,
        tested: items.filter((r) => r.status !== 'not_started' && r.testedAt != null && r.testedAt < to).length,
        proved: items.filter((r) => PROVED.has(r.status) && r.provedAt != null && r.provedAt < to).length,
      }
    })
  }, [items, now])

  const last = weeks.at(-1)
  const top = Math.max(4, ...weeks.map((w) => w.tested))
  const step = top <= 10 ? 2 : top <= 40 ? 10 : top <= 100 ? 25 : top <= 250 ? 50 : 100
  const yMax = Math.ceil(top / step) * step

  const W = 640
  const H = 190
  const L = 34
  const R = 46
  const T = 12
  const B = 22
  const x = (i) => L + (i / (WEEKS - 1)) * (W - L - R)
  const y = (v) => T + (1 - v / yMax) * (H - T - B)
  const path = (key) => weeks.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(w[key]).toFixed(1)}`).join(' ')

  const gained = last.proved - weeks[0].proved

  return (
    <div>
      <p className="text-[13.5px]" style={{ color: 'var(--text-body)' }}>
        <span className="font-semibold" style={{ color: 'var(--brand)' }}>
          {gained > 0 ? `+${gained}` : gained}
        </span>{' '}
        subtopics proved in the last 12 weeks, {last.proved} in all.
      </p>

      {/* Tested and proved, to date. */}
      <div className="mt-4 flex items-center gap-4 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
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

    </div>
  )
}
