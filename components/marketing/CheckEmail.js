'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/marketing/AuthShell'

/**
 * After signing up with email: the link is on its way.
 *
 * The steps in order, and sending again on a short wait (Supabase allows one a minute, so
 * the button says how long rather than failing). Only the newest email's link
 * works, which is the thing people trip on, so it says that once it matters.
 */

const FROM = 'hello@psyllabus.app'
const WAIT = 60

const time = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function CheckEmail({ email, onResend, onChangeEmail }) {
  const [wait, setWait] = useState(WAIT)
  const [sending, setSending] = useState(false)
  const [sentAgain, setSentAgain] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const resend = async () => {
    if (sending || wait > 0) return
    setSending(true)
    setError('')
    const problem = await onResend()
    setSending(false)
    if (problem) {
      // "…you can only request this after 42 seconds": wait, don't fail.
      const secs = Number(/after (\d+) second/.exec(problem)?.[1])
      if (secs) setWait(secs)
      else setError(problem)
      return
    }
    setSentAgain(new Date())
    setWait(WAIT)
  }

  const steps = [
    <>Open the email from <span className="font-medium text-[var(--text)]">Psyllabus</span></>,
    <>Tap <span className="font-medium text-[var(--text)]">Confirm my email</span></>,
    <>You land in setup, signed in</>,
  ]

  return (
    <AuthShell
      eyebrow="Almost there"
      title="Check your email"
      footer={
        <>
          Already confirmed?{' '}
          <Link href="/login" className="font-medium" style={{ color: 'var(--brand)' }}>
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="m3.8 6.5 8.2 6.2 8.2-6.2" />
          </svg>
        </span>
        <p className="mt-4 text-[14px]" style={{ color: 'var(--text-body)' }}>
          We sent a link to
        </p>
        <p className="mt-1 max-w-full break-all text-[16px] font-semibold">{email}</p>
      </div>

      <ol className="mt-6 space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-[13.5px]" style={{ color: 'var(--text-body)' }}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Not there after a minute? Look in spam or promotions for an email from {FROM}.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resend}
            disabled={sending || wait > 0}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)] disabled:cursor-default disabled:hover:bg-transparent"
            style={{ borderColor: 'var(--border-strong)', color: wait > 0 || sending ? 'var(--text-faint)' : 'var(--text)' }}
          >
            {sending ? 'Sending…' : wait > 0 ? `Send again in ${wait}s` : 'Send again'}
          </button>
          <button type="button" onClick={onChangeEmail} className="text-[13px] font-medium hover:underline" style={{ color: 'var(--brand)' }}>
            Wrong address?
          </button>
        </div>

        {sentAgain && !error && (
          <p className="mt-3 text-[12.5px] leading-relaxed" role="status" style={{ color: 'var(--text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--brand)' }}>
              Sent again at {time(sentAgain)}.
            </span>{' '}
            Use the newest email: the link in an older one no longer works.
          </p>
        )}
        {error && <div className="error-box mt-3">{error}</div>}
      </div>
    </AuthShell>
  )
}
