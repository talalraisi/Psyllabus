'use client'

import { useState } from 'react'
import { isUsefulScheme, marksInScheme, markschemeProfile } from '@/lib/markscheme'

/**
 * What the marks were for.
 *
 * After a six-mark question, "the answer is the Keynesian multiplier" is not
 * feedback. The useful thing is the list an examiner works down: name it,
 * explain the mechanism, apply it to the case. A student can hold their own
 * answer against that and see which line they never wrote.
 *
 * Collapsed by default. It is long by nature, and a student who got full marks
 * does not need to read it — but the one who got three out of six wants it
 * immediately, so it is one click and never a different page.
 *
 * Mark schemes are marked as a guide rather than a grader. Nothing here scores
 * the student's writing: self-marking against a list is honest work, and a
 * machine that claimed to award the marks would be neither honest nor right.
 */
export default function MarkScheme({ question }) {
  const [open, setOpen] = useState(false)
  const scheme = question?.markscheme
  const marks = question?.marks || 1

  if (!scheme || !isUsefulScheme(scheme, marks)) return null

  const total = marksInScheme(scheme)
  const profile = markschemeProfile(question.subject || '')

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[12.5px] font-medium underline-offset-2 hover:underline"
        style={{ color: 'var(--text-muted)' }}
      >
        {open ? 'Hide mark scheme' : `Mark scheme (${total || marks} marks)`}
      </button>

      {open && (
        <div
          className="pop-enter mt-2 rounded-[var(--r-md)] border p-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
        >
          {scheme.command_term && (
            <p className="t-overline mb-2">{scheme.command_term}</p>
          )}

          <ul className="flex flex-col gap-1.5">
            {scheme.points.map((point, i) => (
              <li key={i} className="flex items-baseline gap-2.5">
                <span
                  className="shrink-0 text-[11.5px] tabular-nums"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {point.marks || 1}
                </span>
                <span className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                  {point.point}
                </span>
              </li>
            ))}
          </ul>

          {scheme.guidance && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
              {scheme.guidance}
            </p>
          )}

          <p className="mt-2.5 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            {profile.style === 'criteria'
              ? 'Marked on criteria, so these are what a strong answer does rather than a checklist.'
              : 'Mark your own answer against these. Nothing here is scored automatically.'}
          </p>
        </div>
      )}
    </div>
  )
}
