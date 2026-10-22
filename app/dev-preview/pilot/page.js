'use client'

/**
 * The Physics pilot, for review before anything is published. Development
 * only. A spread of questions across every heat, shown with everything a
 * student would see (feedback, hint, worked answer, markscheme) and who wrote
 * it; and every lesson that passed its checks, playable, with its flashcards.
 */

import { useState } from 'react'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Page } from '@/components/PageShell'
import MathText from '@/components/MathText'
import QuestionFigure from '@/components/QuestionFigure'
import LessonPlayer from '@/components/lessons/LessonPlayer'
import { HEAT_LEVELS } from '@/lib/progress'
import sample from './sample.json'

const ENABLED = process.env.NODE_ENV !== 'production'
const WRITER = { basic: 'Haiku', middle: 'Sonnet · medium', hard: 'Sonnet · normal' }

function Question({ q, n }) {
  const heat = HEAT_LEVELS.find((h) => h.key === q.heat)
  return (
    <article className="rounded-[18px] border p-5 sm:p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="rounded-full px-2.5 py-0.5 font-semibold" style={{ background: `var(--heat-${q.heat})`, color: '#fff' }}>
          {heat?.label}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{q.subtopic}</span>
        <span style={{ color: 'var(--text-faint)' }}>
          · {q.marks} mark{q.marks === 1 ? '' : 's'} · written by {WRITER[q.tier]} · #{n}
        </span>
      </div>
      {q.stimulus && (
        <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          <MathText>{q.stimulus}</MathText>
        </p>
      )}
      <p className="mt-3 text-[16px] leading-relaxed">
        <MathText>{q.stem}</MathText>
      </p>
      {q.figure && q.figure.kind !== 'none' && (
        <div className="mt-3">
          <QuestionFigure figure={q.figure} />
        </div>
      )}
      {q.type === 'mcq' ? (
        <ul className="mt-3 flex flex-col gap-2">
          {q.options.map((o) => (
            <li key={o.id} className="rounded-[12px] border px-3.5 py-2.5 text-[14.5px]" style={{ borderColor: o.id === q.correct_answer ? 'var(--status-proficient)' : 'var(--border)' }}>
              <span className="mr-2 font-semibold uppercase" style={{ color: 'var(--text-faint)' }}>
                {o.id}
              </span>
              <MathText>{o.text}</MathText>
              {o.id === q.correct_answer ? (
                <span className="ml-2 text-[12.5px] font-semibold" style={{ color: 'var(--status-proficient)' }}>
                  correct
                </span>
              ) : (
                <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  If picked: <MathText>{o.why_wrong}</MathText>
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-[14px]">
          <p>
            <span className="font-semibold" style={{ color: 'var(--status-proficient)' }}>
              Accepted:
            </span>{' '}
            {q.accepted_answers.join(' · ')} {q.answer_hint && <span style={{ color: 'var(--text-faint)' }}>({q.answer_hint})</span>}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {q.wrong_answers.map((w) => (
              <li key={w.answer} style={{ color: 'var(--text-muted)' }}>
                If they type <span className="font-semibold">{w.answer}</span>: <MathText>{w.feedback}</MathText>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-[13.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          Hint, worked answer and markscheme
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          <p>
            <span className="font-semibold">Hint:</span> <MathText>{q.hint}</MathText>
          </p>
          <p>
            <span className="font-semibold">Worked answer:</span> <MathText>{q.explanation}</MathText>
          </p>
          <div>
            <span className="font-semibold">Markscheme ({q.markscheme.command_term}):</span>
            <ul className="mt-1 list-disc pl-5">
              {q.markscheme.points.map((p, i) => (
                <li key={i}>
                  <MathText>{p.point}</MathText> [{p.marks}]
                </li>
              ))}
            </ul>
            {q.markscheme.guidance && (
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                <MathText>{q.markscheme.guidance}</MathText>
              </p>
            )}
          </div>
        </div>
      </details>
    </article>
  )
}

export default function PilotReview() {
  const [tab, setTab] = useState('questions')
  const [lesson, setLesson] = useState(0)
  if (!ENABLED) notFound()
  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: ['Physics SL'] }
  const l = sample.lessons[lesson]

  return (
    <DashboardLayout profile={profile}>
      <Page>
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
            Physics · Theme A pilot · not published
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.02em]">Review the pilot</h1>
          <div className="mt-4 flex gap-2">
            {[
              ['questions', `${sample.questions.length} sample questions`],
              ['lessons', `${sample.lessons.length} lessons`],
            ].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={tab === k ? 'btn btn-solid control-md' : 'btn btn-outline control-md'}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'questions' ? (
            <div className="mt-6 flex flex-col gap-4">
              {sample.questions.map((q, i) => (
                <Question key={i} q={q} n={i + 1} />
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <select value={lesson} onChange={(e) => setLesson(Number(e.target.value))} className="input mb-6 h-11 w-full text-[15px]">
                {sample.lessons.map((x, i) => (
                  <option key={x.id} value={i}>
                    {x.subtopic}
                  </option>
                ))}
              </select>
              <LessonPlayer key={l.id} lesson={l} onAddCards={async () => true} backHref="/dev-preview/pilot" backLabel="Pilot" practiseHref="/dev-preview/pilot" />
              <h2 className="mt-12 text-[17px] font-semibold">Flashcards ({l.cards.length})</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {l.cards.map((c, i) => (
                  <li key={i} className="rounded-[14px] border p-3.5 text-[14px]" style={{ borderColor: 'var(--border)' }}>
                    <p className="font-semibold">
                      <MathText>{c.front}</MathText>
                    </p>
                    <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                      <MathText>{c.back}</MathText>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Page>
    </DashboardLayout>
  )
}
