'use client'

/**
 * The two doors of the calendar ecosystem, kept short.
 *
 * In: paste your calendar's private link and the plan works around it.
 * Out: one link that puts your study plan on your phone.
 *
 * The first version explained everything up front and read as a wall of
 * text. Each half is now a title, one line, and the action; the
 * step-by-step for each provider is behind "How?" for whoever needs it.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

const STEPS = {
  Google: ['Open calendar.google.com on a computer', 'Settings → your calendar → Integrate calendar', 'Copy "Secret address in iCal format"'],
  Apple: ['Calendar app → Calendars → ⓘ next to your calendar', 'Turn on Public Calendar → Share Link → Copy'],
  Outlook: ['outlook.com → Settings → Calendar → Shared calendars', 'Publish a calendar → copy the ICS link'],
}
const SUBSCRIBE = {
  Google: 'calendar.google.com → + next to Other calendars → From URL → paste',
  Outlook: 'Add calendar → Subscribe from web → paste',
}

const ago = (iso) => {
  if (!iso) return 'not yet'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

function How({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-[12px] font-medium text-[var(--brand)] hover:underline">
        {open ? 'Hide' : 'How?'}
      </button>
      {open && <div className="mt-2 text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{children}</div>}
    </div>
  )
}

export default function CalendarConnections({ connections, feedToken, origin, onChanged }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  const connect = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy('connect')
    setError(null)
    // Named from the link itself, so there is one box to fill in, not two.
    const name = /google/i.test(url) ? 'Google Calendar' : /icloud|apple/i.test(url) ? 'Apple Calendar' : /outlook|office|live\.com/i.test(url) ? 'Outlook' : 'My calendar'
    const res = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, label: name }),
    }).catch(() => null)
    const body = await res?.json().catch(() => ({}))
    setBusy(null)
    if (!res?.ok) {
      setError(body?.error || 'That did not work. Try again.')
      return
    }
    setUrl('')
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-[14px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h3 className="text-[14px] font-semibold">Connect your calendar</h3>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          Your plan works around it.
        </p>

        {connections.map((c) => (
          <div key={c.id} className="mt-3 flex items-center justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate">
              <span className="font-medium">{c.label}</span>
              <span style={{ color: c.last_error ? 'var(--status-weak)' : 'var(--text-faint)' }}> · {c.last_error ? 'needs a new link' : ago(c.last_synced_at)}</span>
            </span>
            <button type="button" onClick={() => disconnect(c)} disabled={busy === c.id} className="shrink-0 hover:underline" style={{ color: 'var(--text-muted)' }}>
              Remove
            </button>
          </div>
        ))}

        <form onSubmit={connect} className="mt-3 flex gap-2">
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your calendar link"
            aria-label="Private calendar link"
            className="input h-9 flex-1 px-3 text-[16px] sm:text-[13px]"
          />
          <button type="submit" disabled={!url.trim() || busy === 'connect'} className="btn btn-solid control-sm shrink-0">
            {busy === 'connect' ? '…' : 'Connect'}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-[12px]" style={{ color: 'var(--status-weak)' }}>
            {error}
          </p>
        )}
        <How>
          {Object.entries(STEPS).map(([name, steps]) => (
            <p key={name} className="mb-1.5">
              <span className="font-medium" style={{ color: 'var(--text-body)' }}>{name}:</span> {steps.join(' → ')}
            </p>
          ))}
          <p style={{ color: 'var(--text-faint)' }}>Only times and titles are read.</p>
        </How>
      </section>

      <section className="rounded-[14px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h3 className="text-[14px] font-semibold">Plan on your phone</h3>
        <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          Study blocks and tests in your phone&apos;s calendar.
        </p>

        {!feedToken ? (
          <button type="button" onClick={() => makeFeed()} disabled={busy === 'feed'} className="btn btn-solid control-sm mt-3">
            Get link
          </button>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={feedUrl.replace(/^https?:/, 'webcal:')} className="btn btn-solid control-sm">
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
            <How>
              {Object.entries(SUBSCRIBE).map(([name, step]) => (
                <p key={name} className="mb-1.5">
                  <span className="font-medium" style={{ color: 'var(--text-body)' }}>{name}:</span> {step}
                </p>
              ))}
              <p style={{ color: 'var(--text-faint)' }}>
                Keep the link private.{' '}
                <button type="button" onClick={() => makeFeed(true)} className="underline">
                  New link
                </button>
              </p>
            </How>
          </>
        )}
      </section>
    </div>
  )
}
