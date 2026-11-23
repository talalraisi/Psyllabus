'use client'

/**
 * Study reminders, two ways in:
 *
 *   <ReminderPrompt />   on Home, once a student has studied something: one
 *                        card asking to turn notifications on. Gone once it
 *                        is answered, either way.
 *   <ReminderSettings /> in Profile: reminder emails, and notifications on
 *                        this device.
 *
 * What gets sent, and when, is lib/reminders.js.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { invalidateProfile } from '@/lib/cache'
import { pushState, turnOnPush, turnOffPush } from '@/lib/push'

const DISMISSED = 'psyllabus:reminder-prompt'

const Bell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)

function usePush() {
  const [state, setState] = useState(null)
  useEffect(() => {
    let live = true
    pushState().then((s) => live && setState(s))
    return () => {
      live = false
    }
  }, [])
  return [state, setState]
}

const INSTALL_HINT = 'On iPhone, notifications work once Psyllabus is on your Home Screen: tap Share, then Add to Home Screen, and open it from there.'

export function ReminderPrompt({ profile, className = '' }) {
  const [state, setState] = usePush()
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(DISMISSED) === '1'
    } catch {
      return false
    }
  })

  if (hidden || !profile?.id || !['off', 'install'].includes(state)) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED, '1')
    } catch {
      /* the card just comes back next time */
    }
    setHidden(true)
  }

  return (
    <section
      className={`flex flex-wrap items-center gap-4 rounded-[16px] border px-5 py-4 ${className}`}
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      aria-label="Study reminders"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
        <Bell />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold">Get a nudge when it is time to study</p>
        <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          {state === 'install' ? INSTALL_HINT : 'One notification at most a day: when flashcards are due, or when it has been a few days. Never more.'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={dismiss} className="btn btn-quiet control-sm">
          {state === 'install' ? 'Got it' : 'Not now'}
        </button>
        {state === 'off' && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const s = await turnOnPush(createClient(), profile.id)
                setState(s)
                invalidateProfile()
                if (s !== 'off') dismiss()
              } catch {
                setState('off')
              }
              setBusy(false)
            }}
            className="btn btn-solid control-sm"
          >
            {busy ? 'Turning on…' : 'Turn on'}
          </button>
        )}
      </div>
    </section>
  )
}

function Switch({ on, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50"
      style={{ background: on ? 'var(--brand-solid)' : 'var(--border-strong)' }}
    >
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150" style={{ left: on ? 22 : 2 }} />
    </button>
  )
}

export function ReminderSettings({ profile, onChange }) {
  const [push, setPush] = usePush()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const email = profile?.email_reminders !== false

  const setEmail = async (on) => {
    setBusy('email')
    setError('')
    const { error: e } = await createClient().from('profiles').update({ email_reminders: on }).eq('id', profile.id)
    if (e) setError('That did not save. Try again.')
    else {
      invalidateProfile()
      onChange?.({ email_reminders: on })
    }
    setBusy('')
  }

  const setDevice = async (on) => {
    setBusy('push')
    setError('')
    try {
      setPush(on ? await turnOnPush(createClient(), profile.id) : await turnOffPush(createClient()))
    } catch {
      setError('Notifications could not be changed on this device.')
    }
    setBusy('')
  }

  const pushNote =
    push === 'blocked'
      ? 'Blocked in this browser’s settings. Allow notifications for psyllabus.app there, then come back.'
      : push === 'install'
        ? INSTALL_HINT
        : push === 'unsupported'
          ? 'This browser cannot show notifications.'
          : 'At most one a day: cards due, or a nudge after a few quiet days.'

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Reminder emails</p>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            A nudge every few days at most, and your week in numbers on Sundays.
          </p>
        </div>
        <Switch on={email} onChange={setEmail} label="Reminder emails" disabled={busy === 'email'} />
      </div>
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Notifications on this device</p>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {pushNote}
          </p>
        </div>
        {(push === 'on' || push === 'off') && <Switch on={push === 'on'} onChange={setDevice} label="Notifications on this device" disabled={busy === 'push'} />}
      </div>
      {error && (
        <p className="text-[13px]" role="alert" style={{ color: 'var(--status-weak)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
