'use client'

import { useState } from 'react'
import { hm } from '@/lib/study-analytics'

/**
 * The analytics page's charts, drawn here in SVG and HTML: the product has
 * no chart library, and these are a few dozen lines each. Every one shows
 * its numbers on hover or tap, and every colour has a label beside it.
 */

/** One colour per subject, in the order subjects are listed. */
const PALETTE = [
  'oklch(0.66 0.12 155)', // green
  'oklch(0.66 0.12 250)', // blue
  'oklch(0.7 0.13 70)', // amber
  'oklch(0.64 0.14 305)', // violet
  'oklch(0.66 0.14 20)', // rose
  'oklch(0.7 0.1 195)', // teal
  'oklch(0.7 0.12 110)', // olive
  'oklch(0.62 0.08 280)', // slate blue
]
export const colourFor = (names) => {
  const map = {}
  names.forEach((n, i) => {
    map[n] = n === 'Unassigned' ? 'var(--text-faint)' : PALETTE[i % PALETTE.length]
  })
  return map
}

function Tip({ x, children }) {
  return (
    <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[10px] border px-3 py-2 text-[11.5px] shadow-xl" style={{ left: x, borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      {children}
    </div>
  )
}

/* ---------- Time, stacked by subject ---------- */

export function StackedBars({ buckets, colours, height = 220 }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...buckets.map((b) => b.total))
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const many = buckets.length > 16
  return (
    <div className="relative">
      <div className="flex" style={{ height }}>
        {/* Scale */}
        <div className="relative mr-2 w-12 shrink-0 whitespace-nowrap text-right text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {[0, 0.5, 1].map((f) => (
            <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
              {hm(top * f)}
            </span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-[3px] sm:gap-1.5">
          {[0, 0.5, 1].map((f) => (
            <span key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ top: `${(1 - f) * 100}%`, borderColor: 'var(--border)' }} />
          ))}
          {buckets.map((b, i) => (
            <div
              key={b.start}
              className="relative flex h-full flex-1 cursor-default flex-col justify-end"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <div className="flex flex-col-reverse overflow-hidden rounded-t-[5px] transition-[height] duration-500" style={{ height: `${(b.total / top) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.45 }}>
                {Object.entries(b.bySubject).map(([s, m]) => (
                  <span key={s} style={{ height: `${(m / Math.max(b.total, 1e-9)) * 100}%`, background: colours[s] }} />
                ))}
              </div>
              {hover === i && (
                <Tip x="50%">
                  <p className="mb-1 font-semibold">
                    {b.label} · {hm(b.total)}
                  </p>
                  {Object.entries(b.bySubject)
                    .sort((x, y) => y[1] - x[1])
                    .map(([s, m]) => (
                      <p key={s} className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: colours[s] }} />
                        {s} · {hm(m)}
                      </p>
                    ))}
                  {!b.total && <p style={{ color: 'var(--text-faint)' }}>Nothing studied</p>}
                </Tip>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-14 mt-2 flex gap-[3px] sm:gap-1.5">
        {buckets.map((b, i) => (
          <span key={b.start} className="relative h-3 flex-1 text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {(!many || i % Math.ceil(buckets.length / 8) === 0) && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{b.label}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

function niceStep(max) {
  for (const s of [15, 30, 60, 120, 240, 480, 960, 1920, 3840]) if (max / s <= 4) return s
  return 7680
}

/* ---------- Share by subject ---------- */

export function Donut({ items, colours, size = 176, centre }) {
  const [hover, setHover] = useState(null)
  const r = size / 2 - 14
  const c = 2 * Math.PI * r
  let at = 0
  const total = items.reduce((n, i) => n + i.minutes, 0)
  const shown = hover !== null ? items[hover] : null
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={items.map((i) => `${i.name} ${Math.round(i.share * 100)}%`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="18" />
        {total > 0 &&
          items.map((it, i) => {
            const len = (it.minutes / total) * c
            const gap = items.length > 1 ? Math.min(3, len / 3) : 0
            const el = (
              <circle
                key={it.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={colours[it.name]}
                strokeWidth={hover === i ? 22 : 18}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-at}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-width 150ms', cursor: 'default' }}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            )
            at += len
            return el
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {shown ? (
          <>
            <span className="max-w-[60%] truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {shown.name}
            </span>
            <span className="text-[20px] font-semibold tabular-nums">{Math.round(shown.share * 100)}%</span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {hm(shown.minutes)}
            </span>
          </>
        ) : (
          centre
        )}
      </div>
    </div>
  )
}

/* ---------- Accuracy over time ---------- */

export function LineChart({ points, labels, height = 150 }) {
  const [hover, setHover] = useState(null)
  const W = 600
  const H = height
  const pad = 8
  const n = points.length
  const x = (i) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2))
  const y = (v) => pad + (1 - v) * (H - pad * 2)
  // One line through every period that had quizzes: a quiet day is a gap
  // in the evidence, not a drop to zero, so the line carries across it.
  const line = points.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean)
  const segs = line.length ? [line] : []
  const any = points.some((v) => v != null)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
        {[0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={y(f)} y2={y(f)} stroke="var(--border)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        ))}
        <defs>
          <linearGradient id="acc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {segs.map((s, k) => (
          <g key={k}>
            {s.length > 1 && <path d={`M${s[0][0]},${H} L${s.map((p) => p.join(',')).join(' L')} L${s.at(-1)[0]},${H} Z`} fill="url(#acc-fill)" />}
            <path d={`M${s.map((p) => p.join(',')).join(' L')}`} fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      {/* Points, in HTML so they stay round at any width. */}
      <div className="absolute inset-0">
        {points.map((v, i) =>
          v == null ? null : (
            <span
              key={i}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(v) / H) * 100}%`, borderColor: 'var(--brand)', background: hover === i ? 'var(--brand)' : 'var(--surface)' }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              {hover === i && (
                <Tip x="50%">
                  {labels[i]} · {Math.round(v * 100)}% right
                </Tip>
              )}
            </span>
          )
        )}
      </div>
      {!any && (
        <p className="absolute inset-0 flex items-center justify-center text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
          No quizzes in this period
        </p>
      )}
    </div>
  )
}

