'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { IconClose } from '@/components/Icons'

/**
 * A subtopic, opened from the syllabus or the study plan: your notes on it,
 * saved as you type, and a practice quiz. Notes written as "term: definition"
 * can become flashcards later.
 */
export default function NotesDrawer({
  open,
  onClose,
  subject,
  topic,
  subtopic,
  hlOnly,
  quizHref,
}) {
  const [note, setNote] = useState('')
  const [noteState, setNoteState] = useState('idle') // idle | saving | saved
  const saveTimer = useRef(null)

  // Load whatever the student already wrote about this subtopic.
  useEffect(() => {
    if (!open || !subject || !subtopic) return
    let cancelled = false
    const supabase = createClient()
    setNote('')
    setNoteState('idle')

    getCurrentUser(supabase).then((user) => {
      if (!user) return
      supabase
        .from('notes')
        .select('body')
        .eq('user_id', user.id)
        .eq('subject', subject)
        .eq('subtopic', subtopic)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data?.body) setNote(data.body)
        })
    })

    return () => {
      cancelled = true
    }
  }, [open, subject, subtopic])

  /**
   * Autosave, debounced. Nobody presses save on a note, and losing a paragraph
   * because the drawer was closed is the fastest way to stop someone using it.
   */
  const saveNote = useCallback(
    (body) => {
      clearTimeout(saveTimer.current)
      setNoteState('saving')
      saveTimer.current = setTimeout(async () => {
        const supabase = createClient()
        const user = await getCurrentUser(supabase)
        if (!user) return
        await supabase.from('notes').upsert(
          {
            user_id: user.id,
            subject,
            topic: topic || null,
            subtopic,
            body,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,subject,subtopic' }
        )
        setNoteState('saved')
        setTimeout(() => setNoteState('idle'), 1500)
      }, 700)
    },
    [subject, topic, subtopic]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !subtopic) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Notes">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-raised)]">
        <div className="border-b border-[var(--border)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="t-caption">{topic}</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--text)]">{subtopic}</h2>
              {hlOnly && (
                <span
                  className="mt-2 inline-block rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                >
                  HL only
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close notes"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
            >
              <IconClose width={18} height={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="t-overline">Your notes</p>
              <span className="t-caption">
                {noteState === 'saving' ? 'Saving\u2026' : noteState === 'saved' ? 'Saved' : ''}
              </span>
            </div>
            <textarea
              rows={12}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                saveNote(e.target.value)
              }}
              placeholder={'Anything you want to keep about this subtopic.\n\nLines written as "term: definition" can become flashcards later.'}
              className="input w-full resize-y"
              style={{ height: 'auto', padding: '12px 16px', lineHeight: 1.6 }}
            />
          </div>

        </div>

        {quizHref && (
          <div className="border-t border-[var(--border)] p-6">
            <Link href={quizHref} className="btn btn-solid control-md w-full">
              Practice quiz on this subtopic
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}
