'use client'

/**
 * How the student studies, in one place: their week, their rhythm, the order
 * they like to work in, where each class has got to, and their exam dates.
 *
 * Everything here is a real difference between students, and the plan asks
 * rather than guessing. Saved together to profiles.plan_settings (migration
 * 060). Only what the student actually chose is stored: an unset exam date or
 * "everything" for a class stays unset, so a better default later reaches
 * them instead of being frozen by a save.
 */

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { invalidateProfile } from '@/lib/cache'
import { WEEKDAYS, RHYTHMS, examDateFor, dateKey } from '@/lib/study-plan'

// The Omani week starts on Sunday, which is who the pilot is.
const DAY_ORDER = [0, 1, 2, 3, 4, 5, 6]

const ORDERS = [
  ['auto', 'Let the plan decide', 'Read first when you got it wrong, test first when it is half there'],
  ['questions', 'Questions first', 'Find the gaps, then read up on them'],
  ['reading', 'Reading first', 'Go through it, then test yourself'],
]
const MIXES = [
  ['mixed', 'Mix subjects', 'Several subjects a day, never the same one twice in a row'],
  ['focus', 'One subject at a time', 'One or two subjects a day, in depth'],
]

function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([key, title, hint]) => {
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(key)}
            className="min-w-[9.5rem] flex-1 rounded-[12px] border px-3.5 py-2.5 text-left transition-colors"
            style={{
              borderColor: on ? 'var(--brand)' : 'var(--border)',
              background: on ? 'color-mix(in srgb, var(--brand) 8%, var(--surface))' : 'var(--surface)',
            }}
          >
            <span className="block text-[13.5px] font-medium">{title}</span>
            {hint && (
              <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                {hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="border-t pt-6 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <h3 className="text-[15px] font-semibold tracking-[-0.012em]">{title}</h3>
      {hint && (
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function PlanSettings({ profile, settings, subjects, topicsBySubject, onSaved, onClose, firstTime = false }) {
  const [week, setWeek] = useState(() => ({ ...settings.week }))
  const [style, setStyle] = useState(() => ({ ...settings.style }))
  const [taught, setTaught] = useState(() => ({ ...settings.taught }))
  const [exams, setExams] = useState(() => ({ ...settings.exams }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const total = DAY_ORDER.reduce((n, d) => n + (Number(week[d]) || 0), 0)
  const targets = profile?.target_grades || {}
  const missingTargets = subjects.filter((s) => !targets[s])

  const save = async () => {
    setSaving(true)
    setError(null)
    const plan_settings = {
      week: Object.fromEntries(DAY_ORDER.map((d) => [d, Math.max(0, Math.min(600, Math.round(Number(week[d]) || 0)))])),
      style,
      taught: Object.fromEntries(Object.entries(taught).filter(([, v]) => v)),
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
    <div
      className="elev rounded-[16px] border p-6 sm:p-7"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="t-overline">{firstTime ? 'One minute to set up' : 'Your plan'}</p>
          <h2 className="mt-2 text-[clamp(1.2rem,2.2vw,1.45rem)] font-semibold tracking-[-0.022em]">
            How you study
          </h2>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            The plan fits around this. Change any of it whenever your week changes.
          </p>
        </div>
        {!firstTime && onClose && (
          <button type="button" onClick={onClose} className="btn btn-quiet control-sm shrink-0">
            Close
          </button>
        )}
      </div>

      <div className="flex flex-col gap-7">
        <Section
          title="Your week"
          hint="Minutes you can realistically study each day. Zero is a day off. Tests on your calendar are planned around automatically."
        >
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DAY_ORDER.map((d) => (
              <label key={d} className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  {WEEKDAYS[d]}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={600}
                  step={15}
                  value={week[d]}
                  onChange={(e) => setWeek((w) => ({ ...w, [d]: e.target.value }))}
                  className="input w-full text-center tabular-nums"
                  aria-label={`Minutes on ${WEEKDAYS[d]}`}
                />
              </label>
            ))}
          </div>
          <p className="mt-2.5 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {Math.floor(total / 60)}h {String(total % 60).padStart(2, '0')}m a week
          </p>
        </Section>

        <Section title="Your rhythm" hint="How long you work before a break. Breaks come out of your minutes, not on top of them.">
          <Segmented
            label="Rhythm"
            value={style.rhythm}
            onChange={(rhythm) => setStyle((s) => ({ ...s, rhythm }))}
            options={Object.entries(RHYTHMS).map(([key, r]) => [key, r.label, null])}
          />
        </Section>

        <Section title="Reading or questions first?">
          <Segmented label="Order" value={style.order} onChange={(order) => setStyle((s) => ({ ...s, order }))} options={ORDERS} />
        </Section>

        <Section title="Mix or focus?">
          <Segmented label="Mix" value={style.mix} onChange={(mix) => setStyle((s) => ({ ...s, mix }))} options={MIXES} />
          <label className="mt-4 flex items-center gap-3 text-[13.5px]">
            <input
              type="checkbox"
              checked={!!style.cards}
              onChange={(e) => setStyle((s) => ({ ...s, cards: e.target.checked }))}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Use flashcards to keep things I nearly know from slipping
          </label>
        </Section>

        <Section
          title="Where your classes are"
          hint="The plan leaves out topics you have not been taught yet. Leave it on everything if you are revising the whole course."
        >
          <div className="flex flex-col gap-3">
            {subjects.map((subject) => (
              <label key={subject} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13.5px]">{subject}</span>
                <select
                  value={taught[subject] || ''}
                  onChange={(e) => setTaught((t) => ({ ...t, [subject]: e.target.value }))}
                  className="input max-w-[16rem] flex-1"
                  aria-label={`How far ${subject} has got`}
                >
                  <option value="">Everything</option>
                  {(topicsBySubject[subject] || []).map((topic) => (
                    <option key={topic} value={topic}>
                      Up to {topic}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Section>

        <Section
          title="Exam dates"
          hint="Filled in from your exam session. Change any that are different for you, like a paper that sits later."
        >
          <div className="flex flex-col gap-3">
            {subjects.map((subject) => {
              const guess = examDateFor(subject, profile, { exams: {} })
              return (
                <label key={subject} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px]">{subject}</span>
                  <input
                    type="date"
                    value={exams[subject] || (guess ? dateKey(guess) : '')}
                    onChange={(e) => setExams((x) => ({ ...x, [subject]: e.target.value }))}
                    className="input max-w-[12rem] tabular-nums"
                    aria-label={`${subject} exam date`}
                  />
                </label>
              )
            })}
          </div>
        </Section>

        <Section title="Your targets">
          {missingTargets.length ? (
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              The plan spends the most time where you are furthest from your target, so it needs one for each subject.{' '}
              {missingTargets.length === subjects.length ? 'None are set yet.' : `${missingTargets.join(', ')} ${missingTargets.length === 1 ? 'has' : 'have'} none.`}{' '}
              <Link href="/dashboard/prediction" className="font-medium text-[var(--brand)] hover:underline">
                Set targets
              </Link>
            </p>
          ) : (
            <p className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              {subjects.map((s) => `${s} ${targets[s]}`).join(' · ')}{' '}
              <Link href="/dashboard/prediction" className="font-medium text-[var(--brand)] hover:underline">
                Change
              </Link>
            </p>
          )}
        </Section>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
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
