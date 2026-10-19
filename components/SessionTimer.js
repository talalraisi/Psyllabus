'use client'

import { useState, useEffect, useRef } from 'react'
import { formatDuration, notify, chime, notificationPermission, requestNotificationPermission } from '@/lib/notify'
import {
  readTimer,
  subscribeTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  finishTimer,
  setTimerMinutes,
} from '@/lib/session-timer'

/**
 * Countdown for a study session.
 *
 * All state lives in lib/session-timer.js, so opening a practice quiz mid
 * session no longer kills the clock: this component is a view over shared
 * state rather than the owner of it.
 */
/**
 * `label` — { subject, subtopic } — is what the next run is for, when the
 * study plan knows. Recorded with the run so time can be counted per subject.
 * A resumed run keeps the label it was started with.
 */
export default function SessionTimer({ minutes, label = null, compact = false }) {
  const [timer, setTimer] = useState(() => ({ state: 'idle', minutes, remaining: minutes * 60 }))
  const [ready, setReady] = useState(false)
  const firedRef = useRef(false)

  // Read real state only after mount, so the server and first client render
  // agree and React does not complain about a hydration mismatch.
  useEffect(() => {
    setTimer(readTimer())
    setReady(true)
    return subscribeTimer(setTimer)
  }, [])

  // Changing the planned length re-arms an idle clock, never a running one.
  useEffect(() => {
    if (!ready) return
    const t = readTimer()
    if (t.state === 'idle' || t.state === 'done') setTimerMinutes(minutes)
  }, [minutes, ready])

  // Tick while running.
  useEffect(() => {
    if (timer.state !== 'running') return
    const tick = () => {
      const next = readTimer()
      setTimer(next)
      if (next.state === 'done' && !firedRef.current) {
        firedRef.current = true
        finishTimer()
        chime()
        notify('Study session finished', {
          body: `That is ${next.minutes} minutes done. Log what you covered.`,
          tag: 'psyllabus-session',
        })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [timer.state])

  // Keep the remaining time in the tab title while a session runs.
  useEffect(() => {
    if (timer.state !== 'running') return
    const original = document.title
    document.title = `${formatDuration(timer.remaining)} · Study session`
    return () => {
      document.title = original
    }
  }, [timer.state, timer.remaining])

  const start = async () => {
    if (notificationPermission() === 'default') await requestNotificationPermission()
    firedRef.current = false
    const t = readTimer()
    const resuming = t.state === 'paused'
    startTimer(
      t.minutes,
      resuming ? t.remaining : null,
      resuming && t.subject ? { subject: t.subject, subtopic: t.subtopic } : label
    )
  }

  const total = (timer.minutes || minutes) * 60
  const elapsed = total > 0 ? 1 - timer.remaining / total : 0

  /* One row, for the study plan: the time, how far through, and the controls.
     The full version's heading and explanation are for a page where the timer
     is the subject; in the plan it is a tool beside the list. */
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <p className="w-[4.5rem] shrink-0 text-[20px] font-semibold tabular-nums tracking-[-0.02em]" role="timer" aria-live={timer.state === 'running' ? 'off' : 'polite'}>
          {formatDuration(timer.remaining)}
        </p>
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
          role="progressbar"
          aria-label="Block progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(elapsed * 100)}
        >
          <div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, Math.max(0, elapsed * 100))}%` }} />
        </div>
        {timer.state !== 'running' ? (
          <button onClick={start} className="btn btn-solid control-sm shrink-0">
            {timer.state === 'paused' ? 'Resume' : timer.state === 'done' ? 'Again' : 'Start block'}
          </button>
        ) : (
          <button onClick={pauseTimer} className="btn btn-outline control-sm shrink-0">
            Pause
          </button>
        )}
        {timer.state !== 'idle' && (
          <button
            onClick={() => {
              firedRef.current = false
              resetTimer(minutes)
            }}
            className="btn btn-quiet control-sm shrink-0"
            aria-label="Reset timer"
          >
            Reset
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border-strong)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="t-overline">{timer.state === 'done' ? 'Session finished' : 'Session timer'}</p>
          <p
            className="t-stat mt-1 tabular-nums"
            role="timer"
            aria-live={timer.state === 'running' ? 'off' : 'polite'}
          >
            {formatDuration(timer.remaining)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {timer.state !== 'running' ? (
            <button onClick={start} className="btn btn-solid control-sm">
              {timer.state === 'paused' ? 'Resume' : timer.state === 'done' ? 'Start again' : 'Start'}
            </button>
          ) : (
            <button onClick={pauseTimer} className="btn btn-outline control-sm">
              Pause
            </button>
          )}
          {timer.state !== 'idle' && (
            <button
              onClick={() => {
                firedRef.current = false
                resetTimer(minutes)
              }}
              className="btn btn-quiet control-sm"
            >
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
        aria-valuenow={Math.round(elapsed * 100)}
      >
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, Math.max(0, elapsed * 100))}%` }}
        />
      </div>

      <p className="t-small mt-3">
        {timer.state === 'running'
          ? 'Keeps running while you take quizzes. It follows you around the app.'
          : timer.state === 'done'
            ? 'Tick off what you covered, then start another block if you have time.'
            : 'Starts a focused block. It keeps counting while you work through quizzes.'}
      </p>
    </div>
  )
}
