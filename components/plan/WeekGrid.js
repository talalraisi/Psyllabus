'use client'

/**
 * Your week, painted: drag across the hours you are free to study.
 *
 * Seven boxes of minutes said how much time a day held but not when, and
 * looked like a tax form. This says both. Free time is stored as windows —
 * 4:00 to 6:00pm, 8:00 to 9:30pm — so the plan can put real times on the
 * day and take breaks inside them, and a gap between two windows (dinner,
 * football) is a break the plan does not have to invent.
 *
 * Painting starts on press: press a free cell and the drag clears, press an
 * empty one and it fills. The cell under the pointer is found from its
 * position rather than per-cell events, so a drag works the same with a
 * finger as with a mouse and does not lose cells when moving fast.
 */

import { useMemo, useRef, useState } from 'react'
import { WEEKDAYS, normaliseSlots } from '@/lib/study-plan'

const START = 6 * 60
const END = 24 * 60
const STEP = 30
const ROWS = (END - START) / STEP
const DAYS = [0, 1, 2, 3, 4, 5, 6]

const label = (m) => {
  const h = Math.floor(m / 60) % 24
  return `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`
}
const duration = (m) => (m === 0 ? '—' : m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`)

/** Windows → the set of filled half-hour cells, per day. */
function toCells(slots) {
  const cells = DAYS.map(() => new Set())
  for (const d of DAYS) {
    for (const [a, b] of slots?.[d] || []) {
      for (let r = 0; r < ROWS; r++) {
        const from = START + r * STEP
        if (from >= a && from + STEP <= b) cells[d].add(r)
      }
    }
  }
  return cells
}

/** Filled cells → windows, per day. */
function toSlots(cells) {
  const out = {}
  for (const d of DAYS) {
    const rows = [...cells[d]].sort((a, b) => a - b)
    out[d] = normaliseSlots(rows.map((r) => [START + r * STEP, START + (r + 1) * STEP])) || []
  }
  return out
}

export default function WeekGrid({ value, onChange }) {
  const cells = useMemo(() => toCells(value), [value])
  const grid = useRef(null)
  // The drag in progress: in state to draw it, mirrored in a ref so the
  // pointer handlers always see the latest cells between renders.
  const mode = useRef(null) // 'add' | 'clear' while dragging
  const working = useRef(null)
  const [draft, setDraft] = useState(null)

  const cellAt = (e) => {
    const el = grid.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const col = Math.floor(((e.clientX - r.left) / r.width) * 7)
    const row = Math.floor(((e.clientY - r.top) / r.height) * ROWS)
    if (col < 0 || col > 6 || row < 0 || row >= ROWS) return null
    return [col, row]
  }

  const apply = (hit) => {
    if (!hit || !mode.current || !working.current) return
    const [d, row] = hit
    const had = working.current[d].has(row)
    if ((mode.current === 'add') === had) return
    const next = [...working.current]
    next[d] = new Set(next[d])
    if (had) next[d].delete(row)
    else next[d].add(row)
    working.current = next
    setDraft(next)
  }

  const onDown = (e) => {
    const hit = cellAt(e)
    if (!hit) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    working.current = cells.map((s) => new Set(s))
    mode.current = working.current[hit[0]].has(hit[1]) ? 'clear' : 'add'
    apply(hit)
  }
  const onMove = (e) => mode.current && apply(cellAt(e))
  const onUp = () => {
    if (!mode.current) return
    const next = working.current
    mode.current = null
    working.current = null
    setDraft(null)
    onChange(toSlots(next))
  }

  // While painting, show the drag's working copy rather than the saved value.
  const shown = draft || cells
  const totals = DAYS.map((d) => shown[d].size * STEP)
  const week = totals.reduce((a, b) => a + b, 0)

  const copySunday = () => {
    const next = cells.map((s) => new Set(s))
    for (const d of [1, 2, 3, 4]) next[d] = new Set(cells[0])
    onChange(toSlots(next))
  }

  return (
    <div>
      <div className="flex">
        <div className="w-9 shrink-0" />
        <div className="grid flex-1 grid-cols-7 gap-1 pb-1.5">
          {DAYS.map((d) => (
            <div key={d} className="text-center">
              <p className="text-[11.5px] font-medium">{WEEKDAYS[d]}</p>
              <p className="text-[10.5px] tabular-nums" style={{ color: totals[d] ? 'var(--brand)' : 'var(--text-faint)' }}>
                {duration(totals[d])}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex">
        <div className="relative w-9 shrink-0" aria-hidden="true">
          {Array.from({ length: ROWS / 4 + 1 }, (_, i) => START + i * 120).map((m) => (
            <span
              key={m}
              className="absolute right-1.5 -translate-y-1/2 text-[9.5px] tabular-nums"
              style={{ top: `${((m - START) / (END - START)) * 100}%`, color: 'var(--text-faint)' }}
            >
              {m < END ? label(m) : ''}
            </span>
          ))}
        </div>
        <div
          ref={grid}
          role="grid"
          aria-label="Your free time each day. Drag over the hours you can study."
          className="grid flex-1 cursor-crosshair select-none grid-cols-7 gap-1"
          style={{ touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {DAYS.map((d) => (
            // One continuous track per day: painted time reads as a solid
            // block with rounded ends, the way a calendar shows an event,
            // rather than a stack of separate half-hour bars.
            <div key={d} className="flex flex-col overflow-hidden rounded-[5px]" role="row" style={{ background: 'var(--surface-sunken)' }}>
              {Array.from({ length: ROWS }, (_, r) => {
                const on = shown[d].has(r)
                const above = on && shown[d].has(r - 1)
                const below = on && shown[d].has(r + 1)
                const hour = (START + r * STEP) % 60 === 0
                return (
                  <span
                    key={r}
                    role="gridcell"
                    aria-selected={on}
                    aria-label={`${WEEKDAYS[d]} ${label(START + r * STEP)}${hour ? '' : ':30'}`}
                    className="block h-[10px]"
                    style={{
                      background: on ? 'color-mix(in srgb, var(--brand) 72%, transparent)' : 'transparent',
                      borderTopLeftRadius: on && !above ? 4 : 0,
                      borderTopRightRadius: on && !above ? 4 : 0,
                      borderBottomLeftRadius: on && !below ? 4 : 0,
                      borderBottomRightRadius: on && !below ? 4 : 0,
                      boxShadow: hour && r > 0 && !above ? 'inset 0 1px 0 var(--border)' : undefined,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <p className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {duration(week)} a week
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={copySunday} className="font-medium text-[var(--brand)] hover:underline">
            Copy Sunday to Mon–Thu
          </button>
          <button type="button" onClick={() => onChange(toSlots(DAYS.map(() => new Set())))} className="font-medium hover:underline" style={{ color: 'var(--text-muted)' }}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
