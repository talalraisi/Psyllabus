'use client'

import { useState } from 'react'
import Link from 'next/link'
import MathText from '@/components/MathText'
import QuestionFigure from '@/components/QuestionFigure'
import { IconCheck, IconClose, IconArrowLeft, IconArrowRight } from '@/components/Icons'
import { gradeShortAnswer } from '@/lib/grading'
import { checkWritten } from '@/lib/flashcard-modes'
import { displaySubtopic } from '@/lib/progress'

/**
 * One interactive lesson, a step at a time.
 *
 * Each section ends with a question that has to be answered before moving
 * on, because reading an explanation and understanding it feel the same
 * until you are asked something. The worked example reveals one step at a
 * time for the same reason. It ends on "What you should know now": the
 * guide's statements for the subtopic, each with a question that tests it,
 * so finishing the lesson means having shown it rather than having scrolled
 * to the bottom. What was missed becomes flashcards and a practice link.
 *
 * Presentational: the page loads the lesson and saves progress.
 */

export function markCheck(check, response) {
  if (response == null || String(response).trim() === '') return false
  if (check.type === 'mcq') return response === check.correct_answer
  const accepted = check.accepted_answers || []
  if (check.answer_kind === 'numeric') return gradeShortAnswer({ accepted_answers: accepted, answer_kind: 'numeric' }, response).correct
  return checkWritten(response, accepted.join(' / ')).correct || checkWritten(response, accepted.join(' / ')).close
}

function rightAnswer(check) {
  if (check.type === 'mcq') return check.options.find((o) => o.id === check.correct_answer)?.text
  return (check.accepted_answers || [])[0]
}

