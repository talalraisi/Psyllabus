'use client'

/**
 * Today's plan: what to do, when, for how long, with the breaks.
 *
 * Each task says why it is there and what doing it means — the steps, sized
 * to the task rather than an equal share of the evening — and ends in
 * something you can see. A task with a quiz behind it ticks itself off when
 * you finish the quiz; the quiz is the proof, so nobody has to tick a box to
 * be believed. You can still mark anything done yourself.
 *
 * With free time painted, every task and break has a clock time inside it.
 * The plan is automatic, but the student's word beats it: skip something
 * today, move it to tomorrow or a chosen day, or mark it done, and the rest
 * re-arranges around that.
 */

import { useState } from 'react'
import Link from 'next/link'
import SessionTimer from '@/components/SessionTimer'
import { IconCheck } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { WEEKDAYS, rhythmOf } from '@/lib/study-plan'

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

const REASON_COLOR = {
  weak: 'var(--status-weak)',
  decaying: 'var(--status-fading)',
  event: 'var(--status-weak)',
  target: 'var(--brand)',
  review: 'var(--status-weak)',
  retest: 'var(--brand)',
}

const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`)

/** Minutes from midnight as a clock time: 4:05pm. */
export const clock = (m) => {
  const h = Math.floor(m / 60) % 24
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

function TaskMenu({ task, tomorrow, onAdjust, done, close }) {
  const [picking, setPicking] = useState(false)
  const item = 'block w-full rounded-[8px] px-3 py-2 text-left text-[13px] hover:bg-[var(--surface-sunken)]'
  return (
    <div
      role="menu"
      className="absolute right-0 top-full z-20 mt-1 w-56 rounded-[12px] border p-1 shadow-lg"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
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
              Move to another day…
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function TodayPlan({ day, tomorrowKey, style, isDone, hrefFor, onResources, onAdjust }) {
  const [menu, setMenu] = useState(null)
  const rhythm = rhythmOf(style)
  const tasks = day.tasks
  const done = tasks.filter(isDone)
  const doneMinutes = done.reduce((n, t) => n + t.minutes, 0)
  const remaining = tasks.filter((t) => !isDone(t))
  const complete = tasks.length > 0 && remaining.length === 0
  const current = remaining[0] || null

  /**
   * The day as rows: tasks and breaks, in time order.
   *
   * With free time painted, the engine has given everything a clock time and
   * the breaks are its own — the gaps between windows included. Without it,
   * a break falls after whichever task crosses each block boundary. Anything
   * that fitted no window comes last, under "if you have time".
   */
  const rows = []
  if (day.timeline) {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    let n = 0
    for (const x of day.timeline) {
      if (x.type === 'task' && byId.has(x.id)) rows.push({ type: 'task', task: byId.get(x.id), n: ++n })
      else if (x.type === 'break') rows.push({ type: 'break', start: x.start, minutes: x.end - x.start })
    }
    const extra = tasks.filter((t) => t.overflow)
    if (extra.length) {
      rows.push({ type: 'heading', label: 'If you have time' })
      for (const t of extra) rows.push({ type: 'task', task: t, n: ++n })
    }
  } else {
    let run = 0
    let next = rhythm.work
    tasks.forEach((t, i) => {
      rows.push({ type: 'task', task: t, n: i + 1 })
      run += t.minutes
      if (Number.isFinite(rhythm.work) && rhythm.rest > 0 && run >= next && i < tasks.length - 1) {
        rows.push({ type: 'break', minutes: rhythm.rest })
        while (next <= run) next += rhythm.work
      }
    })
  }
  const windows = (day.slots || []).map(([a, b]) => `${clock(a)}–${clock(b)}`).join(', ')
  const pattern = Number.isFinite(rhythm.work)
    ? `${rhythm.work}-minute blocks${day.breaks ? `, ${day.breaks} break${day.breaks === 1 ? '' : 's'}` : ''}`
    : 'No set breaks'

  return (
    <div>
      <div className="elev mb-6 rounded-[16px] border p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <p className="t-overline">Today · {WEEKDAYS[day.weekday]}</p>
        <h2 className="mt-2 text-[clamp(1.25rem,2.4vw,1.6rem)] font-semibold leading-tight tracking-[-0.025em]">
          {day.minutes === 0
            ? 'A day off'
            : complete
              ? 'Everything for today is done'
              : tasks.length === 0
                ? 'Nothing planned today'
                : `${tasks.length} task${tasks.length === 1 ? '' : 's'}, ${fmt(day.planned)}`}
        </h2>
        <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          {day.minutes === 0
            ? 'No free time today. Change your week if that is wrong.'
            : day.late
              ? 'Your free time today has passed. This is what was planned, if you get a moment.'
              : complete
                ? `${fmt(doneMinutes)} done. Tomorrow's plan is ready below.`
                : `${done.length ? `${done.length} of ${tasks.length} done · ` : ''}${pattern} · ${windows || `${fmt(day.minutes)} set aside`}`}
        </p>

        {tasks.length > 0 && (
          <div className="mt-5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border-strong)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${day.planned ? (doneMinutes / day.planned) * 100 : 0}%`, background: 'var(--brand)' }}
            />
          </div>
        )}

        {tasks.length > 0 && !complete && (
          <div className="mt-5">
            <SessionTimer
              minutes={Number.isFinite(rhythm.work) ? rhythm.work : day.planned}
              label={current?.subject ? { subject: current.subject, subtopic: current.subtopic } : null}
            />
          </div>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {rows.map((row, r) => {
          if (row.type === 'heading') {
            return (
              <li key={`h${r}`} className="pb-1 pt-4">
                <p className="t-overline">{row.label}</p>
              </li>
            )
          }
          if (row.type === 'break') {
            return (
              <li key={`b${r}`}>
                <p className="flex items-center gap-3 py-1.5 pl-9 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  {row.start != null ? `${clock(row.start)} · ` : ''}Break · {row.minutes} min
                  <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
                </p>
              </li>
            )
          }

          const task = row.task
          const k = kindOf(task)
          const finished = isDone(task)
          const href = hrefFor(task)
          return (
            <li key={task.id}>
              <div
                className="rounded-[12px] border px-4 py-3.5"
                style={{
                  borderColor: finished ? 'var(--border)' : 'var(--border-strong)',
                  background: finished ? 'transparent' : 'var(--surface)',
                  opacity: finished ? 0.65 : 1,
                }}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <span className="mt-0.5 w-5 shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-faint)' }}>
                    {finished ? <IconCheck width={14} height={14} className="text-[var(--brand)]" /> : row.n}
                  </span>

                  <div className="min-w-[12rem] flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      {task.start != null && !task.overflow && (
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--text-body)' }}>
                          {clock(task.start)}–{clock(task.end)}
                        </span>
                      )}
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: k.color, background: `color-mix(in srgb, ${k.color} 12%, transparent)` }}>
                        {k.label}
                      </span>
                      <span className="truncate">
                        {task.subject}
                        {task.topic ? ` · ${task.topic}` : ''}
                      </span>
                    </p>
                    <p className={`mt-1 text-[14.5px] ${finished ? 'line-through' : ''}`} style={{ color: finished ? 'var(--text-faint)' : 'var(--text-body)' }}>
                      {task.kind === 'review' ? `Mistakes due back in ${task.subject}` : displaySubtopic(task.subtopic)}
                    </p>

                    {!finished && task.reasons?.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {task.reasons.slice(0, 2).map((reason) => (
                          <span key={reason.kind + reason.label} className="text-[12px]" style={{ color: REASON_COLOR[reason.kind] || 'var(--text-muted)' }}>
                            {reason.label}
                          </span>
                        ))}
                      </p>
                    )}

                    {!finished && task.steps?.length > 0 && (
                      <ol className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        {task.steps.map((step, n) => (
                          <li key={step.kind + n} className="flex items-center gap-2">
                            {n > 0 && (
                              <span aria-hidden="true" className="text-[10px]" style={{ color: 'var(--border-strong)' }}>
                                →
                              </span>
                            )}
                            <span className="rounded-full border px-2.5 py-1 text-[11.5px]" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)', color: 'var(--text-body)' }}>
                              {step.label}
                              <span className="ml-1.5 tabular-nums" style={{ color: 'var(--text-faint)' }}>
                                {step.minutes}m
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="relative flex shrink-0 items-center gap-2">
                    <span className="hidden text-[12px] tabular-nums sm:block" style={{ color: 'var(--text-faint)' }}>
                      {task.minutes} min
                    </span>
                    {!finished && task.subtopic && (
                      <button type="button" onClick={() => onResources(task)} className="btn btn-quiet control-sm">
                        Resources
                      </button>
                    )}
                    {!finished &&
                      (href ? (
                        <Link href={href} className="btn btn-solid control-sm">
                          Start
                        </Link>
                      ) : (
                        <button type="button" onClick={() => onResources(task)} className="btn btn-solid control-sm">
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
                    {menu === task.id && <TaskMenu task={task} tomorrow={tomorrowKey} done={finished} onAdjust={onAdjust} close={() => setMenu(null)} />}
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