/* ---------- When you study: weekday by hour ---------- */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function HeatGrid({ grid }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...grid.flat())
  // Monday first, which is how a school week reads.
  const order = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div className="relative">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: '30px repeat(24, minmax(0, 1fr))' }}>
        {order.map((d) => (
          <div key={d} className="contents">
            <span className="flex items-center text-[10px]" style={{ color: 'var(--text-faint)' }}>
              {DAYS[d]}
            </span>
            {grid[d].map((v, h) => (
              <span
                key={h}
                className="aspect-square rounded-[3px]"
                style={{ background: v ? `color-mix(in oklab, var(--brand) ${18 + (v / max) * 82}%, var(--surface-sunken))` : 'var(--surface-sunken)', outline: hover?.d === d && hover?.h === h ? '1.5px solid var(--text)' : 'none' }}
                onPointerEnter={() => setHover({ d, h, v })}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid gap-[3px]" style={{ gridTemplateColumns: '30px repeat(24, minmax(0, 1fr))' }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[9.5px] tabular-nums" style={{ color: 'var(--text-faint)', visibility: h % 3 ? 'hidden' : 'visible' }}>
            {h}
          </span>
        ))}
      </div>
      <p className="mt-2 h-4 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
        {hover ? `${DAYS[hover.d]} ${String(hover.h).padStart(2, '0')}:00 to ${String(hover.h + 1).padStart(2, '0')}:00 · ${hm(hover.v)}` : ''}
      </p>
    </div>
  )
}

/* ---------- The streak, as a calendar ---------- */

export function Calendar({ days, from, end, goal = 20 }) {
  const [hover, setHover] = useState(null)
  // Whole weeks, Monday first, covering the range.
  const start = new Date(from)
  const back = (start.getDay() + 6) % 7
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate() - back)
  const cells = []
  for (let d = new Date(first); d.getTime() < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    cells.push({ key, date: new Date(d), minutes: days[key] || 0, inRange: d.getTime() >= from })
  }
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  const tone = (m) => (m <= 0 ? 'var(--surface-sunken)' : m >= goal ? 'var(--flame)' : 'color-mix(in oklab, var(--flame) 45%, var(--surface-sunken))')
  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((w, i) => (
          <div key={i} className="flex shrink-0 flex-col gap-[3px]">
            {w.map((c) => (
              <span
                key={c.key}
                className="h-3.5 w-3.5 rounded-[4px] sm:h-4 sm:w-4"
                style={{ background: c.inRange ? tone(c.minutes) : 'transparent', outline: hover?.key === c.key ? '1.5px solid var(--text)' : 'none' }}
                onPointerEnter={() => c.inRange && setHover(c)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 h-4 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
        {hover ? `${hover.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${hover.minutes ? hm(hover.minutes) : 'no study'}` : ''}
      </p>
    </div>
  )
}

/* ---------- A few counts as horizontal bars ---------- */

export function Bars({ items, format = (v) => v, colour = 'var(--brand)', max: fixed }) {
  const max = fixed || Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {i.label}
          </span>
          <span className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-sunken)' }}>
            <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${(i.value / max) * 100}%`, background: i.colour || colour }} />
          </span>
          <span className="text-right text-[12px] font-semibold tabular-nums">{format(i.value)}</span>
        </li>
      ))}
    </ul>
  )
}
