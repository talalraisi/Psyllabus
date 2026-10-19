'use client'

/**
 * The calendar hub's week view with all three layers, without signing in.
 *
 * Not reachable in production — same gate as the parent harness. Read-only:
 * the week view writes nothing, and nothing else is rendered here.
 */

import { useState } from 'react'
import { notFound } from 'next/navigation'
import WeekView from '@/components/calendar/WeekView'

const ENABLED = process.env.NODE_ENV !== 'production'

function sample(weekStart) {
  const at = (day, h, m = 0) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + day, h, m).toISOString()
  const utcDate = (day) => {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + day)
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString()
  }
  const busy = []
  for (const day of [0, 1, 2, 3, 4]) busy.push({ title: 'School', starts_at: at(day, 7, 30), ends_at: at(day, 14, 30), all_day: false })
  for (const day of [1, 3]) busy.push({ title: 'Football training', starts_at: at(day, 17), ends_at: at(day, 18, 30), all_day: false })
  busy.push({ title: 'Family dinner', starts_at: at(5, 19), ends_at: at(5, 21), all_day: false })
  busy.push({ title: 'National Day', starts_at: utcDate(2), ends_at: utcDate(3), all_day: true })
  const blocks = []
  for (const day of [0, 1, 2, 3, 4]) {
    blocks.push({ title: 'Physics SL: Kinematics', starts_at: at(day, 15, 30), ends_at: at(day, 16, 5) })
    // After football on football days, straight after Physics otherwise.
    const football = day === 1 || day === 3
    blocks.push({
      title: 'Maths: Complex numbers',
      starts_at: football ? at(day, 18, 45) : at(day, 16, 10),
      ends_at: football ? at(day, 19, 30) : at(day, 16, 45),
    })
  }
  const events = [
    { id: 'e1', title: 'Physics test', kind: 'test', due_at: at(3, 23, 59), all_day: true, completed: false },
    { id: 'e2', title: 'Econ IA draft', kind: 'deadline', due_at: at(4, 8, 0), all_day: false, completed: false },
  ]
  return { busy, blocks, events }
}

export default function CalendarPreview() {
  const [today] = useState(() => new Date())
  const [weekStart, setWeekStart] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()))
  const [selected, setSelected] = useState(null)
  if (!ENABLED) notFound()
  const { busy, blocks, events } = sample(weekStart)
  return (
    <main className="min-h-screen px-5 py-10" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-5xl">
        <WeekView
          weekStart={weekStart}
          today={today}
          busy={busy}
          blocks={blocks}
          events={events}
          selected={selected}
          onSelectDay={setSelected}
          onShiftWeek={(n) => setWeekStart((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7 * n))}
          onToday={() => setWeekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()))}
        />
      </div>
    </main>
  )
}
