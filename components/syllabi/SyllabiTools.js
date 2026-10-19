'use client'

import { useState } from 'react'

/**
 * Syllabi's idea tools: research question directions and study advice. Set
 * tasks rather than a chat box, because each one suggests and never composes
 * (lib/syllabi-prompts.js). Drafts have their own page (DraftStudio).
 */

const TASKS = [
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

export default function SyllabiTools({ subjects = [] }) {
  const [task, setTask] = useState(TASKS[0])
  const [subject, setSubject] = useState(subjects[0] || '')
  const [kind, setKind] = useState('ia')
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const limit = 2000

  const ask = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setAnswer('')
    try {
      const res = await fetch('/api/syllabi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: task.key, text, subject, kind }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.code === 'not_configured' ? 'Syllabi is being switched on. Try again soon.' : data.error || 'That did not work.')
      else setAnswer(data.answer)
    } catch {
      setError('Could not reach Syllabi. Check your connection.')
    }
    setBusy(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap gap-1.5">
        {TASKS.map((t) => (
          <button
            key={t.key}
            type="button"
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

      <p className="mt-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
        {task.hint}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {subjects.length > 0 && (
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Subject"
            className="input h-9 w-auto max-w-[16rem] px-3 text-[16px] sm:text-[13px]"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {task.key !== 'study_advice' && (
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="What it is"
            className="input h-9 w-auto px-3 text-[16px] sm:text-[13px]"
          >
            <option value="ia">IA</option>
            <option value="ee">Extended Essay</option>
          </select>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, limit))}
        rows={task.rows}
        placeholder={task.placeholder}
        className="input mt-3 w-full resize-y text-[16px] sm:text-[14px]"
        style={{ height: 'auto', padding: '10px 12px' }}
      />

      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={ask} disabled={busy || words < task.minWords} className="btn btn-solid control-md disabled:opacity-40">
          {busy ? 'Reading…' : 'Ask'}
        </button>
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {words > 0 && `${words} words`}
          {task.minWords > 0 && words > 0 && words < task.minWords && ' · paste a bit more'}
        </span>
      </div>

      {error && (
        <p className="mt-3 text-[13px]" style={{ color: 'var(--status-weak)' }} role="alert">
          {error}
        </p>
      )}

      {answer && (
        <div
          className="mt-5 whitespace-pre-wrap rounded-[12px] border p-4 text-[14px] leading-relaxed"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)', color: 'var(--text-body)' }}
        >
          {answer}
        </div>
      )}

      <p className="mt-4 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
        Syllabi suggests directions and never writes your work.
      </p>
    </div>
  )
}
