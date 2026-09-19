'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { IconCheck, IconClose } from '@/components/Icons'
import ReportQuestion from '@/components/ReportQuestion'

/**
 * Everything you can do to a question, behind three dots.
 *
 * There used to be a copy button sitting next to every stem, which is one
 * action given permanent real estate while the useful ones — save this, report
 * this — were either buried on the results page or missing. Three dots take
 * the same space and hold all of them, and the question itself gets the room.
 *
 * The menu closes on outside click and on Escape, because a popover you cannot
 * dismiss without choosing something is a trap.
 */
export default function QuestionMenu({ question, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(null) // null = unknown, true/false once checked
  const [reporting, setReporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Only asked once the menu is opened: a quiz of twenty questions should not
  // make twenty requests for a state nobody has looked at.
  useEffect(() => {
    if (!open || saved !== null) return
    let live = true
    ;(async () => {
      const supabase = createClient()
      const user = await getCurrentUser(supabase)
      if (!user) return live && setSaved(false)
      const { data } = await supabase
        .from('question_favourites')
        .select('id')
        .eq('user_id', user.id)
        .eq('question_id', question.id)
        .maybeSingle()
      if (live) setSaved(!!data)
    })()
    return () => {
      live = false
    }
  }, [open, saved, question.id])

  const toggleSave = async () => {
    const supabase = createClient()
    const user = await getCurrentUser(supabase)
    if (!user) return
    const next = !saved
    setSaved(next) // optimistic: the menu closes immediately either way
    setOpen(false)
    if (next) {
      const { error } = await supabase
        .from('question_favourites')
        .insert({ user_id: user.id, question_id: question.id })
      if (error && error.code !== '23505') setSaved(false)
    } else {
      const { error } = await supabase
        .from('question_favourites')
        .delete()
        .eq('user_id', user.id)
        .eq('question_id', question.id)
      if (error) setSaved(true)
    }
  }

  const copy = async () => {
    const lines = [question.stem]
    for (const o of question.options || []) lines.push(`${o.id}) ${o.text}`)
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setCopied(true)
    setOpen(false)
    setTimeout(() => setCopied(false), 1600)
  }

  const item =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--surface-sunken)]'

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Question options"
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-sunken)]"
        style={{ color: saved ? 'var(--brand)' : 'var(--text-faint)' }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <circle cx="7.5" cy="3" r="1.3" fill="currentColor" />
          <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" />
          <circle cx="7.5" cy="12" r="1.3" fill="currentColor" />
        </svg>
      </button>

      {copied && (
        <span
          className="absolute right-0 top-8 z-20 whitespace-nowrap rounded-[var(--r-sm)] px-2 py-1 text-[11.5px]"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
        >
          Copied
        </span>
      )}

      {open && (
        <div
          role="menu"
          className={`pop-enter absolute ${align === 'right' ? 'right-0' : 'left-0'} top-8 z-30 w-52 overflow-hidden rounded-[var(--r-md)] border py-1 shadow-lg`}
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          <button role="menuitem" onClick={toggleSave} className={item}>
            <IconCheck
              width={12}
              height={12}
              style={{ opacity: saved ? 1 : 0.25, color: saved ? 'var(--brand)' : 'currentColor' }}
            />
            {saved ? 'Saved — tap to unsave' : 'Save this question'}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setReporting(true)
              setOpen(false)
            }}
            className={item}
          >
            <IconClose width={12} height={12} style={{ opacity: 0.4 }} />
            Report a problem
          </button>
          <button role="menuitem" onClick={copy} className={item}>
            <span className="inline-block w-3 text-center opacity-40">⧉</span>
            Copy question text
          </button>
        </div>
      )}

      {reporting && (
        <div
          className="pop-enter absolute right-0 top-8 z-30 w-[300px] rounded-[var(--r-md)] border p-1 shadow-lg"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          <ReportQuestion questionId={question.id} startOpen onDone={() => setReporting(false)} />
        </div>
      )}
    </div>
  )
}
