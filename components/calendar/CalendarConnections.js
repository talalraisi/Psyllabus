'use client'

/**
 * The two doors of the calendar ecosystem.
 *
 * In: connect your own calendar by its private link, so the plan schedules
 * around your life and offers your tests as Psyllabus tests. Out: a private
 * subscription link that puts your study plan and test dates into the
 * calendar on your phone.
 *
 * The private link is the fiddly part for a student, so each provider gets
 * its exact steps. Once pasted it is never shown back: a calendar's private
 * address is a key to it, and the screen is somewhere other people look.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

const PROVIDERS = {
  google: {
    name: 'Google Calendar',
    steps: [
      'On a computer, open calendar.google.com.',
      'Click the gear icon, then Settings.',
      'On the left, under "Settings for my calendars", click your calendar.',
      'Scroll to "Integrate calendar" and copy "Secret address in iCal format".',
    ],
  },
  apple: {
    name: 'Apple Calendar',
    steps: [
      'On your iPhone, open Calendar and tap Calendars at the bottom.',
      'Tap the ⓘ next to your calendar.',
      'Turn on "Public Calendar", then tap "Share Link…" and Copy.',
      'Anyone with that link can see that calendar, so keep it to yourself.',
    ],
  },
  outlook: {
    name: 'Outlook',
    steps: [
      'Open outlook.com (or Outlook on the web) and go to Settings → Calendar.',
      'Choose "Shared calendars", then "Publish a calendar".',
      'Pick your calendar and "Can view all details", then Publish.',
      'Copy the ICS link.',
    ],
  },
}

const ago = (iso) => {
  if (!iso) return 'not yet'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

const field = 'input h-9 px-3 text-[16px] sm:text-[13px]'

export default function CalendarConnections({ connections, feedToken, origin, onChanged }) {
  const [provider, setProvider] = useState('google')
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(null) // 'connect' | 'sync' | 'feed' | connection id
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  const connect = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy('connect')
    setError(null)
    const res = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, label: label || PROVIDERS[provider].name }),
    }).catch(() => null)
    const body = await res?.json().catch(() => ({}))
    setBusy(null)
    if (!res?.ok) {
      setError(body?.error || 'That did not work. Check your connection and try again.')
      return
    }
    setUrl('')
    setLabel('')
    onChanged?.()
  }

  const syncNow = async () => {
    setBusy('sync')
    setError(null)
    await fetch('/api/calendar/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ force: true }) }).catch(() => null)
    setBusy(null)
    onChanged?.()
  }

  const disconnect = async (c) => {
    setBusy(c.id)
    // Its imported events go with it (ON DELETE CASCADE).
    await supabase.from('calendar_connections').delete().eq('id', c.id)
    setBusy(null)
    onChanged?.()
  }

  const makeFeed = async (fresh = false) => {
    setBusy('feed')
    if (fresh) await supabase.from('calendar_feeds').delete().not('token', 'is', null)
    await supabase.from('calendar_feeds').insert({})
    setBusy(null)
    setCopied(false)
    onChanged?.()
  }

  const feedUrl = feedToken ? `${origin}/api/calendar/feed/${feedToken}.ics` : null
  const webcal = feedUrl?.replace(/^https?:/, 'webcal:')

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[14px] border p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <h3 className="text-[14px] font-semibold tracking-[-0.01em]">Your calendar, in your plan</h3>
        <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Connect the calendar you already use. Your plan works around everything in it, and anything that looks like a
          test is offered as one. Only times and titles are read — never locations, notes or who is invited.
        </p>

        {connections.length > 0 && (
          <ul className="mt-4 flex flex-col">
            {connections.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{c.label}</p>
                  <p className="text-[11.5px]" style={{ color: c.last_error ? 'var(--status-weak)' : 'var(--text-muted)' }}>
                    {c.last_error ? c.last_error : `${c.event_count} event${c.event_count === 1 ? '' : 's'} in the next six weeks · updated ${ago(c.last_synced_at)}`}
                  </p>
                </div>
                <button type="button" onClick={() => disconnect(c)} disabled={busy === c.id} className="shrink-0 text-[12px] font-medium hover:underline" style={{ color: 'var(--text-muted)' }}>
                  {busy === c.id ? 'Removing…' : 'Disconnect'}
                </button>
              </li>
            ))}
            <li className="pt-2">
              <button type="button" onClick={syncNow} disabled={busy === 'sync'} className="text-[12px] font-medium text-[var(--brand)] hover:underline">
                {busy === 'sync' ? 'Updating…' : 'Update now'}
              </button>
            </li>
          </ul>
        )}

        <form onSubmit={connect} className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <div role="tablist" aria-label="Where your calendar is" className="flex flex-wrap gap-1.5">
            {Object.entries(PROVIDERS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={provider === key}
                onClick={() => setProvider(key)}
                className="rounded-full border px-3 py-1 text-[12px] transition-colors"
                style={{
                  borderColor: provider === key ? 'var(--brand)' : 'var(--border)',
                  background: provider === key ? 'color-mix(in srgb, var(--brand) 10%, var(--surface))' : 'var(--surface)',
                  color: provider === key ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {PROVIDERS[provider].steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <input
            type="text"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Name it (optional) — e.g. School timetable`}
            aria-label="Name for this calendar"
            className={`${field} mt-3 w-full`}
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste the link here"
              aria-label="Private calendar link"
              className={`${field} flex-1`}
            />
            <button type="submit" disabled={!url.trim() || busy === 'connect'} className="btn btn-solid control-sm shrink-0">
              {busy === 'connect' ? 'Reading it…' : 'Connect'}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[12.5px]" style={{ color: 'var(--status-weak)' }}>
              {error}
            </p>
          )}
        </form>
      </section>

      <section className="rounded-[14px] border p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <h3 className="text-[14px] font-semibold tracking-[-0.01em]">Your plan, in your calendar</h3>
        <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Subscribe once and your study blocks and test dates appear in the calendar on your phone, with their reminders,
          and keep themselves up to date.
        </p>

        {!feedToken ? (
          <button type="button" onClick={() => makeFeed()} disabled={busy === 'feed'} className="btn btn-solid control-sm mt-4">
            {busy === 'feed' ? 'Making your link…' : 'Get my calendar link'}
          </button>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              <a href={webcal} className="btn btn-solid control-sm">
                Add to Apple Calendar
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(feedUrl)
                    setCopied(true)
                  } catch {
                    setCopied(false)
                  }
                }}
                className="btn btn-outline control-sm"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              <li>
                <span className="font-medium">Google Calendar:</span> on a computer, click + next to “Other calendars”, choose
                “From URL”, and paste the link. Google updates it on its own schedule, sometimes only once a day.
              </li>
              <li>
                <span className="font-medium">Outlook:</span> Add calendar → Subscribe from web, and paste the link.
              </li>
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
              Anyone with this link can see your study plan and test dates, so do not share it. If it gets out,{' '}
              <button type="button" onClick={() => makeFeed(true)} disabled={busy === 'feed'} className="font-medium underline">
                make a new one
              </button>{' '}
              and the old one stops working.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
