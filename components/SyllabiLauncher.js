'use client'

import { useEffect, useRef, useState } from 'react'
import SyllabiMark from '@/components/SyllabiMark'

/**
 * Syllabi, on whatever page you are already on.
 *
 * It had a page of its own, which meant leaving the thing you wanted help
 * with in order to ask for help with it. This sits in the corner of every
 * signed-in page instead: press it, ask, carry on.
 *
 * Three fixed tasks rather than a chat box. That is not a limitation to be
 * lifted later — it is the reason the integrity rules hold. A free-form
 * prompt is a request to write somebody's essay waiting to happen, and the
 * shape of this panel is what makes "it comments, it does not compose" a
 * property of the product rather than a promise in a system prompt.
 */

const TASKS = [
  {
    key: 'draft_feedback',
    label: 'Read my draft',
    hint: 'Paste an IA, EE or TOK draft. You get what an examiner would say.',
    placeholder: 'Paste your draft.',
    rows: 9,
    minWords: 50,
  },
  {
    key: 'research_questions',
    label: 'Research questions',
    hint: 'Six directions, with what each would actually take.',
    placeholder: 'What are you interested in?',
    rows: 3,
    minWords: 0,
  },
  {
    key: 'study_advice',
    label: 'How do I study this?',
    hint: 'What to do this week, from what your quizzes show.',
    placeholder: 'Anything else worth knowing: a test date, what you find hard.',
    rows: 3,
    minWords: 0,
  },
]

export default function SyllabiLauncher({ subject = '', subjects = [], locked = false }) {
  const [open, setOpen] = useState(false)
  const [task, setTask] = useState(TASKS[0])
  const [chosenSubject, setChosenSubject] = useState('')
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy])

  // What the page is about, unless the student has picked something else.
  const subj = chosenSubject || subject || subjects[0] || ''

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  const ask = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setAnswer('')
    try {
      const res = await fetch('/api/syllabi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: task.key, text, subject: subj, kind: 'ia' }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'That did not work.')
      else setAnswer(data.answer)
    } catch {
      setError('Could not reach Syllabi. Check your connection.')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="press fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg"
        style={{
          borderColor: 'var(--brand)',
          background: 'var(--brand)',
          color: '#fff',
        }}
        aria-label="Ask Syllabi"
        title="Syllabi"
      >
        <SyllabiMark size={20} />
      </button>
    )
  }

  return (
    <div
      className="pop-enter fixed bottom-4 right-4 z-40 flex max-h-[80vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-[16px] border shadow-xl"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      role="dialog"
      aria-label="Syllabi"
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <SyllabiMark size={16} style={{ color: 'var(--brand)' }} />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">Syllabi</span>
        <div className="flex-1" />
        <button onClick={() => setOpen(false)} className="btn btn-quiet control-sm" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="overflow-y-auto p-4">
        <div className="flex flex-wrap gap-1.5">
          {TASKS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTask(t)
                setAnswer('')
                setError('')
              }}
              className={task.key === t.key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          {task.hint}
        </p>

        {subjects.length > 0 && (
          <select
            value={subj}
            onChange={(e) => setChosenSubject(e.target.value)}
            aria-label="Subject"
            className="input control-sm mt-3 w-full"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <textarea
          ref={boxRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={task.rows}
          placeholder={task.placeholder}
          className="input mt-3 w-full resize-y text-[13.5px]"
          style={{ height: 'auto', padding: '10px 12px' }}
        />

        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={ask}
            disabled={busy || words < task.minWords}
            className="btn btn-solid control-sm disabled:opacity-40"
          >
            {busy ? 'Reading…' : 'Ask'}
          </button>
          <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {words > 0 && `${words} words`}
            {task.minWords > 0 && words > 0 && words < task.minWords && ' · paste a bit more'}
          </span>
        </div>

        {error && (
          <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--danger)' }}>
            {error}
            {error.includes('Premium') && (
              <>
                {' '}
                <a href="/pricing" className="underline underline-offset-2">
                  See the plans
                </a>
                .
              </>
            )}
          </p>
        )}

        {answer && (
          <div
            className="mt-4 whitespace-pre-wrap rounded-[10px] border p-3 text-[13px] leading-relaxed"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)', color: 'var(--text-body)' }}
          >
            {answer}
          </div>
        )}

        <p className="mt-4 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          Syllabi comments on your work and never writes it.
        </p>
      </div>
    </div>
  )
}
