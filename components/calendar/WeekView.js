'use client'

/**
 * The week, all of it in one place: the student's own calendar, their tests
 * and deadlines, and the study blocks the plan has fitted around both.
 *
 * Three layers, told apart by weight rather than by colour alone:
 *   your life      imported from your own calendar — quiet, outlined, grey
 *   study blocks   what the plan scheduled — solid brand green
 *   dates          tests, mocks, deadlines from Psyllabus — the status colour
 *                  of how much they matter, and all-day ones along the top
 *
 * Read-only by design. The plan decides where study goes and the student
 * moves it from the study plan, where the reasons are; the student's own
 * events are edited in their own calendar app, which stays the source of
 * truth for their life.
 */

import { useMemo } from 'react'
import { WEEKDAYS } from '@/lib/study-plan'
import { KIND_COLOR, KIND_LABEL } from '@/lib/calendar'

const START = 6 * 60
const END = 24 * 60
const PX = 0.75 // pixels per minute
const HEIGHT = (END - START) * PX

const clock = (m) => {
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${((h + 11) % 12) + 1}${min ? `:${String(min).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Pieces of [start, end] that fall on each day of the week, in minutes from that day's midnight. */
function onDays(days, start, end) {
  const out = []
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  days.forEach((d, i) => {
    const midnight = d.getTime()
    const from = Math.max(s, midnight)
    const to = Math.min(e, midnight + 86400000)
    if (to > from) out.push({ i, from: (from - midnight) / 60000, to: (to - midnight) / 60000 })
  })
  return out
}

/** Side-by-side lanes for blocks that overlap, so nothing hides behind anything. */
function lanes(items) {
  const sorted = [...items].sort((a, b) => a.from - b.from || b.to - a.to)
  const ends = []
  for (const it of sorted) {
    let lane = ends.findIndex((e) => e <= it.from)
    if (lane < 0) lane = ends.length
    ends[lane] = it.to
    it.lane = lane
  }
  for (const it of sorted) it.lanes = Math.max(1, ends.length)
  return sorted
}

export default function WeekView({ weekStart, today, busy = [], blocks = [], events = [], selected, onSelectDay, onShiftWeek, onToday }) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart]
  )

  const { timed, allDay } = useMemo(() => {
    const timed = days.map(() => [])
    const allDay = days.map(() => [])
    for (const b of busy) {
      if (b.all_day) {
        // Stored as UTC midnight of its date (lib/ics.js): read as a date.
        const first = b.starts_at.slice(0, 10)
        const last = new Date(new Date(b.ends_at).getTime() - 1).toISOString().slice(0, 10)
        days.forEach((d, i) => {
          const k = dayKey(d)
          if (k >= first && k <= last) allDay[i].push({ layer: 'life', title: b.title })
        })
      } else {
        for (const p of onDays(days, b.starts_at, b.ends_at)) timed[p.i].push({ ...p, layer: 'life', title: b.title || 'Busy' })
      }
    }
    for (const b of blocks) {
      for (const p of onDays(days, b.starts_at, b.ends_at)) timed[p.i].push({ ...p, layer: 'study', title: b.title })
    }
    for (const e of events) {
      if (e.completed) continue
      if (e.all_day) {
        const i = days.findIndex((d) => dayKey(d) === dayKey(new Date(e.due_at)))
        if (i >= 0) allDay[i].push({ layer: 'date', title: e.title, kind: e.kind })
      } else {
        const start = new Date(e.due_at)
        for (const p of onDays(days, start, new Date(start.getTime() + 60 * 60000))) timed[p.i].push({ ...p, layer: 'date', title: e.title, kind: e.kind })
      }
    }
    return { timed: timed.map(lanes), allDay }
  }, [days, busy, blocks, events])

  const studyMinutes = blocks
    .filter((b) => {
      const t = new Date(b.starts_at).getTime()
      return t >= days[0].getTime() && t < days[0].getTime() + 7 * 86400000
    })
    .reduce((n, b) => n + (new Date(b.ends_at) - new Date(b.starts_at)) / 60000, 0)

  const range = `${days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold tracking-[-0.012em]">{range}</p>
          <p className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {studyMinutes ? `${Math.floor(studyMinutes / 60)}h ${String(Math.round(studyMinutes % 60)).padStart(2, '0')}m of study planned` : 'No study blocks this week yet'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onShiftWeek(-1)} className="btn btn-quiet control-sm" aria-label="Previous week">
            ‹
          </button>
          <button type="button" onClick={onToday} className="btn btn-quiet control-sm">
            This week
          </button>
          <button type="button" onClick={() => onShiftWeek(1)} className="btn btn-quiet control-sm" aria-label="Next week">
            ›
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }} /> Your calendar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--brand)' }} /> Study plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--status-weak)' }} /> Tests and deadlines
        </span>
      </div>

      <div className="overflow-x-auto rounded-[12px] border" style={{ borderColor: 'var(--border)' }}>
        <div className="min-w-[640px]">
          {/* Days, and what is all-day on each */}
          <div className="grid border-b" style={{ gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))', borderColor: 'var(--border)' }}>
            <div />
            {days.map((d, i) => {
              const key = dayKey(d)
              const isToday = key === dayKey(today)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDay?.(key)}
                  aria-pressed={selected === key}
                  className="border-l px-1.5 pb-1.5 pt-2 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                  style={{ borderColor: 'var(--border)', background: selected === key ? 'var(--surface-sunken)' : undefined }}
                >
                  <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {WEEKDAYS[d.getDay()]}
                  </span>
                  <span
                    className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular-nums"
                    style={isToday ? { background: 'var(--brand)', color: 'var(--bg)' } : undefined}
                  >
                    {d.getDate()}
                  </span>
                  <span className="mt-1 flex flex-col gap-0.5">
                    {allDay[i].slice(0, 3).map((x, n) => (
                      <span
                        key={n}
                        title={x.title}
                        className="truncate rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-medium"
                        style={
                          x.layer === 'date'
                            ? { background: `color-mix(in srgb, ${KIND_COLOR[x.kind] || 'var(--status-weak)'} 16%, transparent)`, color: KIND_COLOR[x.kind] || 'var(--status-weak)' }
                            : { background: 'var(--surface-sunken)', color: 'var(--text-muted)' }
                        }
                      >
                        {x.layer === 'date' ? `${KIND_LABEL[x.kind] || 'Event'}: ` : ''}
                        {x.title}
                      </span>
                    ))}
                    {allDay[i].length > 3 && (
                      <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                        +{allDay[i].length - 3} more
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* The hours */}
          <div className="relative grid" style={{ gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))', height: HEIGHT }}>
            <div className="relative" aria-hidden="true">
              {Array.from({ length: (END - START) / 60 }, (_, h) => START + h * 60).map((m) =>
                m === START ? null : (
                  <span key={m} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums" style={{ top: (m - START) * PX, color: 'var(--text-faint)' }}>
                    {clock(m)}
                  </span>
                )
              )}
            </div>
            {days.map((d, i) => (
              <div key={dayKey(d)} className="relative border-l" style={{ borderColor: 'var(--border)' }}>
                {Array.from({ length: (END - START) / 60 }, (_, h) => (
                  <span key={h} aria-hidden="true" className="absolute inset-x-0 border-t" style={{ top: h * 60 * PX, borderColor: 'var(--border)', opacity: h ? 0.6 : 0 }} />
                ))}
                {timed[i].map((x, n) => {
                  const from = Math.max(x.from, START)
                  const to = Math.min(x.to, END)
                  if (to <= from) return null
                  const style =
                    x.layer === 'study'
                      ? { background: 'color-mix(in srgb, var(--brand) 22%, var(--surface))', borderLeft: '3px solid var(--brand)', color: 'var(--text)' }
                      : x.layer === 'date'
                        ? { background: `color-mix(in srgb, ${KIND_COLOR[x.kind] || 'var(--status-weak)'} 18%, var(--surface))`, borderLeft: `3px solid ${KIND_COLOR[x.kind] || 'var(--status-weak)'}`, color: 'var(--text)' }
                        : { background: 'var(--surface-sunken)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }
                  return (
                    <div
                      key={n}
                      title={`${clock(Math.round(x.from))}–${clock(Math.round(x.to))} ${x.title}`}
                      className="absolute overflow-hidden rounded-[5px] px-1 py-0.5 text-[10.5px] leading-tight"
                      style={{
                        ...style,
                        top: (from - START) * PX + 1,
                        height: Math.max(14, (to - from) * PX - 2),
                        left: `calc(${(x.lane / x.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / x.lanes}% - 4px)`,
                      }}
                    >
                      <span className="block truncate font-medium">{x.title}</span>
                      {(to - from) * PX > 26 && <span className="block truncate tabular-nums opacity-80">{clock(Math.round(x.from))}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
