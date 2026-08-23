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
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="t-overline">
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
          <button onClick={onToday} className="btn btn-quiet control-sm text-xs">
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

      <div className="surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-sunken)]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="t-overline px-2 py-2 text-center">
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
            const lastColumn = i % 7 === 6
            const lastRow = i >= 35
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                aria-pressed={isSelected}
                aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''}`}
                className={`min-h-[72px] p-2 text-left transition-colors duration-150 ${
                  lastColumn ? '' : 'border-r border-[var(--border)]'
                } ${lastRow ? '' : 'border-b border-[var(--border)]'} ${
                  isSelected ? 'bg-[var(--brand-tint)]' : 'hover:bg-[var(--surface-sunken)]'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
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
