'use client'

/**
 * Today's plan, as an agenda: when, what, and the one thing worth knowing
 * about it.
 *
 * It began as a stack of bordered cards, each carrying two reasons, a row of
 * long step labels and three buttons, and read like a form. Now the times run
 * down a thin line on the left, each task is a title with a single reason and
 * its steps in a word or two, and there is one button — Start — with
 * everything else behind ···. The full step instructions are still there, on
 * hover. Breaks are a gap in the line rather than a row of their own.
 *
 * A task with a quiz behind it ticks itself off when that quiz is finished;
 * the quiz is the evidence. Anything can still be marked done by hand, and
 * skipped or moved, and the student's word beats the plan.
 */

import { useState } from 'react'
import Link from 'next/link'
import SessionTimer from '@/components/SessionTimer'
import { IconCheck } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { WEEKDAYS, rhythmOf } from '@/lib/study-plan'
import { useSyllabi } from '@/components/syllabi/SyllabiDrawer'

const KIND = {
  review: { label: 'Mistakes', color: 'var(--status-weak)' },
  refresh: { label: 'Fading', color: 'var(--status-fading)' },
  topup: { label: 'Top up', color: 'var(--status-proficient)' },
  retest: { label: 'Retest', color: 'var(--brand)' },
}
const LEARN = {
  in_progress: { label: 'Weak', color: 'var(--status-weak)' },
  not_started: { label: 'New', color: 'var(--text-muted)' },
  confident: { label: 'Developing', color: 'var(--status-developing)' },
}
const kindOf = (t) => (t.kind === 'learn' ? LEARN[t.status] || LEARN.not_started : KIND[t.kind] || LEARN.not_started)

// The one reason shown, most telling first: a test coming up beats "weak",
// which beats "early topic".
const REASON_ORDER = ['event', 'review', 'decaying', 'target', 'retest', 'weak', 'shaky', 'untested', 'proficient', 'noquiz', 'foundation']
const REASON_COLOR = {
  event: 'var(--status-weak)',
  review: 'var(--status-weak)',
  decaying: 'var(--status-fading)',
  target: 'var(--brand)',
  retest: 'var(--brand)',
  weak: 'var(--status-weak)',
}
const reasonOf = (t) => [...(t.reasons || [])].sort((a, b) => REASON_ORDER.indexOf(a.kind) - REASON_ORDER.indexOf(b.kind))[0]

const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}m` : ''}` : `${m}m`)