function Check({ check, answer, onAnswer, label = 'Quick check' }) {
  const [typed, setTyped] = useState('')
  const done = answer != null
  const pick = (response) => !done && onAnswer({ response, correct: markCheck(check, response) })
  const wrongWhy = done && !answer.correct && check.type === 'mcq' ? check.options.find((o) => o.id === answer.response)?.why_wrong : null

  return (
    <div className="mt-6 rounded-[16px] border p-4 sm:p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
        {label}
      </p>
      <p className="mt-2 text-[15.5px] leading-relaxed">
        <MathText>{check.stem}</MathText>
      </p>
      {check.type === 'mcq' ? (
        <div className="mt-3 flex flex-col gap-2">
          {check.options.map((o) => {
            const chosen = answer?.response === o.id
            const isRight = done && o.id === check.correct_answer
            return (
              <button
                key={o.id}
                type="button"
                disabled={done}
                onClick={() => pick(o.id)}
                className="flex items-start gap-3 rounded-[12px] border px-3.5 py-2.5 text-left text-[14.5px] transition-colors disabled:cursor-default"
                style={{
                  borderColor: isRight ? 'var(--status-proficient)' : chosen ? 'var(--status-weak)' : 'var(--border)',
                  background: isRight ? 'color-mix(in oklab, var(--status-proficient) 10%, transparent)' : 'var(--surface)',
                }}
              >
                <span className="mt-px text-[12px] font-semibold uppercase" style={{ color: 'var(--text-faint)' }}>
                  {o.id}
                </span>
                <span className="min-w-0">
                  <MathText>{o.text}</MathText>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) pick(typed.trim())
          }}
        >
          <input
            value={done ? answer.response : typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={done}
            placeholder="Type the answer"
            autoComplete="off"
            className="input h-11 flex-1 text-[16px] sm:text-[15px]"
          />
          {!done && (
            <button type="submit" disabled={!typed.trim()} className="btn btn-solid control-lg disabled:opacity-40">
              Check
            </button>
          )}
        </form>
      )}
      {done && (
        <div className="verdict-in mt-3 border-l-2 pl-3" style={{ borderColor: answer.correct ? 'var(--status-proficient)' : 'var(--status-weak)' }}>
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: answer.correct ? 'var(--status-proficient)' : 'var(--status-weak)' }}>
            {answer.correct ? <IconCheck width={14} height={14} /> : <IconClose width={13} height={13} />}
            {answer.correct ? 'Right' : 'Not quite'}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            <MathText>{answer.correct ? check.feedback_right : wrongWhy || check.feedback_wrong}</MathText>
          </p>
          {!answer.correct && (
            <p className="mt-1 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              Answer: <MathText>{String(rightAnswer(check) ?? '')}</MathText>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function WorkedExample({ example }) {
  const [shown, setShown] = useState(1)
  const steps = example.steps || []
  return (
    <div>
      <p className="text-[16px] leading-relaxed">
        <MathText>{example.problem}</MathText>
      </p>
      <ol className="mt-5 flex flex-col gap-3">
        {steps.slice(0, shown).map((step, i) => (
          <li key={i} className="verdict-in flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
              {i + 1}
            </span>
            <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              <MathText>{step}</MathText>
            </p>
          </li>
        ))}
      </ol>
      {shown < steps.length ? (
        <button type="button" onClick={() => setShown((n) => n + 1)} className="btn btn-outline control-md mt-5">
          Show the next step
        </button>
      ) : (
        <p className="verdict-in mt-5 rounded-[12px] px-4 py-3 text-[15px] font-semibold" style={{ background: 'var(--brand-tint)' }}>
          <MathText>{example.answer}</MathText>
        </p>
      )}
    </div>
  )
}

export default function LessonPlayer({ lesson, met = [], onProgress, onAddCards, practiseHref, backHref, backLabel = 'Back' }) {
  const body = lesson.body || {}
  const sections = body.sections || []
  const outcomes = lesson.outcomes || []
  const steps = [
    ...sections.map((s, i) => ({ kind: 'section', title: s.heading, i })),
    { kind: 'example', title: 'Worked example' },
    { kind: 'recap', title: 'Mistakes and key terms' },
    { kind: 'outcomes', title: 'What you should know now' },
  ]
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [added, setAdded] = useState(null)
  const current = steps[step]

  const answer = (key, value) => {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    if (key.startsWith('o')) {
      const metNow = outcomes.map((_, i) => i).filter((i) => next[`o${i}`]?.correct || met.includes(i))
      const finished = outcomes.every((_, i) => next[`o${i}`])
      onProgress?.(metNow, finished)
    }
  }

  const sectionAnswered = current.kind !== 'section' || answers[`s${current.i}`]
  const outcomesDone = outcomes.length > 0 && outcomes.every((_, i) => answers[`o${i}`])
  const missed = outcomes.map((o, i) => ({ o, i })).filter(({ i }) => answers[`o${i}`] && !answers[`o${i}`].correct)

  const addMissed = async () => {
    setAdded('saving')
    const ok = await onAddCards?.(
      missed.map(({ o }) => ({ front: o.check.stem, back: `${rightAnswer(o.check) ?? ''}. ${o.check.feedback_wrong}`.trim() }))
    )
    setAdded(ok ? 'done' : null)
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className="btn btn-quiet control-sm">
          <IconArrowLeft width={14} height={14} />
          {backLabel}
        </Link>
        <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {lesson.minutes ? `About ${lesson.minutes} min · ` : ''}
          {step + 1} of {steps.length}
        </span>
      </div>

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
        {lesson.subject} · Lesson
      </p>
      <h1 className="mt-1.5 text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-[1.15] tracking-[-0.03em]">{displaySubtopic(lesson.subtopic)}</h1>
      {step === 0 && body.intro && (
        <p className="mt-3 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <MathText>{body.intro}</MathText>
        </p>
      )}

      {/* Where you are: a segment per step, filled as you go. */}
      <div className="mt-5 flex gap-1" aria-hidden>
        {steps.map((s, i) => (
          <span key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i <= step ? 'var(--brand)' : 'var(--border)' }} />
        ))}
      </div>

      <section key={step} className="card-enter-next mt-6 rounded-[20px] border p-5 sm:p-7" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{current.title}</h2>

        {current.kind === 'section' && (
          <>
            <div className="mt-3 whitespace-pre-line text-[15.5px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
              <MathText>{sections[current.i].body}</MathText>
            </div>
            {sections[current.i].figure?.kind && sections[current.i].figure.kind !== 'none' && (
              <div className="mt-5">
                <QuestionFigure figure={sections[current.i].figure} />
              </div>
            )}
            <Check check={sections[current.i].check} answer={answers[`s${current.i}`]} onAnswer={(v) => answer(`s${current.i}`, v)} />
          </>
        )}

        {current.kind === 'example' && body.worked_example && (
          <div className="mt-3">
            <WorkedExample example={body.worked_example} />
          </div>
        )}

        {current.kind === 'recap' && (
          <div className="mt-3">
            {body.mistakes?.length > 0 && (
              <>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Common mistakes
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {body.mistakes.map((m, i) => (
                    <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      <IconClose width={13} height={13} className="mt-1.5 shrink-0" style={{ color: 'var(--status-weak)' }} />
                      <span>
                        <MathText>{m}</MathText>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {body.key_terms?.length > 0 && (
              <>
                <p className="mt-6 text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Key terms
                </p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  {body.key_terms.map((t) => (
                    <div key={t.term} className="rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: 'var(--border)' }}>
                      <dt className="text-[14px] font-semibold">
                        <MathText>{t.term}</MathText>
                      </dt>
                      <dd className="mt-0.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        <MathText>{t.definition}</MathText>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        )}

        {current.kind === 'outcomes' && (
          <div className="mt-2">
            <p className="text-[14.5px]" style={{ color: 'var(--text-muted)' }}>
              One question for each thing the IB expects you to be able to do. Answer them all to finish.
            </p>
            {outcomes.map((o, i) => {
              const a = answers[`o${i}`]
              return (
                <div key={i} className="mt-6">
                  <p className="flex items-start gap-2 text-[15px] font-semibold leading-snug">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: a ? (a.correct ? 'var(--status-proficient)' : 'var(--status-weak)') : 'var(--border)', color: '#fff' }}
                    >
                      {a && (a.correct ? <IconCheck width={11} height={11} /> : <IconClose width={10} height={10} />)}
                    </span>
                    <MathText>{o.statement}</MathText>
                  </p>
                  <Check check={o.check} answer={a} onAnswer={(v) => answer(`o${i}`, v)} label="Show it" />
                </div>
              )
            })}

            {outcomesDone && (
              <div className="pop-enter mt-8 rounded-[16px] p-5" style={{ background: missed.length ? 'var(--surface-sunken)' : 'var(--brand-tint)' }}>
                <p className="text-[16px] font-semibold">
                  {missed.length ? `You showed ${outcomes.length - missed.length} of ${outcomes.length}.` : 'You can do everything this lesson covers.'}
                </p>
                <p className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                  {missed.length
                    ? 'The ones you missed are worth another look before you move on.'
                    : 'Practise it now while it is fresh, and it will stick.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {missed.length > 0 && (
                    <button type="button" onClick={addMissed} disabled={added != null} className="btn btn-outline control-md disabled:opacity-60">
                      {added === 'done' ? 'Added to your flashcards' : added === 'saving' ? 'Adding…' : `Add ${missed.length === 1 ? 'it' : 'them'} to my flashcards`}
                    </button>
                  )}
                  <Link href={practiseHref} className="btn btn-solid control-md">
                    Practise this subtopic
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="btn btn-quiet control-md disabled:opacity-40">
          <IconArrowLeft width={15} height={15} />
          Back
        </button>
        <div className="flex-1" />
        {step < steps.length - 1 && (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!sectionAnswered} className="btn btn-solid control-md disabled:opacity-40" title={sectionAnswered ? undefined : 'Answer the quick check first'}>
            Continue
            <IconArrowRight width={15} height={15} />
          </button>
        )}
      </div>
    </div>
  )
}
