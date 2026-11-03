'use client'

/**
 * How you study best, the screens: intro, nine questions, your study type
 * (lib/study-style.js). Saving is the caller's: onResult when the questions
 * are done, onApply when the plan should change. Used by
 * /dashboard/study-style and its development preview.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { QUESTIONS, METHODS, TYPES, resultOf } from '@/lib/study-style'
import { METHODS as PLAN_METHODS, RHYTHMS } from '@/lib/study-plan'

const Arrow = ({ back = false }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {back ? <path d="M15 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
  </svg>
)

function Intro({ onStart }) {
  return (
    <div className="app-enter mx-auto max-w-xl py-6 text-center md:py-12">
      <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
        About 2 minutes
      </p>
      <h1 className="text-[clamp(1.9rem,5vw,2.6rem)] font-semibold leading-[1.06] tracking-[-0.032em]">How do you study best?</h1>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.6]" style={{ color: 'var(--text-body)' }}>
        Nine quick questions about how you revise now. You get your study type, the habits worth changing, the methods that suit you, and your plan set up to match. Not sure what works for you? Every question has an answer for that.
      </p>
      <button type="button" onClick={onStart} className="btn btn-solid control-lg mt-8">
        Start
        <Arrow />
      </button>
      <p className="mx-auto mt-6 max-w-sm text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Every method here has research behind it. No visual, auditory or hands-on labels: those have been tested, and they do not help.
      </p>
    </div>
  )
}

function Question({ index, question, value, onAnswer, onBack }) {
  const [picked, setPicked] = useState(() => (question.multi ? value || [] : value))
  // "Pick for me" stands alone: choosing it clears the rest, and the rest clear it.
  const only = new Set(question.options.filter((o) => o.only).map((o) => o.v))
  const toggle = (v) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : only.has(v) ? [v] : [...p.filter((x) => !only.has(x)), v]))
  const choose = (v) => {
    setPicked(v)
    // A moment to see the choice land before the next question.
    setTimeout(() => onAnswer(v), 180)
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center gap-3">
        <button type="button" onClick={onBack} className="flex h-9 shrink-0 items-center gap-1 rounded-full border pl-2.5 pr-3.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}>
          <Arrow back />
          Back
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-sunken)' }}>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${((index + 1) / QUESTIONS.length) * 100}%`, background: 'var(--brand)', transitionTimingFunction: 'cubic-bezier(.16,1,.3,1)' }} />
        </div>
        <span className="shrink-0 text-[12px] font-medium tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {index + 1} of {QUESTIONS.length}
        </span>
      </div>

      <div key={question.key} className="app-enter">
        <h2 className="text-[clamp(1.4rem,3.6vw,1.8rem)] font-semibold leading-tight tracking-[-0.025em]">{question.q}</h2>
        {question.hint && (
          <p className="mt-2 text-[14px]" style={{ color: 'var(--text-muted)' }}>
            {question.hint}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2.5" role={question.multi ? 'group' : 'radiogroup'} aria-label={question.q}>
          {question.options.map((o) => {
            const on = question.multi ? picked.includes(o.v) : picked === o.v
            return (
              <button
                key={o.v}
                type="button"
                role={question.multi ? 'checkbox' : 'radio'}
                aria-checked={on}
                onClick={() => (question.multi ? toggle(o.v) : choose(o.v))}
                className="flex w-full items-center gap-3 rounded-[14px] border px-4 py-3.5 text-left text-[15px] font-medium transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px"
                style={{ borderColor: on ? 'var(--brand)' : 'var(--border-strong)', background: on ? 'var(--brand-tint)' : 'var(--surface)', color: 'var(--text)' }}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${question.multi ? 'rounded-[6px]' : 'rounded-full'}`}
                  style={{ borderColor: on ? 'var(--brand)' : 'var(--border-strong)', background: on ? 'var(--brand)' : 'transparent' }}
                >
                  {on && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
                {o.label}
              </button>
            )
          })}
        </div>

        {question.multi && (
          <button type="button" onClick={() => onAnswer(picked)} disabled={!picked.length} className="btn btn-solid control-lg mt-6 w-full disabled:opacity-50">
            Next
            <Arrow />
          </button>
        )}
      </div>
    </div>
  )
}

function Result({ answers, onRetake, onReview, onApply, applied, saving }) {
  const r = useMemo(() => resultOf(answers), [answers])
  const type = TYPES[r.type]
  const also = r.also && TYPES[r.also]
  const rhythm = RHYTHMS[r.setup.rhythm]

  return (
    <div className="mx-auto max-w-3xl">
      <div className="app-enter text-center">
        <p className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
          Your study type
        </p>
        <h1 className="text-[clamp(2.2rem,6vw,3.2rem)] font-bold leading-[1.02] tracking-[-0.04em]">{type.name}</h1>
        {also && (
          <p className="mt-3 text-[14px] font-medium" style={{ color: 'var(--brand)' }}>
            with a bit of {also.name}
          </p>
        )}
        <p className="mx-auto mt-4 max-w-lg text-[15.5px] leading-[1.6]" style={{ color: 'var(--text-body)' }}>
          {type.line}
        </p>
      </div>

      {r.good.length > 0 && (
        <section className="app-enter mt-10" style={{ animationDelay: '60ms' }}>
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">Already working for you</h2>
          <div className="flex flex-wrap gap-2">
            {r.good.map((g) => (
              <span key={g} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium" style={{ background: 'var(--brand-tint)', color: 'var(--text)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {g}
              </span>
            ))}
          </div>
        </section>
      )}

      {r.bad.length > 0 && (
        <section className="app-enter mt-10" style={{ animationDelay: '90ms' }}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Habits to change</h2>
            <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
              They feel useful. They are not.
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {r.bad.slice(0, 4).map((h) => (
              <div key={h.name} className="rounded-[16px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <h3 className="flex items-center gap-2.5 text-[15px] font-semibold">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--status-weak, #c4664a)' }} />
                  {h.name}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                  {h.why}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                  <span className="font-semibold" style={{ color: 'var(--brand)' }}>
                    Instead:{' '}
                  </span>
                  {h.instead}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="app-enter mt-10" style={{ animationDelay: '120ms' }}>
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">{r.bad.length ? 'Your mix: what to do instead' : 'Your mix'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {r.methods.map((k, i) => {
            const m = METHODS[k]
            return (
              <div key={k} className="flex flex-col rounded-[16px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                    {i + 1}
                  </span>
                  <h3 className="text-[15px] font-semibold">{m.name}</h3>
                </div>
                <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                  {m.what}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>
                    Here:{' '}
                  </span>
                  {m.how}
                </p>
                <Link href={m.href} className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[13px] font-medium" style={{ color: 'var(--brand)' }}>
                  Try it
                  <Arrow />
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {r.block && (
        <section className="app-enter mt-6 rounded-[16px] border px-5 py-4" style={{ animationDelay: '140ms', borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-[13px] font-semibold">What gets in your way</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {r.block}
          </p>
        </section>
      )}

      <section className="app-enter mt-6 rounded-[16px] border p-5 sm:p-6" style={{ animationDelay: '200ms', borderColor: applied ? 'var(--brand)' : 'var(--border-strong)', background: 'var(--surface)' }}>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Your plan, set to match</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2">
          {[
            ['Sessions', rhythm ? `${rhythm.label} minutes · ${rhythm.hint}` : '25 / 5 minutes'],
            ['Each day', r.setup.mix === 'focus' ? 'One or two subjects' : 'A few subjects, mixed'],
            ['Methods', r.setup.methods.map((m) => PLAN_METHODS[m]).filter(Boolean).join(', ')],
            ['Daily goal', `${r.setup.goal} minutes`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11.5px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
                {k}
              </dt>
              <dd className="mt-0.5" style={{ color: 'var(--text-body)' }}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {applied ? (
            <>
              <span className="inline-flex items-center gap-2 text-[13.5px] font-medium" style={{ color: 'var(--brand)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                Your plan uses this now
              </span>
              <Link href="/dashboard/study-plan" className="btn btn-outline control-md">
                Open your plan
              </Link>
            </>
          ) : (
            <>
              <button type="button" onClick={onApply} disabled={saving} className="btn btn-solid control-md disabled:opacity-60">
                {saving ? 'Saving…' : 'Use this in my plan'}
              </button>
              <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                You can change any of it in the plan&apos;s settings.
              </span>
            </>
          )}
        </div>
      </section>

      <p className="mt-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
        <button type="button" onClick={onReview} className="font-medium hover:underline" style={{ color: 'var(--brand)' }}>
          Change an answer
        </button>
        <span className="mx-2" style={{ color: 'var(--text-faint)' }}>
          ·
        </span>
        <button type="button" onClick={onRetake} className="font-medium hover:underline" style={{ color: 'var(--brand)' }}>
          Start again
        </button>
      </p>
    </div>
  )
}

/** Every answer before the result, each one a tap away from changing. */
function Review({ answers, onEdit, onBack, onDone }) {
  const labelOf = (q) => {
    const v = answers[q.key]
    const vs = Array.isArray(v) ? v : [v]
    return vs.map((x) => q.options.find((o) => o.v === x)?.label).filter(Boolean).join(', ') || 'Not answered'
  }
  const missing = QUESTIONS.some((q) => answers[q.key] == null || (Array.isArray(answers[q.key]) && !answers[q.key].length))
  return (
    <div className="app-enter mx-auto max-w-xl">
      <div className="mb-8 flex items-center gap-3">
        <button type="button" onClick={onBack} className="flex h-9 shrink-0 items-center gap-1 rounded-full border pl-2.5 pr-3.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}>
          <Arrow back />
          Back
        </button>
      </div>
      <h2 className="text-[clamp(1.4rem,3.6vw,1.8rem)] font-semibold leading-tight tracking-[-0.025em]">Check your answers</h2>
      <p className="mt-2 text-[14px]" style={{ color: 'var(--text-muted)' }}>
        Tap any of them to change it.
      </p>
      <ol className="mt-6 flex flex-col gap-2">
        {QUESTIONS.map((q, i) => (
          <li key={q.key}>
            <button
              type="button"
              onClick={() => onEdit(i)}
              className="flex w-full items-start gap-3 rounded-[14px] border px-4 py-3 text-left transition-colors hover:bg-[var(--surface-sunken)]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <span className="mt-0.5 w-5 shrink-0 text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-faint)' }}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                  {q.q}
                </span>
                <span className="mt-0.5 block text-[14px] font-medium" style={{ color: 'var(--text)' }}>
                  {labelOf(q)}
                </span>
              </span>
              <span className="mt-0.5 shrink-0 text-[12.5px] font-medium" style={{ color: 'var(--brand)' }}>
                Change
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onDone} disabled={missing} className="btn btn-solid control-lg mt-6 w-full disabled:opacity-50">
        See my result
        <Arrow />
      </button>
    </div>
  )
}

export default function StudyStyle({ initialAnswers = null, initialApplied = false, onResult, onApply }) {
  // null intro, 0..n-1 a question, 'review' check your answers, 'result'
  const [step, setStep] = useState(initialAnswers ? 'result' : null)
  const [answers, setAnswers] = useState(initialAnswers || {})
  const [applied, setApplied] = useState(initialApplied)
  const [saving, setSaving] = useState(false)
  // Changing one answer from the review goes straight back to it.
  const [editing, setEditing] = useState(false)

  const go = (to) => {
    setStep(to)
    window.scrollTo({ top: 0 })
  }

  const answer = (v) => {
    const next = { ...answers, [QUESTIONS[step].key]: v }
    setAnswers(next)
    if (editing || step === QUESTIONS.length - 1) {
      setEditing(false)
      return go('review')
    }
    go(step + 1)
  }

  const finish = () => {
    setApplied(false)
    go('result')
    onResult?.(answers)
  }

  const apply = async () => {
    setSaving(true)
    if (await onApply?.(answers)) setApplied(true)
    setSaving(false)
  }

  return (
    <>
      {step === null && <Intro onStart={() => go(0)} />}
      {typeof step === 'number' && (
        <Question
          key={QUESTIONS[step].key}
          index={step}
          question={QUESTIONS[step]}
          value={answers[QUESTIONS[step].key]}
          onAnswer={answer}
          onBack={() => {
            if (editing) {
              setEditing(false)
              return go('review')
            }
            go(step === 0 ? null : step - 1)
          }}
        />
      )}
      {step === 'review' && (
        <Review
          answers={answers}
          onEdit={(i) => {
            setEditing(true)
            go(i)
          }}
          onBack={() => go(QUESTIONS.length - 1)}
          onDone={finish}
        />
      )}
      {step === 'result' && (
        <Result
          answers={answers}
          applied={applied}
          saving={saving}
          onApply={apply}
          onReview={() => go('review')}
          onRetake={() => {
            setAnswers({})
            go(0)
          }}
        />
      )}
    </>
  )
}
