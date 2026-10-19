'use client'

/**
 * Time studied, as rows you read left to right.
 *
 * One row per month with days 1 to 31 across, for any range up to a year.
 * For five years, one row per year with a square per fortnight: a square per
 * day would be 1,800 squares or a 60-row wall.
 *
 * Every frame uses the same 31-column grid, so a square is the same size
 * whichever frame you are on. The first version gave five years a square per
 * week, which is 53 columns; its squares came out a third smaller than the
 * months' and the whole thing visibly shrank every time you switched to it.
 * A fortnight is 27 columns, so a year fits the grid the months already use.
 * And the height eases between frames rather than snapping — 1M is one row
 * and 1Y is twelve, and that difference should read as the card opening up,
 * not jumping.
 *
 * This replaced the vendored activity heatmap from 21st.dev, whose calendar
 * runs each week down a column the way GitHub's does. Reading a day at a time
 * meant reading down and wrapping, and that layout needs seven rows whatever
 * the range, so it could not be made shorter. Its weekday and month views
 * went with it: every row here already is a month, with its total at the end.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { dayKey } from '@/lib/study-time'

const FRAMES = [
  { key: '1M', name: '1 month', months: 1 },
  { key: '3M', name: '3 months', months: 3 },
  { key: '6M', name: '6 months', months: 6 },
  { key: '1Y', name: '1 year', months: 12 },
  { key: '5Y', name: '5 years', years: 5 },
]
const DEFAULT_FRAME = '3M'
// Which frame you last picked. A per-device convenience, so localStorage is
// the right home: losing it costs one click.
const STORE = 'psyllabus:study-heatmap-frame'
const MIX = [0, 30, 52, 76, 100]
// Squares stay between these. Below the minimum the grid scrolls sideways
// inside the card rather than shrinking into specks; above the maximum a
// 3-month view on a wide screen turns into bathroom tiles. A phone fits all
// 31 columns at the minimum once the month totals step aside.
const COLS = 31
const MIN_CELL = 6
const MAX_CELL = 20
const GRAIN_LABEL = { day: 'day', fortnight: 'two weeks' }

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })


/** Minutes as a person would say them: "<1 min", "25 min", "2h 05m". */
export function formatStudyTime(minutes) {
  if (minutes <= 0) return '0 min'
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  let h = Math.floor(minutes / 60)
  let m = Math.round(minutes - h * 60)
  if (m === 60) { h += 1; m = 0 }
  return `${h}h ${String(m).padStart(2, '0')}m`
}

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

function buildMonths(byDay, months, today) {
  const todayKey = dayKey(today)
  const rows = []
  for (let i = months - 1; i >= 0; i--) {
    const first = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const y = first.getFullYear()
    const m = first.getMonth()
    const length = new Date(y, m + 1, 0).getDate()
    const cells = []
    let total = 0
    for (let d = 1; d <= length; d++) {
      const date = new Date(y, m, d)
      if (date > today) break
      const key = dayKey(date)
      const value = byDay.get(key) || 0
      total += value
      cells.push({ key, col: d - 1, value, date, end: date, today: key === todayKey })
    }
    // The year only where the range crosses one — on its first row and on
    // January — so a 1-year view reads without every row saying 2026, and a
    // 3-month view inside one year does not say it at all.
    const crosses = new Date(today.getFullYear(), today.getMonth() - months + 1, 1).getFullYear() !== today.getFullYear()
    const label = crosses && (i === months - 1 || m === 0) ? `${MONTH.format(first)} ’${String(y).slice(2)}` : MONTH.format(first)
    rows.push({ key: `${y}-${m}`, label, title: MONTH_YEAR.format(first), cells, total })
  }
  return {
    grain: 'day',
    rows,
    start: new Date(today.getFullYear(), today.getMonth() - months + 1, 1),
    ticks: [[0, '1'], [7, '8'], [14, '15'], [21, '22'], [28, '29']],
  }
}

function buildYears(byDay, years, today) {
  const todayKey = dayKey(today)
  const rows = []
  for (let y = today.getFullYear() - years + 1; y <= today.getFullYear(); y++) {
    const spans = []
    for (let i = 0; ; i++) {
      const date = new Date(y, 0, 1 + i)
      if (date.getFullYear() !== y || date > today) break
      const col = Math.floor(i / 14)
      const span = spans[col] ?? (spans[col] = { key: `${y}-f${col}`, col, value: 0, date, end: date, today: false })
      span.value += byDay.get(dayKey(date)) || 0
      span.end = date
      if (dayKey(date) === todayKey) span.today = true
    }
    rows.push({ key: String(y), label: String(y), title: String(y), cells: spans, total: spans.reduce((s, w) => s + w.value, 0) })
  }
  return {
    grain: 'fortnight',
    rows,
    start: new Date(today.getFullYear() - years + 1, 0, 1),
    // The fortnight each quarter's first day falls in.
    ticks: [[0, 'Jan'], [6, 'Apr'], [12, 'Jul'], [19, 'Oct']],
  }
}

