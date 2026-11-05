'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { IconCheck, IconClose, IconPlus, IconArrowRight } from '@/components/Icons'
import { SkeletonLine } from '@/components/PageShell'
import Select from '@/components/Select'
import { parseTodoInput, bucketFor, BUCKET_LABELS, BUCKET_ORDER, dayKey } from '@/lib/todo-parse'
import { useTodos, addTodo, patchTodo, patchTodos, toggleTodo, removeTodo, undoRemove, clearTodoError } from '@/lib/todos'
import { getSlugForSubject } from '@/lib/subject-map'

/**
 * The list of things that are not a test.
 *
 * The calendar holds dated things the planner reacts to — a mock on the 11th
 * moves that subject up the queue. This holds everything else: print the lab
 * sheet, email the coordinator, finish the bibliography.
 *
 * One list everywhere (lib/todos.js): the home page, the study plan, the
 * calendar and the To-do page all show the same tasks, so something added or
 * ticked in one is already right in the others. A task with a subject has a
 * way into that subject, so "revise kinematics #physics" is one tap from
 * practising it, not a note about practising it.
 *
 * Kept small on purpose: a title, a tick, and optionally a day, a subject and
 * a note. Priorities, tags and sub-tasks are what turn a list you use into an
 * app you maintain.
 */

const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

function relativeDay(due, todayKey) {
  if (!due) return null
  if (due === todayKey) return 'Today'
  const diff = Math.round((new Date(`${due}T00:00`).getTime() - new Date(`${todayKey}T00:00`).getTime()) / 86400000)
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)}d late`
  if (diff < 7) return new Date(`${due}T00:00`).toLocaleDateString(undefined, { weekday: 'short' })
  return new Date(`${due}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const shortSubject = (s) => String(s || '').replace(/ (SL|HL)$/, '')

