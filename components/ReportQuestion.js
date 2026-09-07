'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

/**
 * Tell us this question is wrong.
 *
 * You can check a hundred questions yourself. Students will sit thousands and
 * will hit the bad ones nobody sampled, so this turns every quiz into a
 * spot-check that costs nothing to run.
 *
 * Deliberately small and grey, next to the question rather than under it.
 * A prominent "is this wrong?" invites people to blame the question for their
 * own mistake, and a bank full of reports on perfectly good questions is the
 * same as no reports at all.
 *
 * Reasons are categories, not a text box, because "the answer is wrong" and
 * "this is not on my syllabus" need completely different fixes, and a pile of
 * undifferentiated complaints is unreadable at any volume.
 */
const REASONS = [
  { key: 'wrong_answer', label: 'The marked answer is wrong' },
  { key: 'unclear', label: 'I cannot tell what it is asking' },
  { key: 'off_syllabus', label: 'Not on my syllabus' },
  { key: 'typo', label: 'Broken text or symbols' },
  { key: 'other', label: 'Something else' },
]

export default function ReportQuestion({ questionId }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState('idle') // idle | saving | done | error

  const submit = async () => {
    if (!reason || state === 'saving') return
    setState('saving')
    const supabase = createClient()
    const user = await getCurrentUser(supabase)
    if (!user) return setState('error')

    const { error } = await supabase
      .from('question_reports')
      .insert({ question_id: questionId, user_id: user.id, reason, note: note.trim() || null })

    // A duplicate means they already reported this one, which is not a failure
    // worth showing them. Anything else is.
    if (error && error.code !== '23505') return setState('error')
    setState('done')
  }

  if (state === 'done') {
    return (
      <p className="t-caption mt-2 text-[var(--success-text)]">
        Thanks. We will look at this one.
      </p>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-[11px] text-[var(--text-faint)] underline underline-offset-2 hover:text-[var(--text-muted)]"
      >
        Something wrong with this question?
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-[var(--r-md)] border border-[var(--border-strong)] p-3">
      <p className="t-overline mb-2">What is wrong with it?</p>
      <div className="flex flex-col gap-1.5">
        {REASONS.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={`report-${questionId}`}
              checked={reason === r.key}
              onChange={() => setReason(r.key)}
              className="h-3.5 w-3.5 accent-[var(--brand)]"
            />
            <span className="text-xs text-[var(--text-body)]">{r.label}</span>
          </label>
        ))}
      </div>

      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything else worth knowing (optional)"
        className="input mt-3 w-full resize-y text-xs"
        style={{ height: 'auto', padding: '8px 12px' }}
      />

      {state === 'error' && (
        <p className="t-caption mt-2 text-[var(--danger)]">Could not send that. Try again.</p>
      )}

      <div className="mt-3 flex gap-2">
        <button onClick={() => setOpen(false)} className="btn btn-quiet control-sm text-xs">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!reason || state === 'saving'}
          className="btn btn-solid control-sm text-xs"
        >
          {state === 'saving' ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
