'use client'

import { IconArrowLeft, IconChevronRight } from '@/components/Icons'
import { monthGrid, localDateKey, KIND_DOT } from '@/lib/calendar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * A month of days with an event dot per entry.
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

      <div>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 pb-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--text-faint)' }}
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
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                aria-pressed={isSelected}
                aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''}`}
                className={`min-h-[76px] rounded-[8px] p-2 text-left transition-colors duration-150 ${
                  lastRow ? '' : 'border-b'
                } ${isSelected ? '' : 'hover:bg-[var(--surface-sunken)]'}`}
                style={{
                  borderColor: 'var(--border)',
                  background: isSelected ? 'var(--brand-tint)' : undefined,
                }}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] tabular-nums ${
                    isToday
                      ? 'bg-[var(--brand)] font-semibold text-white'
                      : inMonth
                        ? 'font-medium text-[var(--text-body)]'
                        : 'text-[var(--text-faint)]'
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {dayEvents.slice(0, 4).map((e) => (
                      <span
                        key={e.id}
                        title={e.title}
                        className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[e.kind]} ${e.completed ? 'opacity-30' : ''}`}
                      />
                    ))}
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
