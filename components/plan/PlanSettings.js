'use client'

/**
 * How the student studies, in one place: when they are free, their rhythm,
 * the techniques they like, whether they learn first or test first, whether
 * they mix subjects or focus — and on which — which topics their classes
 * have covered, and their exam dates.
 *
 * Everything here is a real difference between students, and the plan asks
 * rather than guessing. Saved together to profiles.plan_settings (migration
 * 060). Only what the student actually chose is stored: an unchanged exam
 * date stays unset, so a better default later still reaches them.
 *
 * Controls are compact on purpose: the site's standard input is sized for a
 * sign-in form, and a panel of them read as a form to fill in rather than a
 * set of preferences. On phones inputs keep a 16px font, because iOS zooms
 * into anything smaller the moment it is tapped.
 */

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { invalidateProfile } from '@/lib/cache'
import { WEEKDAYS, RHYTHMS, METHODS, examDateFor, dateKey, slotsFromMinutes } from '@/lib/study-plan'
import WeekGrid from '@/components/plan/WeekGrid'

const ORDERS = [
  ['auto', 'Let the plan decide', 'Revise first when you got it wrong, test first when it is half there'],
  ['questions', 'Questions first', 'Find the gaps, then revise them. New topics are still learned first'],
  ['learn', 'Learn or revise first', 'Go through it, then test yourself'],
]
const MIXES = [
  ['mixed', 'Mix subjects', 'Several a day, never the same one twice in a row'],
  ['focus', 'Focus', 'One or two subjects a day, ones you choose'],
]

const field = 'input h-9 px-3 text-[16px] sm:text-[13px]'

function Choice({ on, onClick, title, hint, className = '' }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`rounded-[10px] border px-3 py-2 text-left transition-colors ${className}`}
      style={{
        borderColor: on ? 'var(--brand)' : 'var(--border)',
        background: on ? 'color-mix(in srgb, var(--brand) 8%, var(--surface))' : 'var(--surface)',
      }}
    >
      <span className="block text-[13px] font-medium tabular-nums">{title}</span>
      {hint && (
        <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </button>
  )
}

