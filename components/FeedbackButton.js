'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { IconClose, IconCheck } from '@/components/Icons'
import { Spinner } from '@/components/PageShell'

/**
 * The way back from a beta tester.
 *
 * Reporting a bad question already exists, which covers the one case somebody
 * anticipated. A page that makes no sense, a button that does nothing, a
 * subject with nothing in it, an idea — all of that had nowhere to go, so
 * thirty classmates would form an opinion and none of it would arrive.
 *
 * It asks for one thing: what happened. The kind is four buttons because
 * sorting is your job, not theirs, and everything else — which page, what size
 * screen — is taken automatically, because "it's broken" with no idea where is
 * a report nobody can act on and asking where they were is asking them to do
 * the work.
 *
 * The path is captured without its query string. On this app that carries
 * subject and subtopic names, and on the quiz it carries what somebody is
 * sitting; none of that belongs in a bug report.
 */

const KINDS = [
  { key: 'problem', label: 'Something broke' },
  { key: 'confusing', label: 'Confusing' },
  { key: 'idea', label: 'An idea' },
  { key: 'other', label: 'Something else' },
]

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('problem')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const pathname = usePathname()
  const supabase = createClient()
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    boxRef.current?.querySelector('textarea')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const send = async () => {
    const text = message.trim()
    if (!text || sending) return
    setSending(true)
    setError('')

    const user = await getCurrentUser(supabase)
    if (!user) {
      setError('Sign in first and it will send.')
      setSending(false)
      return
    }

    const { error: insertError } = await supabase.from('feedback').insert({
      user_id: user.id,
      kind,
      message: text.slice(0, 4000),
      // Path only. The query string on this app names subjects, subtopics and
      // whatever paper somebody is halfway through.
      path: pathname?.slice(0, 200) || null,
      viewport:
        typeof window === 'undefined' ? null : `${window.innerWidth}x${window.innerHeight}`,
    })

    setSending(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSent(true)
    setMessage('')
    setTimeout(() => {
      setSent(false)
      setOpen(false)
    }, 1600)
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-40 rounded-full border px-4 py-2.5 text-[12.5px] font-medium shadow-sm transition-colors duration-150"
        style={{
          borderColor: 'var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text-body)',
        }}
      >
        Feedback
      </button>

      {open && (
        <div
          ref={boxRef}
          role="dialog"
          aria-label="Send feedback"
          className="fixed bottom-16 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-[14px] border p-5 shadow-lg"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[14.5px] font-semibold">What happened?</p>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                It goes straight to Talal. Which page you are on is sent with it.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="shrink-0"
              style={{ color: 'var(--text-faint)' }}
            >
              <IconClose width={14} height={14} />
            </button>
          </div>

          {sent ? (
            <p
              className="flex items-center gap-2 py-4 text-[13.5px]"
              style={{ color: 'var(--status-proficient)' }}
            >
              <IconCheck width={14} height={14} />
              Sent. Thank you.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => setKind(k.key)}
                    aria-pressed={kind === k.key}
                    className={
                      kind === k.key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'
                    }
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={message}
                maxLength={4000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say as much or as little as you like."
                className="input w-full resize-y"
                style={{ height: 'auto', padding: '10px 12px', lineHeight: 1.55 }}
              />

              {error && (
                <p className="mt-2 text-[12.5px]" style={{ color: 'var(--danger)' }}>
                  {error}
                </p>
              )}

              <button
                onClick={send}
                disabled={!message.trim() || sending}
                className="btn btn-solid control-md mt-3 w-full disabled:opacity-40"
              >
                {sending && <Spinner size={14} />}
                {sending ? 'Sending' : 'Send'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