export default function TodoList({
  /** Prefills the day on anything added here. */
  defaultDue = null,
  /** Only the tasks due on this day (and, for today, anything overdue). Used by the calendar. */
  day = null,
  /** Outstanding only, at most `limit`, with a link to the full list. For the home page. */
  compact = false,
  limit = null,
  title = 'To-do',
  className = '',
  /** The student's subjects, so "#physics" in the box can match one. */
  subjects = [],
}) {
  const { todos, loaded, userId, error, removed } = useTodos()
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [subjectFilter, setSubjectFilter] = useState(null)
  const inputRef = useRef(null)
  const todayKey = dayKey(new Date())
  const due = day || defaultDue

  const add = async () => {
    const text = draft.trim().slice(0, 200)
    if (!text) return
    // "lab report friday #physics" is one thing to type. The day and subject
    // come out of it; the words that named them come out of the title.
    const parsed = parseTodoInput(text, { subjects })
    setDraft('')
    const ok = await addTodo({ title: parsed.title || text, due_on: parsed.due_on || due, subject: parsed.subject || subjectFilter })
    if (!ok) setDraft(text)
    inputRef.current?.focus()
  }

  // What this list shows.
  let pool = todos
  if (day) pool = pool.filter((t) => t.due_on === day || (day === todayKey && !t.done && t.due_on && t.due_on < todayKey))
  const subjectsInUse = [...new Set(pool.map((t) => t.subject).filter(Boolean))]
  if (subjectFilter) pool = pool.filter((t) => t.subject === subjectFilter)
  const open = pool.filter((t) => !t.done)
  const done = pool.filter((t) => t.done)
  const overdueList = open.filter((t) => t.due_on && t.due_on < todayKey)

  // The home page leads with what is due: overdue, today, then the rest.
  const byUrgency = [...open].sort((a, b) => {
    const rank = (t) => BUCKET_ORDER.indexOf(bucketFor(t.due_on, todayKey))
    return rank(a) - rank(b) || String(a.due_on || '9').localeCompare(String(b.due_on || '9')) || a.position - b.position
  })
  const shown = compact ? byUrgency.slice(0, limit || 5) : day ? [...open, ...(showDone ? done : [])] : showDone ? pool : open

  const grouped =
    compact || day
      ? [{ bucket: 'all', items: shown }]
      : BUCKET_ORDER.map((bucket) => ({ bucket, items: shown.filter((t) => !t.done && bucketFor(t.due_on, todayKey) === bucket) }))
          .filter((g) => g.items.length)
          .concat(showDone && shown.some((t) => t.done) ? [{ bucket: 'done', items: shown.filter((t) => t.done) }] : [])

  const renderRow = (todo) => {
    const when = relativeDay(todo.due_on, todayKey)
    const late = todo.due_on && todo.due_on < todayKey && !todo.done
    const isOpen = openId === todo.id
    return (
      <li key={todo.id} className="flex items-center gap-3 border-b py-2.5" style={{ borderColor: 'var(--border)', opacity: todo.pending ? 0.55 : 1 }}>
        <button
          onClick={() => toggleTodo(todo)}
          aria-pressed={todo.done}
          aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
          className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150"
          style={{ borderColor: todo.done ? 'var(--brand)' : 'var(--border-hover)', background: todo.done ? 'var(--brand)' : 'transparent', color: '#fff' }}
        >
          {todo.done && <IconCheck width={12} height={12} />}
        </button>

        <button
          onClick={() => setOpenId(isOpen ? null : todo.id)}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-left"
          title="Open to edit"
        >
          <span
            className="min-w-0 text-[14px] leading-snug"
            style={{ color: todo.done ? 'var(--text-faint)' : 'var(--text-body)', textDecoration: todo.done ? 'line-through' : undefined }}
          >
            {todo.title}
          </span>
          {todo.note && (
            <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }} aria-label="Has a note">
              ✎
            </span>
          )}
        </button>

        {todo.subject && (
          <span className="hidden shrink-0 truncate rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)', maxWidth: 130 }}>
            {shortSubject(todo.subject)}
          </span>
        )}
        {when && (
          <span className="shrink-0 text-[12px] tabular-nums" style={{ color: late ? 'var(--status-fading)' : when === 'Today' ? 'var(--brand)' : 'var(--text-faint)', fontWeight: late || when === 'Today' ? 600 : 400 }}>
            {when}
          </span>
        )}
      </li>
    )
  }

  /** Everything about one task, under its row. Saved as you change it. */
  const renderDetail = (todo) => (
    <li key={`${todo.id}-detail`} className="pop-enter flex flex-col gap-3 border-b px-1 pb-4 pt-2" style={{ borderColor: 'var(--border)' }}>
      <input
        defaultValue={todo.title}
        maxLength={200}
        aria-label="Title"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        onBlur={(e) => {
          const value = e.target.value.trim()
          if (value && value !== todo.title) patchTodo(todo, { title: value })
          else e.target.value = todo.title
        }}
        className="input control-sm w-full px-3 text-[16px] sm:text-[13.5px]"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          ['Today', todayKey],
          ['Tomorrow', addDays(1)],
          ['Next week', addDays(7)],
        ].map(([label, value]) => (
          <button
            key={label}
            onClick={() => patchTodo(todo, { due_on: value })}
            aria-pressed={todo.due_on === value}
            className="rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors"
            style={todo.due_on === value ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-tint)' } : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          value={todo.due_on || ''}
          onChange={(e) => patchTodo(todo, { due_on: e.target.value || null })}
          aria-label="Due date"
          className="input control-sm px-3 text-[16px] sm:text-[12.5px]"
          style={{ width: 150 }}
        />
        {todo.due_on && (
          <button onClick={() => patchTodo(todo, { due_on: null })} className="px-2 text-[12.5px] font-medium" style={{ color: 'var(--text-faint)' }}>
            No date
          </button>
        )}
      </div>
      {subjects.length > 0 && (
        <Select
          value={todo.subject || ''}
          onChange={(e) => patchTodo(todo, { subject: e.target.value || null })}
          aria-label="Subject"
          className="input control-sm px-3 text-[16px] sm:text-[13px]"
          style={{ width: 220, maxWidth: '100%' }}
        >
          <option value="">No subject</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </Select>
      )}
      <textarea
        rows={2}
        defaultValue={todo.note || ''}
        onBlur={(e) => {
          const value = e.target.value.trim()
          if (value !== (todo.note || '')) patchTodo(todo, { note: value || null })
        }}
        placeholder="Notes: what it needs, where it is, who asked for it"
        className="input w-full resize-y px-3 text-[16px] sm:text-[13px]"
        style={{ height: 'auto', padding: '8px 12px' }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {todo.subject && (
          <Link href={`/dashboard/syllabus/${getSlugForSubject(todo.subject)}`} className="btn btn-outline control-sm">
            Practise {shortSubject(todo.subject)}
            <IconArrowRight width={13} height={13} />
          </Link>
        )}
        <div className="flex-1" />
        <button
          onClick={() => {
            setOpenId(null)
            removeTodo(todo)
          }}
          className="btn btn-quiet control-sm"
          style={{ color: 'var(--danger)' }}
        >
          <IconClose width={12} height={12} />
          Delete
        </button>
      </div>
    </li>
  )

  if (!loaded) {
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

  const allOpen = todos.filter((t) => !t.done).length

  return (
    <div className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-[15px] font-semibold tracking-[-0.012em]">{title}</h2>
        <span className="flex items-baseline gap-3 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          <span>
            {open.length} open
            {overdueList.length > 0 && <span style={{ color: 'var(--status-fading)' }}> · {overdueList.length} late</span>}
          </span>
          {(compact || day) && (
            <Link href="/dashboard/todo" className="font-medium text-[var(--brand)] hover:underline">
              {compact && allOpen > shown.length ? `All ${allOpen}` : 'All to-dos'}
            </Link>
          )}
        </span>
      </div>

      {!userId ? (
        <p className="py-6 text-[13.5px]" style={{ color: 'var(--text-faint)' }}>
          Sign in to keep a list.
        </p>
      ) : (
        <form
          className="mb-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            placeholder={day ? 'Add something for this day' : 'Lab report friday #physics'}
            aria-label="New to-do"
            className={`input ${compact ? 'control-sm' : 'control-md'} min-w-0 flex-1 px-3.5 text-[16px] sm:text-[13.5px]`}
          />
          <button type="submit" disabled={!draft.trim()} className={`btn btn-solid ${compact ? 'control-sm' : 'control-md'} shrink-0 disabled:opacity-40`} aria-label="Add to-do">
            <IconPlus width={15} height={15} />
            {!compact && 'Add'}
          </button>
        </form>
      )}
      {!compact && userId && !draft && (
        <p className="mb-3 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
          Type a day (friday, tomorrow, 12 nov) and a #subject and they are filled in for you.
        </p>
      )}

      {/* Filter by subject, once there is more than one to filter by. */}
      {!compact && !day && subjectsInUse.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[null, ...subjectsInUse].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setSubjectFilter(s)}
              aria-pressed={subjectFilter === s}
              className="rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
              style={subjectFilter === s ? { borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-tint)' } : { borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {s ? shortSubject(s) : 'All'}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mb-3 flex items-center justify-between gap-3 border-l-2 pl-3 text-[13px]" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          {error}
          <button onClick={clearTodoError} aria-label="Dismiss" style={{ color: 'var(--text-faint)' }}>
            <IconClose width={12} height={12} />
          </button>
        </p>
      )}

      {removed && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: 'var(--surface-sunken)', color: 'var(--text-body)' }} role="status">
          <span className="min-w-0 truncate">Deleted “{removed.todo.title}”</span>
          <button onClick={undoRemove} className="shrink-0 font-semibold text-[var(--brand)] hover:underline">
            Undo
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-6 text-[13.5px]" style={{ color: 'var(--text-faint)' }}>
          {open.length === 0 && done.length > 0 ? 'Everything here is done.' : day ? 'Nothing for this day.' : compact ? 'Nothing outstanding.' : 'Nothing yet. Type above and press enter.'}
        </p>
      ) : (
        <div className="flex flex-col">
          {grouped.map(({ bucket, items }) => (
            <section key={bucket}>
              {grouped.length > 1 && (
                <div className="mb-1 mt-5 flex items-center justify-between gap-3 first:mt-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: bucket === 'overdue' ? 'var(--status-fading)' : 'var(--text-faint)' }}>
                    {bucket === 'done' ? 'Done' : BUCKET_LABELS[bucket]}
                  </p>
                  {bucket === 'overdue' && (
                    <button onClick={() => patchTodos(items, { due_on: todayKey })} className="text-[12px] font-medium text-[var(--brand)] hover:underline">
                      Move all to today
                    </button>
                  )}
                </div>
              )}
              <ul className="flex flex-col">
                {items.flatMap((todo) => (openId === todo.id ? [renderRow(todo), renderDetail(todo)] : [renderRow(todo)]))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {compact && overdueList.length > 0 && (
        <button onClick={() => patchTodos(overdueList, { due_on: todayKey })} className="mt-3 text-[12.5px] font-medium text-[var(--brand)] hover:underline">
          Move {overdueList.length} late to today
        </button>
      )}

      {!compact && done.length > 0 && (
        <button onClick={() => setShowDone((v) => !v)} className="mt-4 text-[12.5px] font-medium underline underline-offset-2" style={{ color: 'var(--text-muted)' }}>
          {showDone ? 'Hide' : 'Show'} {done.length} done
        </button>
      )}
    </div>
  )
}
