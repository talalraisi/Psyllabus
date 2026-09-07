'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSyllabus } from '@/lib/cache'
import { papersFor, typesForStyle } from '@/lib/papers'
import { IconClose, IconClock } from '@/components/Icons'

/**
 * Choose a paper, then sit it.
 *
 * The point of this screen is that it counts first. A paper offered with no
 * questions behind it is worse than no paper at all, so each one shows what the
 * bank can actually field and says when that is short of the real thing. It is
 * the difference between "Paper 1, 40 questions, 2 hours" and "Paper 1, we have
 * 6 questions, this will take 9 minutes", and a student deserves to know which
 * one they are about to sit.
 */
export default function PaperPicker({ open, onClose, subject, curriculum, backHref }) {
  const [pool, setPool] = useState(null) // null while loading
  const [hlBySubtopic, setHlBySubtopic] = useState({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!open || !subject) return
    let cancelled = false
    setPool(null)

    async function load() {
      const [syllabus, { data: questions }] = await Promise.all([
        getSyllabus(supabase, [subject]),
        supabase
          .from('questions')
          .select('id, subtopic, question_type, time_budget_seconds, marks')
          .eq('subject', subject)
          .eq('verified', true),
      ])
      if (cancelled) return
      const hl = {}
      for (const row of syllabus || []) hl[row.subtopic] = !!row.hl_only
      setHlBySubtopic(hl)
      setPool(questions || [])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, subject, supabase])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const papers = useMemo(() => papersFor(subject, curriculum), [subject, curriculum])

  /** What the bank can actually field for each paper. */
  const availability = useMemo(() => {
    if (!pool) return {}
    const out = {}
    for (const p of papers) {
      const types = typesForStyle(p.style)
      const matching = pool.filter((q) => {
        if (types && !types.includes(q.question_type || 'mcq')) return false
        if (p.scope === 'hl' && !hlBySubtopic[q.subtopic]) return false
        return true
      })
      const drawn = matching.slice(0, p.target)
      out[p.id] = {
        available: matching.length,
        drawn: drawn.length,
        minutes: Math.max(
          1,
          Math.round(drawn.reduce((s, q) => s + (q.time_budget_seconds || 90), 0) / 60)
        ),
      }
    }
    return out
  }, [pool, papers, hlBySubtopic])

  if (!open) return null

  const start = (paper) => {
    const params = new URLSearchParams({
      subject,
      mode: 'paper',
      paper: paper.id,
      back: backHref || '/dashboard',
      timed: '1',
    })
    router.push(`/dashboard/quiz?${params.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Choose a paper">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-raised)] sm:rounded-[var(--r-lg)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--text)]">Sit a paper</h2>
            <p className="t-caption mt-1">{subject}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {papers.length === 0 ? (
            <p className="t-small">
              This subject is assessed by coursework, so there is no written paper to sit. Practise
              by subtopic instead.
            </p>
          ) : pool === null ? (
            <p className="t-small">Checking what we can field…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {papers.map((p) => {
                const a = availability[p.id] || { available: 0, drawn: 0, minutes: 0 }
                const empty = a.drawn === 0
                const short = !empty && a.drawn < p.target

                return (
                  <div
                    key={p.id}
                    className={`rounded-[var(--r-md)] border p-4 ${
                      empty ? 'border-[var(--border)] opacity-60' : 'border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[var(--text)]">{p.name}</h3>
                      {p.minutes && (
                        <span className="t-caption shrink-0">{p.minutes} min in the real exam</span>
                      )}
                    </div>
                    <p className="t-small mt-1">{p.blurb}</p>

                    {empty ? (
                      <p className="t-caption mt-3">
                        No questions in the bank for this paper yet.
                      </p>
                    ) : (
                      <>
                        <p className="t-caption mt-3">
                          {a.drawn} question{a.drawn === 1 ? '' : 's'} · about {a.minutes} min
                          {short && ` · the full paper is ${p.target}`}
                        </p>
                        {short && (
                          <p className="t-caption mt-1 text-[var(--warning-text)]">
                            The bank is not deep enough for a full-length {p.name} yet, so this
                            one is shorter than the real thing.
                          </p>
                        )}
                        <button
                          onClick={() => start(p)}
                          className="btn btn-solid control-md mt-3 w-full"
                        >
                          <IconClock width={16} height={16} />
                          Start {p.name}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
