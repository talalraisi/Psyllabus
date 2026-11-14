'use client'

import { useState } from 'react'
import SessionTimer from '@/components/SessionTimer'
import Select from '@/components/Select'

/**
 * A timer for any study, on screen or off it: a textbook, class notes, a past
 * paper on paper, flashcards, or just sitting down to revise.
 *
 * The session timer already counts towards the streak, the day's goal and
 * time studied (lib/session-timer.js), but it only started from a plan block,
 * so an hour of study the app did not set had no way to count. This is the
 * same timer with its own front door, on the home page and the study plan:
 * pick how long, optionally what for, and start. It follows them round the
 * app in the corner pill like any other session.
 */
const LENGTHS = [25, 45, 60, 90]

export default function StudyTimer({ subjects = [], className = '' }) {
  const [minutes, setMinutes] = useState(25)
  const [subject, setSubject] = useState('')

  return (
    <section className={`rounded-[16px] border p-5 md:p-6 ${className}`} style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-[30rem]">
          <h2 className="text-[15px] font-semibold tracking-[-0.012em]">Study timer</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Studying on your own, in the app or from a book, notes or a paper? Start the timer and it counts towards your streak and your time studied, the same as a quiz.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LENGTHS.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              aria-pressed={minutes === m}
              className="rounded-full border px-3 py-1 text-[12.5px] font-medium tabular-nums transition-colors"
              style={minutes === m ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-tint)' } : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {m} min
            </button>
          ))}
          {subjects.length > 0 && (
            <Select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="What you are studying"
              className="input control-sm px-3 text-[16px] sm:text-[12.5px]"
              style={{ width: 190, maxWidth: '100%' }}
            >
              <option value="">Any subject</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>
      <div className="mt-5">
        <SessionTimer compact minutes={minutes} label={subject ? { subject } : null} />
      </div>
    </section>
  )
}
