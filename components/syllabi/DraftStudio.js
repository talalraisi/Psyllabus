'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ScoreRing, { ringColour } from '@/components/ScoreRing'
import { KINDS, rubricFor } from '@/lib/criteria'
import { segments } from '@/lib/draft-review'

/**
 * A draft, marked.
 *
 * Paste the whole thing into the big page on the left. Syllabi marks it
 * against the criteria and the right-hand side fills in: the total and a
 * likely grade, a ring per criterion, and numbered comments pinned to the
 * student's own sentences, which light up in the text. It never rewrites a
 * word of it (lib/syllabi-prompts.js).
 *
 * The draft and its review are kept in this tab only, so a refresh does not
 * lose an essay and a shared computer does not keep one.
 */

const STORE = 'psyllabus:draft-studio'
const MAX = 60000
const MIN_WORDS = 150

const KIND_STYLE = {
  issue: { colour: 'var(--status-weak)', label: 'Fix' },
  strength: { colour: 'var(--status-proficient)', label: 'Strong' },
  question: { colour: 'var(--status-developing)', label: 'Think' },
}

function read() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) || 'null') || {}
  } catch {
    return {}
  }
}

export default function DraftStudio({ subjects = [] }) {
  const [saved] = useState(() => (typeof window === 'undefined' ? {} : read()))
  const [subject, setSubject] = useState(saved.subject && subjects.includes(saved.subject) ? saved.subject : subjects[0] || '')
  const [kind, setKind] = useState(saved.kind || 'ia')
  const [text, setText] = useState(saved.text || '')
  const [review, setReview] = useState(saved.review || null)
  const [editing, setEditing] = useState(!saved.review)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(null)
  const [only, setOnly] = useState(null) // a criterion id, to show its highlights alone
  const [openCriterion, setOpenCriterion] = useState(null)
  const markRefs = useRef({})
  const noteRefs = useRef({})

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ subject, kind, text, review }))
    } catch {
      /* too big or blocked: it just will not survive a refresh */
    }
  }, [subject, kind, text, review])

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const rubric = rubricFor(kind, subject)
  const parts = useMemo(() => (review && !editing ? segments(text, review.highlights) : null), [review, editing, text])
  const shown = review ? review.highlights.map((h, n) => ({ ...h, n })).filter((h) => !only || h.criterion === only) : []
  const total = review ? review.criteria.reduce((a, c) => a + c.score, 0) : 0
  const outOf = review ? review.criteria.reduce((a, c) => a + c.max, 0) : 0

  const mark = async () => {
    if (busy || words < MIN_WORDS) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/syllabi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: 'draft_feedback', text, subject, kind }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.review) {
        setError(data.code === 'not_configured' ? 'Syllabi is being switched on. Try again soon.' : data.error || 'That did not work.')
      } else {
        setReview(data.review)
        setEditing(false)
        setActive(null)
        setOnly(null)
      }
    } catch {
      setError('Could not reach Syllabi. Check your connection.')
    }
    setBusy(false)
  }

  const focusNote = (n) => {
    setActive(n)
    noteRefs.current[n]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  const focusMark = (n) => {
    setActive(n)
    markRefs.current[n]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const grade = review?.grade_estimate

  return (
    <div>
      {/* What it is, and the button. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {subjects.length > 0 && (
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={busy}
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
        <div className="flex rounded-[10px] p-0.5" style={{ background: 'var(--surface-sunken)' }}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              disabled={busy}
              aria-pressed={kind === k.key}
              className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors"
              style={kind === k.key ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.12)' } : { color: 'var(--text-muted)' }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {words.toLocaleString()} words
        </span>
        {review && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-outline control-md">
            Edit draft
          </button>
        ) : (
          <button type="button" onClick={mark} disabled={busy || words < MIN_WORDS} className="btn btn-solid control-md disabled:opacity-40">
            {busy ? 'Marking…' : review ? 'Mark again' : 'Get feedback'}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-[13px]" style={{ color: 'var(--status-weak)' }} role="alert">
          {error}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* The page. */}
        <div className="rounded-[16px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          {editing || !review ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              disabled={busy}
              placeholder="Paste your draft here."
              aria-label="Your draft"
              spellCheck
              className="block min-h-[68vh] w-full resize-y rounded-[16px] bg-transparent px-6 py-5 text-[16px] leading-[1.8] outline-none placeholder:text-[var(--text-faint)] sm:px-8 sm:py-7 sm:text-[15px]"
              style={{ color: 'var(--text-body)' }}
            />
          ) : (
            <div className="min-h-[68vh] whitespace-pre-wrap px-6 py-5 text-[15px] leading-[1.9] sm:px-8 sm:py-7" style={{ color: 'var(--text-body)' }}>
              {parts.map((p, i) => {
                if (p.n === undefined) return <span key={i}>{p.text}</span>
                const h = review.highlights[p.n]
                const style = KIND_STYLE[h.kind]
                const dim = only && h.criterion !== only
                const on = active === p.n
                return (
                  <mark
                    key={i}
                    ref={(el) => {
                      markRefs.current[p.n] = el
                    }}
                    onClick={() => focusNote(p.n)}
                    title={h.comment}
                    className="cursor-pointer rounded-[3px] px-0.5 transition-colors"
                    style={{
                      color: 'inherit',
                      background: dim ? 'transparent' : `color-mix(in srgb, ${style.colour} ${on ? 30 : 15}%, transparent)`,
                      boxShadow: dim ? 'none' : `inset 0 -2px 0 ${style.colour}`,
                      outline: on ? `2px solid ${style.colour}` : 'none',
                      outlineOffset: 1,
                    }}
                  >
                    {p.text}
                    {!dim && (
                      <sup className="ml-0.5 text-[10px] font-semibold" style={{ color: style.colour }}>
                        {p.n + 1}
                      </sup>
                    )}
                  </mark>
                )
              })}
            </div>
          )}
        </div>

        {/* The marks. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-48px)] lg:overflow-y-auto lg:pb-2">
          {busy ? (
            <div className="rounded-[16px] border p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 animate-pulse rounded-full" style={{ background: 'var(--surface-sunken)' }} />
                <div className="flex-1">
                  <p className="text-[14px] font-semibold">Reading your draft</p>
                  <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                    About half a minute.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-[10px]" style={{ background: 'var(--surface-sunken)', animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          ) : !review ? (
            <div className="rounded-[16px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-[14px] font-semibold">Marked against the criteria</p>
              <ul className="mt-3 flex flex-col gap-2">
                {(rubric?.criteria || []).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 text-[13px]">
                    <ScoreRing value={0} max={c.max} size={32} stroke={3}>
                      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                        {c.id}
                      </span>
                    </ScoreRing>
                    <span className="flex-1" style={{ color: 'var(--text-body)' }}>
                      {c.name}
                    </span>
                    <span className="tabular-nums" style={{ color: 'var(--text-faint)' }}>
                      /{c.max}
                    </span>
                  </li>
                ))}
                {!rubric && (
                  <li className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                    The IB criteria for {subject || 'your subject'}.
                  </li>
                )}
              </ul>
              <p className="mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                {words < MIN_WORDS ? `Paste at least ${MIN_WORDS} words.` : 'Ready when you are.'}
              </p>
            </div>
          ) : (
            <>
              {/* Total and grade. */}
              <div className="rounded-[16px] border p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                <div className="flex items-center gap-5">
                  <ScoreRing value={total} max={outOf} size={96} stroke={7}>
                    <span className="text-[24px] font-semibold leading-none tracking-[-0.02em]">{total}</span>
                    <span className="mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      of {outOf}
                    </span>
                  </ScoreRing>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
                      Likely grade
                    </p>
                    <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.03em]" style={{ color: ringColour(outOf ? total / outOf : 0) }}>
                      {grade || '–'}
                    </p>
                  </div>
                </div>
                {review.grade_note && (
                  <p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {review.grade_note}
                  </p>
                )}
                <p className="mt-3 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  An estimate, not a mark.{!review.known && ' Criteria as Syllabi knows them, so check your subject guide.'}
                </p>
              </div>

              {/* Each criterion. */}
              <div className="rounded-[16px] border p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                {review.criteria.map((c) => {
                  const open = openCriterion === c.id
                  return (
                    <div key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCriterion(open ? null : c.id)
                          setOnly(open ? null : c.id)
                        }}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                        style={open ? { background: 'var(--surface-sunken)' } : undefined}
                      >
                        <ScoreRing value={c.score} max={c.max} size={40} stroke={3.5}>
                          <span className="text-[12px] font-semibold">{c.score}</span>
                        </ScoreRing>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                            Criterion {c.id}
                          </span>
                          <span className="block truncate text-[13px] font-medium">{c.name}</span>
                        </span>
                        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                          /{c.max}
                        </span>
                      </button>
                      {open && c.comment && (
                        <p className="px-3 pb-3 pt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                          {c.comment}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Pinned to the text. */}
              {shown.length > 0 && (
                <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[13px] font-semibold">In your draft</p>
                    {only && (
                      <button type="button" onClick={() => { setOnly(null); setOpenCriterion(null) }} className="text-[12px] font-medium text-[var(--brand)] hover:underline">
                        Show all
                      </button>
                    )}
                  </div>
                  <ol className="flex flex-col gap-1">
                    {shown.map((h) => {
                      const style = KIND_STYLE[h.kind]
                      const on = active === h.n
                      return (
                        <li key={h.n}>
                          <button
                            type="button"
                            ref={(el) => {
                              noteRefs.current[h.n] = el
                            }}
                            onClick={() => focusMark(h.n)}
                            className="flex w-full gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                            style={on ? { background: 'var(--surface-sunken)' } : undefined}
                          >
                            <span
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold"
                              style={{ background: `color-mix(in srgb, ${style.colour} 20%, transparent)`, color: style.colour }}
                            >
                              {h.n + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[11px] font-semibold" style={{ color: style.colour }}>
                                {style.label}
                                {h.criterion && <span style={{ color: 'var(--text-faint)' }}> · {h.criterion}</span>}
                              </span>
                              <span className="block text-[12.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                                {h.comment}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}

              {/* What to do with it. */}
              <div className="rounded-[16px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                {review.next_step && (
                  <div className="rounded-[10px] px-3 py-2.5" style={{ background: 'var(--brand-tint)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--brand)' }}>
                      Do this first
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed">{review.next_step}</p>
                  </div>
                )}
                {review.questions.length > 0 && (
                  <>
                    <p className="mt-4 text-[13px] font-semibold">Answer these in your next draft</p>
                    <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      {review.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </>
                )}
                {review.strengths.length > 0 && (
                  <>
                    <p className="mt-4 text-[13px] font-semibold">Keep</p>
                    <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      {review.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </>
          )}
          <p className="px-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            Syllabi comments on your work and never writes it.
          </p>
        </aside>
      </div>
    </div>
  )
}
