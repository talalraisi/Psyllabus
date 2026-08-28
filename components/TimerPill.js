'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { formatDuration } from '@/lib/notify'
import { readTimer, subscribeTimer, pauseTimer } from '@/lib/session-timer'

/**
 * The running session timer, visible from anywhere in the dashboard.
 *
 * Starting a session and then opening a quiz is the normal way to use this, so
 * the clock has to stay on screen once you leave the study plan. It hides
 * itself on the study plan, where the full timer is already showing.
 */
export default function TimerPill() {
  const [timer, setTimer] = useState(null)
  const pathname = usePathname()

  useEffect(() => {
    setTimer(readTimer())
    return subscribeTimer(setTimer)
  }, [])

  useEffect(() => {
    if (timer?.state !== 'running') return
    const id = setInterval(() => setTimer(readTimer()), 1000)
    return () => clearInterval(id)
  }, [timer?.state])

  if (!timer || timer.state !== 'running') return null
  if (pathname === '/dashboard/study-plan') return null

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[var(--surface)] py-2 pl-4 pr-2 shadow-[var(--shadow-raised)]">
      <Link
        href="/dashboard/study-plan"
        className="flex items-center gap-2 text-sm font-semibold tabular-nums text-[var(--text)]"
      >
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--brand)]" aria-hidden="true" />
        <span aria-label={`${formatDuration(timer.remaining)} left in this study session`}>
          {formatDuration(timer.remaining)}
        </span>
      </Link>
      <button
        onClick={pauseTimer}
        className="btn btn-quiet control-sm rounded-full px-3 text-xs"
      >
        Pause
      </button>
    </div>
  )
}
