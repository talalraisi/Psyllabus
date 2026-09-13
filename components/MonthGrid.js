'use client'

import { IconArrowLeft, IconChevronRight } from '@/components/Icons'
import { monthGrid, localDateKey, KIND_COLOR } from '@/lib/calendar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * A month, ruled like a sheet, with what is actually on each day written on it.
 *
 * Every entry used to be a 6px dot. A dot tells you something is happening and
 * nothing about what, so the only way to read your own month was to click each
 * day in turn — which is the opposite of what a calendar is for. Entries are
 * named now, colour-coded down their left edge, and a day with more than fits
 * says how many it is hiding.
 *
 * The cells are ruled rather than floated: rounded tiles with gaps between
 * them read as a grid of buttons, and a month is a table.
 *
 * Every cell is the same height whatever it holds, so paging between months
 * never shifts the rest of the page.
 */
export default function MonthGrid({
  cursor,
  today = new Date(),
  selected,
  eventsByDay,
  onSelect,
  onShiftMonth,
  onToday,
}) {
  const grid = monthGrid(cursor.getFullYear(), cursor.getMonth())
  const todayKey = localDateKey(today)

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onShiftMonth(-1)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
          >
            <IconArrowLeft width={16} height={16} />
          </button>
          <button onClick={onToday} className="btn btn-quiet control-sm">
            Today
          </button>
          <button
            onClick={() => onShiftMonth(1)}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
          >
            <IconChevronRight width={16} height={16} />
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[10px] border"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="border-b px-2 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--text-faint)', borderColor: 'var(--border)' }}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((day, i) => {
            const key = localDateKey(day)
            const inMonth = day.getMonth() === cursor.getMonth()
            const isToday = key === todayKey
            const isSelected = key === selected
            const dayEvents = eventsByDay.get(key) || []
            const lastRow = i >= 35
            const lastCol = i % 7 === 6
            const shown = dayEvents.slice(0, 3)
            const hidden = dayEvents.length - shown.length

            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                aria-pressed={isSelected}
                aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''}`}
                className={`relative flex min-h-[118px] flex-col gap-1 p-1.5 text-left transition-colors duration-150 ${
                  lastRow ? '' : 'border-b'
                } ${lastCol ? '' : 'border-r'} ${isSelected ? '' : 'hover:bg-[var(--surface-sunken)]'}`}
                style={{
                  borderColor: 'var(--border)',
                  background: isSelected
                    ? 'var(--brand-tint)'
                    : inMonth
                      ? undefined
                      : 'color-mix(in oklab, var(--surface-sunken) 45%, transparent)',
                }}
              >
                {/* Today is marked, not selected. A filled disc on today made it
                    look like the day you had picked, which it usually is not. */}
                <span className="flex items-baseline gap-1.5">
                  <span
                    className="text-[13px] tabular-nums"
                    style={{
                      color: isToday
                        ? 'var(--brand)'
                        : inMonth
                          ? 'var(--text-body)'
                          : 'var(--text-faint)',
                      fontWeight: isToday ? 700 : inMonth ? 500 : 400,
                    }}
                  >
                    {day.getDate()}
                  </span>
                  {isToday && (
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ background: 'var(--brand)' }}
                      aria-hidden="true"
                    />
                  )}
                </span>

                {shown.map((e) => (
                  <span
                    key={e.id}
                    title={e.title}
                    className="flex min-w-0 items-center gap-1 border-l-2 pl-1"
                    style={{
                      borderColor: KIND_COLOR[e.kind] || KIND_COLOR.other,
                      opacity: e.completed ? 0.4 : 1,
                    }}
                  >
                    <span
                      className="min-w-0 truncate text-[11.5px] leading-[1.4]"
                      style={{
                        color: 'var(--text-body)',
                        textDecoration: e.completed ? 'line-through' : undefined,
                      }}
                    >
                      {e.title}
                    </span>
                  </span>
                ))}

                {hidden > 0 && (
                  <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                    +{hidden} more
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
