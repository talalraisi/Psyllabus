'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

/**
 * Was this any good? A thumb up or down on anything Syllabi writes, and on
 * the way down, what was wrong. It goes into the same feedback table as the
 * Feedback button (045-feedback.sql), as kind ai_good or ai_bad, so the
 * pilot shows which answers and marks miss, and how.
 *
 * What is kept: the tool, the subject, the reasons and note, and the start of
 * the answer Syllabi gave (or for marking, the mark). Never the student's
 * own draft or question.
 */

const REASONS = {
  tutor: ['Wrong', 'Not what I asked', 'Too long', 'Too vague', 'Not on my syllabus'],
  draft: ['Mark too high', 'Mark too low', 'Feedback too vague', 'Misread my work', 'Wrong criteria'],
  ideas: ['Not useful', 'Too generic', 'Not my subject', 'Wrong'],
}

const Thumb = ({ down = false, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down ? { transform: 'scaleY(-1)' } : undefined}>
    <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-7a2.5 2.5 0 0 1 2.6 3L13 10h5.6a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.2 21H7" />
  </svg>
)

export default function RateAnswer({ task = 'tutor', subject = '', answer = '', label = null, className = '' }) {
  const [state, setState] = useState(null) // null, 'down' (asking why), 'sending', 'sent', 'error'
  const [rating, setRating] = useState(null)
  const [reasons, setReasons] = useState([])
  const [note, setNote] = useState('')

  const send = async (good) => {
    setState('sending')
    try {
      const supabase = createClient()
      const user = await getCurrentUser(supabase)
      if (!user) return setState('error')
      const message = [
        `Syllabi ${task}: ${good ? 'good' : 'bad'}`,
        subject && `Subject: ${subject}`,
        !good && reasons.length && `Reasons: ${reasons.join(', ')}`,
        !good && note.trim() && `Note: ${note.trim().slice(0, 800)}`,
        answer && `Answer: ${String(answer).slice(0, 1200)}`,
      ]
        .filter(Boolean)
        .join('\n')
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        kind: good ? 'ai_good' : 'ai_bad',
        message: message.slice(0, 4000),
        path: typeof window === 'undefined' ? null : window.location.pathname.slice(0, 200),
        viewport: typeof window === 'undefined' ? null : `${window.innerWidth}x${window.innerHeight}`,
      })
      setState(error ? 'error' : 'sent')
    } catch {
      setState('error')
    }
  }

  const btn = (on) => `flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] transition-colors hover:bg-[var(--surface-sunken)] ${on ? 'bg-[var(--surface-sunken)]' : ''}`

  if (state === 'sent') {
    return (
      <span className={`flex h-7 items-center px-2 text-[12px] ${className}`} role="status" style={{ color: 'var(--text-faint)' }}>
        {rating === 'up' ? 'Thanks, noted.' : 'Thanks. That helps us fix it.'}
      </span>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-0.5">
        {label && (
          <span className="mr-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {label}
          </span>
        )}
        <button
          type="button"
          aria-label="Good answer"
          aria-pressed={rating === 'up'}
          disabled={state === 'sending'}
          onClick={() => {
            setRating('up')
            send(true)
          }}
          className={btn(rating === 'up')}
          style={{ color: rating === 'up' ? 'var(--brand)' : 'var(--text-faint)' }}
        >
          <Thumb />
        </button>
        <button
          type="button"
          aria-label="Bad answer"
          aria-pressed={rating === 'down'}
          aria-expanded={state === 'down'}
          onClick={() => {
            setRating('down')
            setState('down')
          }}
          className={btn(rating === 'down')}
          style={{ color: rating === 'down' ? 'var(--status-weak)' : 'var(--text-faint)' }}
        >
          <Thumb down />
        </button>
        {state === 'error' && (
          <span className="ml-1 text-[12px]" style={{ color: 'var(--status-weak)' }}>
            Could not send. Try again.
          </span>
        )}
      </div>

      {(state === 'down' || (state === 'sending' && rating === 'down')) && (
        <div className="sy-rise mt-2 max-w-md rounded-[12px] border p-3" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
            What was wrong?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(REASONS[task] || REASONS.tutor).map((r) => {
              const on = reasons.includes(r)
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReasons((list) => (on ? list.filter((x) => x !== r) : [...list, r]))}
                  className="rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
                  style={{ borderColor: on ? 'var(--brand)' : 'var(--border-strong)', background: on ? 'var(--brand-tint)' : 'transparent', color: on ? 'var(--text)' : 'var(--text-muted)' }}
                >
                  {r}
                </button>
              )
            })}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={800}
            placeholder="Anything else? (optional)"
            className="input mt-2 w-full resize-none px-3 py-2 text-[16px] sm:text-[13px]"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setState(null)} className="rounded-full px-3 py-1.5 text-[12.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => send(false)}
              disabled={state === 'sending' || (!reasons.length && !note.trim())}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--brand-solid)' }}
            >
              {state === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
