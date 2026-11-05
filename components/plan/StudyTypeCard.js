'use client'

/**
 * Your study type, always on the plan page: what it is, the methods your plan
 * is built from, and the settings it gave the plan, each with its reason.
 * Before the quiz is taken, an invitation to it. The quiz itself opens in
 * StudyTypePanel, in place of this card.
 */

import { useMemo } from 'react'
import { TYPES, METHODS, resultOf } from '@/lib/study-style'
import { RHYTHMS } from '@/lib/study-plan'

const Arrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export default function StudyTypeCard({ profile, onOpen, onRetake }) {
  const saved = profile?.plan_settings?.studyStyle
  const r = useMemo(() => (saved?.answers ? resultOf(saved.answers) : null), [saved])

  if (!r) {
    return (
      <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border px-5 py-4" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }} aria-label="Find your study type">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold">Find your study type</p>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-body)' }}>
            Nine quick questions. Your plan gets the session length, methods and daily goal that suit how you work, and the habits worth changing.
          </p>
        </div>
        <button type="button" onClick={onOpen} className="btn btn-solid control-md shrink-0">
          Start, 2 min
          <Arrow />
        </button>
      </section>
    )
  }

  const type = TYPES[r.type]
  const work = r.setup.custom?.work ?? RHYTHMS[r.setup.rhythm]?.work
  const rest = r.setup.custom?.rest ?? RHYTHMS[r.setup.rhythm]?.rest
  const settings = [
    ['Sessions', Number.isFinite(work) ? `${work} on, ${rest} off` : 'No set breaks'],
    ['Each day', r.setup.mix === 'focus' ? 'One or two subjects' : 'A few subjects'],
    ['Daily goal', `${r.setup.goal} min`],
  ]

  return (
    <section className="mb-8 rounded-[16px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label="Your study type">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
            Your study type{saved.applied ? ', in this plan' : ''}
          </p>
          <p className="mt-1.5 text-[19px] font-bold leading-tight tracking-[-0.03em]">
            {type.name}
            {r.also && (
              <span className="ml-2 text-[13px] font-medium tracking-normal" style={{ color: 'var(--brand)' }}>
                with a bit of {TYPES[r.also].name}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onOpen} className="btn btn-outline control-sm">
            {saved.applied ? 'See it all' : 'Use it in my plan'}
          </button>
          <button type="button" onClick={onRetake} className="btn btn-quiet control-sm">
            Retake
          </button>
        </div>
      </div>

      {/* The methods tasks are built from. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {r.methods.map((k) => (
          <span key={k} className="rounded-full px-2.5 py-1 text-[12px] font-medium" title={METHODS[k].what} style={{ background: 'var(--brand-tint)', color: 'var(--text)' }}>
            {METHODS[k].name}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-[13px]" style={{ borderColor: 'var(--border)' }}>
        {settings.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
              {k}
            </dt>
            <dd className="mt-0.5 font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {r.bad[0] && (
        <p className="mt-4 rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed" style={{ background: 'var(--surface-sunken)', color: 'var(--text-body)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>
            Habit to change: {r.bad[0].name.toLowerCase()}.{' '}
          </span>
          {r.bad[0].instead}
          {r.bad.length > 1 && (
            <button type="button" onClick={onOpen} className="ml-1 font-medium hover:underline" style={{ color: 'var(--brand)' }}>
              {r.bad.length - 1} more
            </button>
          )}
        </p>
      )}
    </section>
  )
}
