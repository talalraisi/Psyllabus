'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDuration, notify, chime, notificationPermission, requestNotificationPermission } from '@/lib/notify'

/**
 * Countdown for a study session.
 *
 * Time is derived from wall-clock deadlines rather than by decrementing a
 * counter, so backgrounding the tab (which throttles timers) does not make the
 * countdown drift.
 */
export default function SessionTimer({ minutes, onFinish }) {
  const [state, setState] = useState('idle') // idle | running | paused | done
  const [remaining, setRemaining] = useState(minutes * 60)
  const deadlineRef = useRef(null)
  const finishedRef = useRef(false)

  // Changing the planned length while idle or done re-arms the clock.
  useEffect(() => {
    if (state === 'idle' || state === 'done') {
      setRemaining(minutes * 60)
      finishedRef.current = false
      if (state === 'done') setState('idle')
    }
    // Intentionally not reacting to `state`: this is about the length changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setState('done')
    setRemaining(0)
    chime()
    notify('Study session finished', {
      body: `That is ${minutes} minutes done. Log what you covered.`,
      tag: 'psyllabus-session',
    })
    onFinish?.()
  }, [minutes, onFinish])

  useEffect(() => {
    if (state !== 'running') return
    const tick = () => {
      const left = Math.round((deadlineRef.current - Date.now()) / 1000)
      if (left <= 0) finish()
      else setRemaining(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [state, finish])

  // Keep the remaining time in the tab title while a session runs.
  useEffect(() => {
    if (state !== 'running') return
    const original = document.title
    document.title = `${formatDuration(remaining)} · Study session`
    return () => {
      document.title = original
    }
  }, [state, remaining])

  const start = async () => {
    if (notificationPermission() === 'default') await requestNotificationPermission()
    finishedRef.current = false
    deadlineRef.current = Date.now() + remaining * 1000
    setState('running')
  }

  const pause = () => {
    setRemaining(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)))
    setState('paused')
  }

  const reset = () => {
    finishedRef.current = false
    setRemaining(minutes * 60)
    setState('idle')
  }

  const total = minutes * 60
  const elapsedFraction = total > 0 ? 1 - remaining / total : 0

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border-strong)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="t-overline">{state === 'done' ? 'Session finished' : 'Session timer'}</p>
          <p
            className="t-stat mt-1 tabular-nums"
            role="timer"
            aria-live={state === 'running' ? 'off' : 'polite'}
          >
            {formatDuration(remaining)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {state !== 'running' ? (
            <button onClick={start} className="btn btn-solid control-sm text-xs">
              {state === 'paused' ? 'Resume' : state === 'done' ? 'Start again' : 'Start'}
            </button>
          ) : (
            <button onClick={pause} className="btn btn-outline control-sm text-xs">
              Pause
            </button>
          )}
          {(state === 'paused' || state === 'running' || state === 'done') && (
            <button onClick={reset} className="btn btn-quiet control-sm text-xs">
              Reset
            </button>
          )}
        </div>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(elapsedFraction * 100)}
      >
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, elapsedFraction * 100)}%` }}
        />
      </div>

      {state === 'done' && (
        <p className="t-small mt-3">
          Tick off what you actually covered, then start another block if you have the time.
        </p>
      )}
    </div>
  )
}
