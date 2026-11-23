'use client'

/**
 * Onboarding, first step: the curriculum, the graduation year and, for the
 * IB, the exam session. Sessions run from now to May four years on.
 *
 * Every curriculum a student might say is on the list. Only the ones with a
 * syllabus here (lib/catalogue.js CURRICULUMS) go on; the others are told so
 * and can ask to hear when theirs arrives, which lands in the feedback inbox
 * as kind 'waitlist'.
 */

import { useState } from 'react'

// Exam sessions from now to May four years on: May (M) or November (N) and
// the year, so N27 is November 2027. A session drops off once its month
// begins, since by then nobody is starting to revise for it.
export function upcomingSessions(now = new Date()) {
  const first = now.getFullYear()
  const last = first + 4
  const out = []
  for (let year = first; year <= last; year++) {
    for (const [k, month, name] of [['M', 4, 'May'], ['N', 10, 'November']]) {
      if (year === last && k === 'N') continue
      if (new Date(year, month, 1) <= now) continue
      out.push({ key: `${k}${String(year).slice(2)}`, label: `${name} ${year}`, year })
    }
  }
  return out
}

// Every curriculum a student might say. Only those in CURRICULUMS have a
// syllabus here; the others are told so and can ask to hear when it arrives.
export const CURRICULUM_CHOICES = ['IB', 'A-Level', 'AP']

export default function StartStep({ curriculum, offered, gradYear, session, email, onCurriculum, onYear, onSession, onWaitlist, onContinue, now }) {
  const [sessions] = useState(() => upcomingSessions(now))
  const [waitlist, setWaitlist] = useState('') // '', 'sending', 'sent', 'error'

  return (
    <>
    <div className="mb-7">
      <p className="label" id="curriculum-label">
        Which curriculum are you studying?
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="curriculum-label">
        {CURRICULUM_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={curriculum === c}
            onClick={() => {
              if (c === curriculum) return
              onCurriculum(c)
              setWaitlist('')
            }}
            className={`rounded-full border py-3 text-[13.5px] font-semibold transition-colors duration-150 ${curriculum === c ? 'chip-active' : 'chip hover:border-border-strong'}`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>

    {curriculum && (
      <div className="mb-7 step-enter">
        <p className="label" id="gradyear-label">
          What year do you graduate?
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-labelledby="gradyear-label">
          {[...new Set(sessions.map((x) => x.year))].map((year) => {
            const on = gradYear === String(year)
            return (
              <button
                key={year}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  // May is when almost everyone sits; November is offered beside it.
                  const may = sessions.find((x) => x.year === year && x.key.startsWith('M'))
                  onYear(String(year), (may || sessions.find((x) => x.year === year))?.key || '')
                }}
                className={`rounded-full border py-3 text-[14px] font-semibold tabular-nums transition-colors duration-150 ${on ? 'chip-active' : 'chip hover:border-border-strong'}`}
              >
                {year}
              </button>
            )
          })}
        </div>
      </div>
    )}

    {offered && gradYear && (
      <div className="mb-8 step-enter">
        <p className="label" id="session-label">
          Which exam session do you sit?
        </p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="session-label">
          {sessions
            .filter((x) => String(x.year) === gradYear)
            .map((x) => {
              const on = session === x.key
              return (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSession(x.key)}
                  className={`flex flex-col items-center justify-center rounded-[16px] border py-2.5 transition-colors duration-150 ${on ? 'chip-active' : 'chip hover:border-border-strong'}`}
                >
                  <span className="text-[15px] font-semibold">{x.label}</span>
                  <span className="text-[11.5px] font-normal tabular-nums opacity-80">{x.key}</span>
                </button>
              )
            })}
        </div>
      </div>
    )}

    {curriculum && !offered ? (
      <div className="step-enter rounded-[14px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
        <p className="text-[14.5px] font-semibold">Psyllabus covers the IB for now</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          {curriculum} is not here yet. We can email {email || 'you'} the day it is.
        </p>
        {waitlist === 'sent' ? (
          <p className="mt-4 text-[13.5px] font-medium" role="status" style={{ color: 'var(--brand)' }}>
            Done. We will let you know.
          </p>
        ) : (
          <button
            type="button"
            disabled={!gradYear || waitlist === 'sending'}
            onClick={async () => {
              setWaitlist('sending')
              const ok = await onWaitlist(`Curriculum: ${curriculum}. Graduating ${gradYear}.`)
              setWaitlist(ok ? 'sent' : 'error')
            }}
            className="btn btn-solid control-md mt-4 w-full"
          >
            {waitlist === 'sending' ? 'Saving…' : gradYear ? 'Tell me when it is ready' : 'Pick your graduation year first'}
          </button>
        )}
        {waitlist === 'error' && (
          <p className="mt-2 text-[12.5px]" style={{ color: 'var(--status-weak)' }}>
            That did not save. Try again.
          </p>
        )}
      </div>
    ) : (
      <button
        onClick={onContinue}
        disabled={!offered || !gradYear || !session}
        className="btn btn-solid control-lg w-full text-base">
        Continue
      </button>
    )}
    </>
  )
}
