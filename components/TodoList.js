'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { IconCheck, IconClose, IconPlus } from '@/components/Icons'
import { SkeletonLine } from '@/components/PageShell'
import { parseTodoInput, bucketFor, BUCKET_LABELS, BUCKET_ORDER } from '@/lib/todo-parse'

/**
 * The list of things that are not a test.
 *
 * The calendar holds dated things the planner reacts to — a mock on the 11th
 * moves that subject up the queue. This holds everything else: print the lab
 * sheet, email the coordinator, finish the bibliography. Those do not belong
 * on a study planner and they do not belong nowhere, which is where they were.
 *
 * It is deliberately small. A title, a tick, and optionally a day. Priorities,
 * tags, sub-tasks and recurrence are what turn a list you use into an app you
 * maintain.
 *
 * Every change is applied on screen before the database is asked, and rolled
 * back if the database refuses. A to-do list that waits for Singapore before
 * the tick appears is a to-do list nobody uses twice.
 */

/** A local calendar day as YYYY-MM-DD, which is what the column stores. */
function dayKey(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function relativeDay(due, todayKey) {
  if (!due) return null
  if (due === todayKey) return 'today'
  const diff = Math.round(
    (new Date(`${due}T00:00`).getTime() - new Date(`${todayKey}T00:00`).getTime()) / 86400000
  )
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff < 7) return `in ${diff}d`
  return new Date(`${due}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function TodoList({
  /** Prefills the day on anything added here. Used by the calendar. */
  defaultDue = null,
  /** Show only what is outstanding, and at most this many. For side panels. */
  compact = false,
  limit = null,
  title = 'To-do',
  className = '',
  /** The student's subjects, so "#physics" in the box can match one. */
  subjects = [],
}) {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [userId, setUserId] = useState(null)
  const supabase = createClient()
  const inputRef = useRef(null)
  const todayKey = dayKey()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const user = await getCurrentUser(supabase)
      if (cancelled) return
      if (!user) {
        setLoading(false)
        return
      }
      setUserId(user.id)
      const { data, error: loadError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (loadError) setError(loadError.message)
      else setTodos(data || [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const add = useCallback(async () => {
    const text = draft.trim().slice(0, 200)
    if (!text || !userId) return

    // "lab report friday #physics" is one thing to type. The day and subject
    // come out of it; the words that named them come out of the title.
    const parsed = parseTodoInput(text, { subjects })
    const cleanTitle = parsed.title || text

    // On screen first. The id is provisional until the insert comes back.
    const provisional = {
      id: `pending-${Date.now()}`,
      user_id: userId,
      title: cleanTitle,
      done: false,
      due_on: parsed.due_on || defaultDue,
      subject: parsed.subject,
      position: todos.length ? Math.min(...todos.map((t) => t.position)) - 1 : 0,
      pending: true,
    }
    setTodos((prev) => [provisional, ...prev])
    setDraft('')
    setError('')

    const { data, error: insertError } = await supabase
      .from('todos')
      .insert({
        user_id: userId,
        title: cleanTitle,
        due_on: parsed.due_on || defaultDue,
        subject: parsed.subject,
        position: provisional.position,
      })
      .select()
      .single()

    if (insertError) {
      setTodos((prev) => prev.filter((t) => t.id !== provisional.id))
      setDraft(text)
      setError(insertError.message)
      return
    }
    setTodos((prev) => prev.map((t) => (t.id === provisional.id ? data : t)))
  }, [draft, userId, defaultDue, todos, supabase, subjects])

  const toggle = useCallback(
    async (todo) => {
      const next = !todo.done
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: next } : t)))
      const { error: updateError } = await supabase
        .from('todos')
        .update({ done: next })
        .eq('id', todo.id)
      if (updateError) {
        setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: todo.done } : t)))
        setError(updateError.message)
      }
    },
    [supabase]
  )

  const remove = useCallback(
    async (todo) => {
      const before = todos
      setTodos((prev) => prev.filter((t) => t.id !== todo.id))
      const { error: deleteError } = await supabase.from('todos').delete().eq('id', todo.id)
      if (deleteError) {
        setTodos(before)
        setError(deleteError.message)
      }
    },
    [todos, supabase]
  )

  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)
  const shown = compact ? open.slice(0, limit || 5) : showDone ? todos : open
  const overdue = open.filter((t) => t.due_on && t.due_on < todayKey).length

  /**
   * Overdue, today, this week, later, no date.
   *
   * Compact panels stay a flat list: five rows in a sidebar do not need
   * headings, and the dashboard has little enough room as it is.
   */
  const grouped = compact
    ? [{ bucket: 'today', items: shown }]
    : BUCKET_ORDER.map((bucket) => ({
        bucket,
        items: shown.filter((t) => !t.done && bucketFor(t.due_on, todayKey) === bucket),
      }))
        .filter((g) => g.items.length)
        .concat(
          showDone && shown.some((t) => t.done)
            ? [{ bucket: 'done', items: shown.filter((t) => t.done) }]
            : []
        )

  /** One row. Shared by every group, so they cannot drift apart. */
  const renderRow = (todo) => {
            const due = relativeDay(todo.due_on, todayKey)
            const late = todo.due_on && todo.due_on < todayKey && !todo.done
            return (
              <li
                key={todo.id}
                className="group flex items-center gap-3 border-b py-2.5 last:border-b-0"
                style={{ borderColor: 'var(--border)', opacity: todo.pending ? 0.55 : 1 }}
              >
                <button
                  onClick={() => toggle(todo)}
                  aria-pressed={todo.done}
                  aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150"
                  style={{
                    borderColor: todo.done ? 'var(--brand)' : 'var(--border-hover)',
                    background: todo.done ? 'var(--brand)' : 'transparent',
                    color: '#fff',
                  }}
                >
                  {todo.done && <IconCheck width={11} height={11} />}
                </button>

                <span
                  className="min-w-0 flex-1 text-[14px] leading-snug"
                  style={{
                    color: todo.done ? 'var(--text-faint)' : 'var(--text-body)',
                    textDecoration: todo.done ? 'line-through' : undefined,
                  }}
                >
                  {todo.title}
                </span>

                {todo.subject && (
                  <span
                    className="shrink-0 truncate text-[11.5px]"
                    style={{ color: 'var(--text-faint)', maxWidth: 120 }}
                  >
                    {todo.subject}
                  </span>
                )}

                {due && (
                  <span
                    className="shrink-0 text-[12px] tabular-nums"
                    style={{ color: late ? 'var(--status-fading)' : 'var(--text-faint)' }}
                  >
                    {due}
                  </span>
                )}

                {!compact && (
                  <button
                    onClick={() => remove(todo)}
                    aria-label={`Delete "${todo.title}"`}
                    className="shrink-0 opacity-0 transition-opacity duration-150 focus:opacity-100 group-hover:opacity-100"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    <IconClose width={13} height={13} />
                  </button>
                )}
              </li>
            )
  }

  if (loading) {
    return (
      <div className={className} aria-hidden="true">
        <SkeletonLine width={120} height={13} />
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <SkeletonLine key={i} height={16} width={`${60 + i * 12}%`} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        className="mb-4 flex items-baseline justify-between gap-4 border-b pb-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.012em]">{title}</h2>
        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {open.length} open
          {overdue > 0 && <span style={{ color: 'var(--status-fading)' }}> · {overdue} overdue</span>}
        </span>
      </div>

      {!compact && !userId && (
        <p className="py-6 text-[13.5px]" style={{ color: 'var(--text-faint)' }}>
          Sign in to keep a list.
        </p>
      )}

      {!compact && userId && (
        <div className="mb-2 flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            maxLength={200}
            placeholder={defaultDue ? 'Add something for this day' : 'Lab report friday #physics'}
            aria-label="New to-do"
            className="input control-md flex-1"
          />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="btn btn-solid control-md shrink-0 disabled:opacity-40"
          >
            <IconPlus width={15} height={15} />
            Add
          </button>
        </div>
      )}

      {error && (
        <p
          className="mb-3 border-l-2 pl-3 text-[13px]"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {error}
        </p>
      )}

      {/* Grouped by when, not by when it was typed: a flat list of eleven
          things hides the two that are for today. */}
      {shown.length === 0 ? (
        <p className="py-6 text-[13.5px]" style={{ color: 'var(--text-faint)' }}>
          {open.length === 0 && done.length > 0
            ? 'Everything here is done.'
            : compact
              ? 'Nothing outstanding.'
              : 'Nothing yet. Type above and press enter.'}
        </p>
      ) : (
        <div className="stagger flex flex-col">
          {grouped.map(({ bucket, items }) => (
            <section key={bucket}>
              {!compact && grouped.length > 1 && (
                <p
                  className="mb-1 mt-5 text-[10.5px] font-semibold uppercase tracking-[0.14em] first:mt-0"
                  style={{
                    color: bucket === 'overdue' ? 'var(--status-fading)' : 'var(--text-faint)',
                  }}
                >
                  {bucket === 'done' ? 'Done' : BUCKET_LABELS[bucket]}
                </p>
              )}
              <ul className="flex flex-col">{items.map(renderRow)}</ul>
            </section>
          ))}
        </div>
      )}

      {!compact && done.length > 0 && (
        <button
          onClick={() => setShowDone((v) => !v)}
          className="mt-4 text-[12.5px] font-medium underline underline-offset-2"
          style={{ color: 'var(--text-muted)' }}
        >
          {showDone ? 'Hide' : 'Show'} {done.length} done
        </button>
      )}
    </div>
  )
}