function summarise(byDay, start, today) {
  let total = 0
  let active = 0
  let longest = 0
  let run = 0
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const v = byDay.get(dayKey(d)) || 0
    total += v
    if (v > 0) { active++; run++; longest = Math.max(longest, run) } else run = 0
  }
  // Counted back from today, or from yesterday if today has nothing in it
  // yet: at breakfast the evening's study has not happened, and a streak
  // should not read zero for it.
  let current = 0
  let d = byDay.get(dayKey(today)) > 0 ? today : addDays(today, -1)
  while (byDay.get(dayKey(d)) > 0) { current++; d = addDays(d, -1) }
  return { total, active, longest, current }
}

const days = (n) => `${n} day${n === 1 ? '' : 's'}`

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function savedFrame() {
  try {
    const saved = localStorage.getItem(STORE)
    return FRAMES.some((f) => f.key === saved) ? saved : DEFAULT_FRAME
  } catch {
    return DEFAULT_FRAME
  }
}

export default function StudyHeatmap({ data }) {
  // Both read in the first render on the client, so the card arrives at its
  // real size. Setting them from an effect drew a placeholder first and then
  // swapped in a card of a different height a frame later. On the server
  // there is no clock or storage to read, and nothing renders until the
  // client has them; the dashboard only shows this after its data has
  // loaded in the browser, so it never meets that case.
  const [frame, setFrame] = useState(() => (typeof window === 'undefined' ? DEFAULT_FRAME : savedFrame()))
  const [today] = useState(() => (typeof window === 'undefined' ? null : startOfToday()))
  const [tip, setTip] = useState(null)
  const rowsRef = useRef(null)
  const [rowsHeight, setRowsHeight] = useState(null)

  useEffect(() => {
    if (!tip) return
    const clear = () => setTip(null)
    window.addEventListener('scroll', clear, true)
    return () => window.removeEventListener('scroll', clear, true)
  }, [tip])

  const byDay = useMemo(() => new Map(data.map((d) => [d.date, Math.max(0, d.value || 0)])), [data])
  const spec = FRAMES.find((f) => f.key === frame) ?? FRAMES[1]
  const model = useMemo(
    () => (today ? (spec.years ? buildYears(byDay, spec.years, today) : buildMonths(byDay, spec.months, today)) : null),
    [byDay, spec, today]
  )
  const summary = useMemo(() => (model ? summarise(byDay, model.start, today) : null), [byDay, model, today])
  const ready = Boolean(model)

  // The rows' height, so the box around them can ease to it.
  useEffect(() => {
    const el = rowsRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setRowsHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ready])

  const choose = (key) => {
    setFrame(key)
    setTip(null)
    try {
      localStorage.setItem(STORE, key)
    } catch {
      /* not remembered, still switched */
    }
  }

  if (!model) return <div style={{ minHeight: 180 }} aria-busy="true" />

  const max = Math.max(0, ...model.rows.flatMap((r) => r.cells.map((c) => c.value)))
  const levelOf = (v) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)))
  const fill = (level) =>
    level === 0 ? 'var(--border)' : `color-mix(in srgb, var(--brand) ${MIX[level]}%, var(--border))`
  const gridStyle = {
    gridTemplateColumns: `repeat(${COLS}, minmax(${MIN_CELL}px, 1fr))`,
    maxWidth: COLS * (MAX_CELL + 3),
  }
  const grid = 'grid flex-1 gap-[2px] sm:gap-[3px]'
  const range =
    model.start.getFullYear() === today.getFullYear()
      ? `${SHORT.format(model.start).replace(/ \d{4}$/, '')} – ${SHORT.format(today)}`
      : `${SHORT.format(model.start)} – ${SHORT.format(today)}`

  const onOver = (e) => {
    const cell = e.target.closest?.('[data-tip]')
    if (!cell) return
    const r = cell.getBoundingClientRect()
    const x = Math.min(window.innerWidth - 90, Math.max(90, r.left + r.width / 2))
    setTip({ title: cell.dataset.tip, value: cell.dataset.value, x, y: r.top })
  }

  return (
    <div className="min-w-0">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {[
          ['Total', formatStudyTime(summary.total)],
          ['Active days', String(summary.active)],
          ['Longest streak', days(summary.longest)],
          ['Current streak', days(summary.current)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{label}</dt>
            <dd className="mt-0.5 truncate text-[18px] font-semibold leading-6 tracking-[-0.02em] tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div
        className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          role="radiogroup"
          aria-label="Time frame"
          className="inline-flex gap-0.5 rounded-[10px] border p-0.5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
          onKeyDown={(e) => {
            const at = FRAMES.findIndex((f) => f.key === frame)
            const next =
              e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (at + 1) % FRAMES.length
              : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (at + FRAMES.length - 1) % FRAMES.length
              : -1
            if (next < 0) return
            e.preventDefault()
            choose(FRAMES[next].key)
            e.currentTarget.querySelector(`[data-frame="${FRAMES[next].key}"]`)?.focus()
          }}
        >
          {FRAMES.map((f) => {
            const on = f.key === frame
            return (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={f.name}
                title={f.name}
                data-frame={f.key}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(f.key)}
                className="rounded-[8px] px-2.5 py-1 text-[11.5px] font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                style={
                  on
                    ? { background: 'var(--bg)', color: 'var(--text)', boxShadow: '0 1px 2px rgb(0 0 0 / 0.08)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {f.key}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--text-faint)' }} aria-hidden="true">
          <span>Less</span>
          {MIX.map((_, level) => (
            <span key={level} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: fill(level) }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Eases to the rows' height when the frame changes, instead of the
          card snapping from one row to twelve. Padded and pulled back by the
          same 3px so the overflow that hides rows mid-change does not also
          clip today's outline at the edge. */}
      <div
        className="-mx-[3px] mt-4 overflow-hidden px-[3px] transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ height: rowsHeight ?? 'auto' }}
      >
        <div ref={rowsRef} className="overflow-x-auto pb-1" onPointerOver={onOver} onPointerLeave={() => setTip(null)}>
          <div className="flex flex-col gap-[3px] sm:gap-1">
            <div className="flex items-end gap-2 sm:gap-3" aria-hidden="true">
              <span className="w-10 shrink-0" />
              <div className={grid} style={gridStyle}>
                {model.ticks.map(([col, label]) => (
                  <span
                    key={label}
                    className="whitespace-nowrap text-[10px] leading-3"
                    style={{ gridColumn: `${col + 1} / span 6`, color: 'var(--text-faint)' }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <span className="hidden w-16 shrink-0 sm:block" />
            </div>

            {model.rows.map((row) => (
              <div
                key={row.key}
                role="img"
                aria-label={`${row.title}: ${formatStudyTime(row.total)}, ${days(row.cells.filter((c) => c.value > 0).length)} with study`}
                className="flex items-center gap-2 sm:gap-3"
              >
                <span className="w-10 shrink-0 whitespace-nowrap text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {row.label}
                </span>
                <div className={grid} style={gridStyle}>
                  {row.cells.map((c) => (
                    <span
                      key={c.key}
                      data-tip={model.grain === 'day' ? DAY.format(c.date) : `${SHORT.format(c.date)} – ${SHORT.format(c.end)}`}
                      data-value={c.value > 0 ? formatStudyTime(c.value) : 'Nothing logged'}
                      className="aspect-square"
                      style={{
                        // A share of the square rather than fixed pixels: 3px
                        // on a 7px phone square makes a dot.
                        borderRadius: '22%',
                        gridColumnStart: c.col + 1,
                        background: fill(levelOf(c.value)),
                        outline: c.today ? '1.5px solid var(--text-muted)' : undefined,
                        outlineOffset: c.today ? 1 : undefined,
                      }}
                    />
                  ))}
                </div>
                <span className="hidden w-16 shrink-0 text-right text-[11px] tabular-nums sm:block" style={{ color: 'var(--text-muted)' }}>
                  {row.total > 0 ? formatStudyTime(row.total) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
        {range} · one square per {GRAIN_LABEL[model.grain]} · quizzes and the session timer, counted once
      </p>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 rounded-[10px] border px-3 py-2 shadow-lg"
          style={{
            left: tip.x,
            top: tip.y - 8,
            transform: 'translate(-50%, -100%)',
            borderColor: 'var(--border-strong)',
            background: 'var(--surface)',
          }}
        >
          <p className="whitespace-nowrap text-[10.5px]" style={{ color: 'var(--text-faint)' }}>{tip.title}</p>
          <p className="mt-0.5 whitespace-nowrap text-[12.5px] font-semibold">{tip.value}</p>
        </div>
      )}
    </div>
  )
}