function Chip({ on, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border px-3 py-1 text-[12px] transition-colors disabled:opacity-40"
      style={{
        borderColor: on ? 'var(--brand)' : 'var(--border)',
        background: on ? 'color-mix(in srgb, var(--brand) 10%, var(--surface))' : 'var(--surface)',
        color: on ? 'var(--text)' : 'var(--text-muted)',
      }}
    >
      {children}
    </button>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="border-t pt-5 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h3>
      {hint && (
        <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function PlanSettings({ profile, settings, subjects, topicsBySubject, onSaved, onClose, firstTime = false }) {
  // Painted free time where the student has any; otherwise a first guess from
  // their old minutes per day, for them to paint over.
  const [slots, setSlots] = useState(() => {
    const guess = slotsFromMinutes(settings.week)
    return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, settings.slots?.[d] ?? guess[d]]))
  })
  const [style, setStyle] = useState(() => ({ ...settings.style, custom: { ...settings.style.custom } }))
  const [taught, setTaught] = useState(() =>
    Object.fromEntries(subjects.map((s) => [s, Array.isArray(settings.taught?.[s]) ? settings.taught[s] : []]))
  )
  const [open, setOpen] = useState(null)
  const [focusOpen, setFocusOpen] = useState(null)
  const [editingExam, setEditingExam] = useState(null)
  const [exams, setExams] = useState(() => ({ ...settings.exams }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const targets = profile?.target_grades || {}
  const missingTargets = subjects.filter((s) => !targets[s])
  const freeDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => (slots[d] || []).length)

  const toggleMethod = (m) =>
    setStyle((s) => ({ ...s, methods: s.methods.includes(m) ? s.methods.filter((x) => x !== m) : [...s.methods, m] }))
  const toggleFocus = (day, subject) =>
    setStyle((s) => {
      const now = s.focusDays?.[day] || []
      const next = now.includes(subject) ? now.filter((x) => x !== subject) : [...now, subject].slice(-2)
      return { ...s, focusDays: { ...s.focusDays, [day]: next } }
    })
  const toggleTopic = (subject, topic) =>
    setTaught((t) => {
      const now = t[subject] || []
      return { ...t, [subject]: now.includes(topic) ? now.filter((x) => x !== topic) : [...now, topic] }
    })

  const save = async () => {
    setSaving(true)
    setError(null)
    const week = Object.fromEntries(
      Object.entries(slots).map(([d, list]) => [d, (list || []).reduce((n, [a, b]) => n + (b - a), 0)])
    )
    const plan_settings = {
      slots,
      // Kept alongside, for anything that only reads minutes per day.
      week,
      style: {
        rhythm: style.rhythm,
        custom: style.custom,
        order: style.order,
        mix: style.mix,
        methods: style.methods,
        focusDays: Object.fromEntries(Object.entries(style.focusDays || {}).filter(([, v]) => v?.length)),
      },
      taught: Object.fromEntries(Object.entries(taught).filter(([, v]) => v.length)),
      exams: Object.fromEntries(Object.entries(exams).filter(([, v]) => /^\d{4}-\d{2}-\d{2}$/.test(v || ''))),
    }
    const supabase = createClient()
    const { error: e } = await supabase.from('profiles').update({ plan_settings }).eq('id', profile.id)
    setSaving(false)
    if (e) {
      setError('That did not save. Check your connection and try again.')
      return
    }
    invalidateProfile(profile.id)
    onSaved?.(plan_settings)
  }

  return (
    <div className="elev rounded-[16px] border p-5 sm:p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="t-overline">{firstTime ? 'One minute to set up' : 'Your plan'}</p>
          <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em]">How you study</h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            The plan fits around this. Change any of it whenever your week changes.
          </p>
        </div>
        {!firstTime && onClose && (
          <button type="button" onClick={onClose} className="btn btn-quiet control-sm shrink-0">
            Close
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Section
          title="When you are free"
          hint="Drag over the hours you can study. The plan puts real times on your day, with breaks, inside these. Gaps between them count as breaks too."
        >
          <WeekGrid value={slots} onChange={setSlots} />
        </Section>

        <Section title="Your rhythm" hint="How long you work before a break, and how long the break is.">
          <div role="radiogroup" aria-label="Rhythm" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(RHYTHMS).map(([key, r]) => (
              <Choice key={key} on={style.rhythm === key} onClick={() => setStyle((s) => ({ ...s, rhythm: key }))} title={r.label} hint={r.hint} />
            ))}
          </div>
          {style.rhythm === 'custom' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
              <span style={{ color: 'var(--text-muted)' }}>Work</span>
              <input
                type="number"
                min={10}
                max={180}
                step={5}
                value={style.custom.work}
                onChange={(e) => setStyle((s) => ({ ...s, custom: { ...s.custom, work: e.target.value } }))}
                className={`${field} w-20 text-center tabular-nums`}
                aria-label="Minutes of work"
              />
              <span style={{ color: 'var(--text-muted)' }}>min, then a break of</span>
              <input
                type="number"
                min={0}
                max={60}
                step={5}
                value={style.custom.rest}
                onChange={(e) => setStyle((s) => ({ ...s, custom: { ...s.custom, rest: e.target.value } }))}
                className={`${field} w-20 text-center tabular-nums`}
                aria-label="Minutes of break"
              />
              <span style={{ color: 'var(--text-muted)' }}>min</span>
            </div>
          )}
        </Section>

        <Section title="How you like to study" hint="Pick everything that works for you. Your tasks are built from these.">
          <div className="flex flex-wrap gap-2">
            {Object.entries(METHODS).map(([key, name]) => (
              <Chip key={key} on={style.methods.includes(key)} onClick={() => toggleMethod(key)}>
                {name}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Learn and revise first, or questions first?">
          <div role="radiogroup" aria-label="Order" className="grid gap-2 sm:grid-cols-3">
            {ORDERS.map(([key, title, hint]) => (
              <Choice key={key} on={style.order === key} onClick={() => setStyle((s) => ({ ...s, order: key }))} title={title} hint={hint} />
            ))}
          </div>
        </Section>

        <Section title="Mix subjects, or focus?">
          <div role="radiogroup" aria-label="Mix" className="grid gap-2 sm:grid-cols-2">
            {MIXES.map(([key, title, hint]) => (
              <Choice key={key} on={style.mix === key} onClick={() => setStyle((s) => ({ ...s, mix: key }))} title={title} hint={hint} />
            ))}
          </div>
          {style.mix === 'focus' && (
            <div className="mt-4 flex flex-col gap-2.5">
              <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                Choose up to two subjects for each day, or leave a day for the plan to choose.
              </p>
              {freeDays.length === 0 && (
                <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  Paint some free time above first.
                </p>
              )}
              {/* One row per day, opening a short list — seven long subject
                  names repeated on every day was a wall of chips. */}
              <ul className="flex flex-col">
                {freeDays.map((d) => {
                  const chosen = style.focusDays?.[d] || []
                  const isOpen = focusOpen === d
                  return (
                    <li key={d} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setFocusOpen(isOpen ? null : d)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-3 py-2 text-left"
                      >
                        <span className="w-9 shrink-0 text-[12.5px] font-medium">{WEEKDAYS[d]}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: chosen.length ? 'var(--text-body)' : 'var(--text-muted)' }}>
                          {chosen.length ? chosen.join(', ') : 'Plan decides'}
                        </span>
                        <span aria-hidden="true" className="text-[12px] transition-transform" style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                          ▾
                        </span>
                      </button>
                      {isOpen && (
                        <div className="flex flex-wrap gap-1.5 pb-3 pl-12">
                          <Chip on={chosen.length === 0} onClick={() => setStyle((s) => ({ ...s, focusDays: { ...s.focusDays, [d]: [] } }))}>
                            Plan decides
                          </Chip>
                          {subjects.map((subject) => (
                            <Chip key={subject} on={chosen.includes(subject)} onClick={() => toggleFocus(d, subject)}>
                              {subject}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Section>

        <Section
          title="Topics you have covered in class"
          hint="Tick the ones your class has done, in whatever order your school teaches them. Leave a subject on all topics if you are revising everything."
        >
          <ul className="flex flex-col">
            {subjects.map((subject) => {
              const topics = topicsBySubject[subject] || []
              const ticked = taught[subject] || []
              const expanded = open === subject
              return (
                <li key={subject} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : subject)}
                    aria-expanded={expanded}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                  >
                    <span className="text-[13px]">{subject}</span>
                    <span className="flex items-center gap-2 text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {ticked.length ? `${ticked.length} of ${topics.length} topics` : 'All topics'}
                      <span aria-hidden="true" className="transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
                        ▾
                      </span>
                    </span>
                  </button>
                  {expanded && (
                    <div className="pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {topics.map((topic) => (
                          <Chip key={topic} on={ticked.includes(topic)} onClick={() => toggleTopic(subject, topic)}>
                            {topic}
                          </Chip>
                        ))}
                      </div>
                      {ticked.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTaught((t) => ({ ...t, [subject]: [] }))}
                          className="mt-2 text-[12px] font-medium hover:underline"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Back to all topics
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>

        <Section title="Exam dates" hint="Filled in from your exam session. Change any that are different for you.">
          {/* Dates as text, with a picker only when one is being changed: a
              column of date inputs was the bulkiest thing on the panel, and
              on a phone they cannot be made smaller without iOS zooming in. */}
          <ul className="flex flex-col">
            {subjects.map((subject) => {
              const guess = examDateFor(subject, profile, { exams: {} })
              const value = exams[subject] || (guess ? dateKey(guess) : '')
              const shown = value ? new Date(`${value}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'
              const edited = Boolean(exams[subject])
              return (
                <li key={subject} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="min-w-0 truncate text-[12.5px]">{subject}</span>
                  {editingExam === subject ? (
                    <input
                      type="date"
                      autoFocus
                      value={value}
                      onChange={(e) => setExams((x) => ({ ...x, [subject]: e.target.value }))}
                      onBlur={() => setEditingExam(null)}
                      className={`${field} w-[9.5rem] shrink-0 tabular-nums`}
                      aria-label={`${subject} exam date`}
                    />
                  ) : (
                    <span className="flex shrink-0 items-center gap-3 text-[12.5px] tabular-nums">
                      <span style={{ color: edited ? 'var(--text)' : 'var(--text-muted)' }}>{shown}</span>
                      <button type="button" onClick={() => setEditingExam(subject)} className="font-medium text-[var(--brand)] hover:underline">
                        Change
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </Section>

        <Section title="Your targets">
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {missingTargets.length
              ? `The plan spends the most time where you are furthest from your target, so it needs one for each subject. ${
                  missingTargets.length === subjects.length ? 'None are set yet.' : `${missingTargets.join(', ')} ${missingTargets.length === 1 ? 'has' : 'have'} none.`
                } `
              : `${subjects.map((s) => `${s} ${targets[s]}`).join(' · ')} `}
            <Link href="/dashboard/prediction" className="font-medium text-[var(--brand)] hover:underline">
              {missingTargets.length ? 'Set targets' : 'Change'}
            </Link>
          </p>
        </Section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={save} disabled={saving} className="btn btn-solid control-md">
          {saving ? 'Saving…' : firstTime ? 'Build my plan' : 'Save'}
        </button>
        {!firstTime && onClose && (
          <button type="button" onClick={onClose} className="btn btn-quiet control-md">
            Cancel
          </button>
        )}
        {error && (
          <p role="alert" className="text-[13px]" style={{ color: 'var(--status-weak)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