/** Minutes from midnight as a clock time: 4:05pm. */
export const clock = (m) => {
  const h = Math.floor(m / 60) % 24
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

/** What Syllabi is asked when a task on the plan is opened with it. */
function teachMe(task) {
  if (task.kind === 'review') {
    return `I have ${task.subject} mistakes due back today. Quiz me on the kind of question I usually get wrong in ${task.subject}, one at a time, and mark each answer.`
  }
  const name = displaySubtopic(task.subtopic)
  return task.kind === 'new' || task.status === 'not_started'
    ? `Teach me ${name} in ${task.subject} from the start: the key idea, one worked example, then one quick question to check I have it.`
    : `I need to strengthen ${name} in ${task.subject}. Find out what I'm missing with a couple of quick questions, then explain the part I get wrong.`
}

function TaskMenu({ task, tomorrow, onAdjust, onNotes, done, close }) {
  const [picking, setPicking] = useState(false)
  const syllabi = useSyllabi()
  const item = 'block w-full rounded-[8px] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-sunken)]'
  return (
    <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-52 rounded-[12px] border p-1 shadow-lg" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      {syllabi.available && (
        <button
          role="menuitem"
          type="button"
          className={`${item} font-medium`}
          style={{ color: 'var(--brand)' }}
          onClick={() => {
            syllabi.open({ subject: task.subject, topic: task.subtopic || '', text: teachMe(task), autoSend: true, label: `Study plan · ${task.subject}` })
            close()
          }}
        >
          Teach me with Syllabi
        </button>
      )}
      {task.subtopic && (
        <button role="menuitem" type="button" className={item} onClick={() => { onNotes(task); close() }}>
          Notes
        </button>
      )}
      <button role="menuitem" type="button" className={item} onClick={() => { onAdjust(task, done ? 'undone' : 'done'); close() }}>
        {done ? 'Not done after all' : 'Mark as done'}
      </button>
      {!done && (
        <>
          <button role="menuitem" type="button" className={item} onClick={() => { onAdjust(task, 'skip'); close() }}>
            Skip today
          </button>
          {tomorrow && (
            <button role="menuitem" type="button" className={item} onClick={() => { onAdjust(task, 'move', tomorrow); close() }}>
              Move to tomorrow
            </button>
          )}
          {picking ? (
            <input
              type="date"
              autoFocus
              className="input m-1 h-9 w-[calc(100%-0.5rem)] px-3 text-[16px] sm:text-[13px]"
              aria-label="Move to which day"
              onChange={(e) => {
                if (!e.target.value) return
                onAdjust(task, 'move', e.target.value)
                close()
              }}
            />
          ) : (
            <button role="menuitem" type="button" className={item} onClick={() => setPicking(true)}>
              Another day…
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function TodayPlan({ day, tomorrowKey, style, isDone, hrefFor, onNotes, onAdjust }) {
  const [menu, setMenu] = useState(null)
  const rhythm = rhythmOf(style)
  const tasks = day.tasks
  const done = tasks.filter(isDone)
  const doneMinutes = done.reduce((n, t) => n + t.minutes, 0)
  const remaining = tasks.filter((t) => !isDone(t))
  const complete = tasks.length > 0 && remaining.length === 0
  const current = remaining[0] || null
  const timed = Boolean(day.timeline)

  // Rows in time order: tasks, and the breaks between them.
  const rows = []
  if (timed) {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    for (const x of day.timeline) {
      if (x.type === 'task' && byId.has(x.id)) rows.push({ type: 'task', task: byId.get(x.id) })
      else if (x.type === 'break') rows.push({ type: 'break', start: x.start, minutes: x.end - x.start })
    }
    const extra = tasks.filter((t) => t.overflow)
    if (extra.length) {
      rows.push({ type: 'heading', label: 'If you have time' })
      for (const t of extra) rows.push({ type: 'task', task: t })
    }
  } else {
    let run = 0
    let next = rhythm.work
    tasks.forEach((t, i) => {
      rows.push({ type: 'task', task: t })
      run += t.minutes
      if (Number.isFinite(rhythm.work) && rhythm.rest > 0 && run >= next && i < tasks.length - 1) {
        rows.push({ type: 'break', minutes: rhythm.rest })
        while (next <= run) next += rhythm.work
      }
    })
  }

  const windows = (day.slots || []).map(([a, b]) => `${clock(a)}–${clock(b)}`).join(', ')
  const headline =
    day.minutes === 0 ? 'Day off' : complete ? 'All done' : tasks.length === 0 ? 'Nothing planned' : fmt(day.planned)
  const sub =
    day.minutes === 0
      ? null
      : day.late
        ? 'Your free time today has passed'
        : complete
          ? `${fmt(doneMinutes)} studied`
          : [`${tasks.length} task${tasks.length === 1 ? '' : 's'}`, windows, Number.isFinite(rhythm.work) ? `${rhythm.work}/${rhythm.rest}` : null]
              .filter(Boolean)
              .join(' · ')

  return (
    <div>
      <div className="mb-8">
        <p className="t-overline">Today · {WEEKDAYS[day.weekday]}</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[clamp(1.6rem,3.2vw,2.1rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums">{headline}</h2>
          {sub && (
            <p className="text-[13px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {sub}
            </p>
          )}
        </div>

        {tasks.length > 0 && (
          <div className="mt-4 h-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${day.planned ? (doneMinutes / day.planned) * 100 : 0}%`, background: 'var(--brand)' }} />
          </div>
        )}

        {tasks.length > 0 && !complete && (
          <div className="mt-4">
            <SessionTimer
              compact
              minutes={Number.isFinite(rhythm.work) ? rhythm.work : day.planned}
              label={current?.subject ? { subject: current.subject, subtopic: current.subtopic } : null}
            />
          </div>
        )}
      </div>

      <ol className="relative">
        {rows.map((row, r) => {
          if (row.type === 'heading') {
            return (
              <li key={`h${r}`} className="pb-2 pt-6">
                <p className="t-overline">{row.label}</p>
              </li>
            )
          }
          if (row.type === 'break') {
            return (
              <li key={`b${r}`} className="flex items-center">
                <span className="w-16 shrink-0 pr-3 text-right text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                  {row.start != null ? clock(row.start) : ''}
                </span>
                <span className="relative flex w-5 shrink-0 justify-center self-stretch" aria-hidden="true">
                  <span className="w-px" style={{ backgroundImage: 'linear-gradient(var(--border-strong) 50%, transparent 0)', backgroundSize: '1px 6px' }} />
                </span>
                <span className="py-2 pl-3 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Break · {row.minutes}m
                </span>
              </li>
            )
          }

          const task = row.task
          const k = kindOf(task)
          const finished = isDone(task)
          const href = hrefFor(task)
          const reason = reasonOf(task)
          const last = r === rows.length - 1
          return (
            <li key={task.id} className="group flex">
              {/* When */}
              <span className="w-16 shrink-0 pr-3 pt-3.5 text-right text-[12px] tabular-nums" style={{ color: finished ? 'var(--text-faint)' : 'var(--text-body)' }}>
                {task.start != null && !task.overflow ? clock(task.start) : fmt(task.minutes)}
              </span>

              {/* The line, and this task's point on it */}
              <span className="relative flex w-5 shrink-0 justify-center" aria-hidden="true">
                <span className="absolute inset-y-0 w-px" style={{ background: 'var(--border)', top: r === 0 ? 18 : 0, bottom: last ? 'calc(100% - 18px)' : 0 }} />
                <span
                  className="relative mt-[15px] flex h-[11px] w-[11px] items-center justify-center rounded-full"
                  style={finished ? { background: 'var(--brand)' } : { background: 'var(--bg)', boxShadow: `inset 0 0 0 2px ${k.color}` }}
                >
                  {finished && <IconCheck width={8} height={8} style={{ color: 'var(--bg)' }} />}
                </span>
              </span>

              {/* What */}
              <div className="min-w-0 flex-1 rounded-[10px] px-3 py-2.5 transition-colors group-hover:bg-[var(--surface)]">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      <span className="font-semibold" style={{ color: finished ? 'var(--text-faint)' : k.color }}>
                        {k.label}
                      </span>
                      <span className="truncate">{task.subject}</span>
                    </p>
                    <p className={`mt-0.5 text-[15px] leading-snug ${finished ? 'line-through' : ''}`} style={{ color: finished ? 'var(--text-faint)' : 'var(--text)' }}>
                      {task.kind === 'review' ? 'Mistakes due back' : displaySubtopic(task.subtopic)}
                    </p>
                    {!finished && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        <span title={(task.steps || []).map((s) => `${s.label} (${s.minutes}m)`).join(' → ')}>
                          {(task.steps || []).map((s) => `${s.short} ${s.minutes}m`).join(' · ')}
                        </span>
                        {reason && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: REASON_COLOR[reason.kind] || 'var(--text-muted)' }}>{reason.label}</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="relative flex shrink-0 items-center gap-1.5">
                    {!finished &&
                      (href ? (
                        <Link href={href} className="btn btn-solid control-sm">
                          Start
                        </Link>
                      ) : (
                        <button type="button" onClick={() => onNotes(task)} className="btn btn-solid control-sm">
                          Start
                        </button>
                      ))}
                    <button
                      type="button"
                      aria-label={`More for ${task.subtopic ? displaySubtopic(task.subtopic) : task.subject}`}
                      aria-haspopup="menu"
                      aria-expanded={menu === task.id}
                      onClick={() => setMenu(menu === task.id ? null : task.id)}
                      className="btn btn-quiet control-sm px-2.5"
                    >
                      ···
                    </button>
                    {menu === task.id && (
                      <TaskMenu task={task} tomorrow={tomorrowKey} done={finished} onAdjust={onAdjust} onNotes={onNotes} close={() => setMenu(null)} />
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
