'use client'

/**
 * The brief before a quiz, test or paper starts.
 *
 * It was a title, three numbers and a button, which told a student almost
 * nothing about what they were about to sit. Now it says what is in the
 * paper (which subtopics, how hard, what it is worth), how this sitting runs
 * (clock, marking, hints, pausing, finishing early), and then gets out of
 * the way with one button. Everything here is read from the questions
 * already drawn, so nothing is a guess.
 */

import Link from 'next/link'
import { HEAT_LEVELS, heatOf, pointsForQuestion, displaySubtopic } from '@/lib/progress'

const HEAT_VAR = { low: '--heat-low', medium: '--heat-medium', hot: '--heat-hot', extreme: '--heat-extreme', burning: '--heat-burning' }

function Stat({ label, value, note }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5" style={{ background: 'var(--surface)' }}>
      <p className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: 'var(--text)' }}>
        {value}
      </p>
      {note && (
        <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: 'var(--text-faint)' }}>
          {note}
        </p>
      )}
    </div>
  )
}

function Rule({ children }) {
  return (
    <li className="flex gap-3 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
      <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--brand)' }} />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

export default function QuizBrief({
  eyebrow,
  title,
  questions,
  timed,
  totalMinutes,
  sit,
  review,
  hintsAllowed,
  redemptionCount = 0,
  paperNote = null,
  startLabel,
  onStart,
  backHref,
}) {
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0)
  const points = Math.round(questions.reduce((s, q) => s + pointsForQuestion(q.difficulty), 0) * 4) / 4
  const typed = questions.filter((q) => q.question_type === 'short_answer').length

  // How hard, as counts per heat level, hottest last.
  const heat = HEAT_LEVELS.map((h) => ({ ...h, n: questions.filter((q) => heatOf(q.difficulty).key === h.key).length })).filter((h) => h.n)

  // What it covers, most questions first.
  const bySubtopic = new Map()
  for (const q of questions) if (q.subtopic) bySubtopic.set(q.subtopic, (bySubtopic.get(q.subtopic) || 0) + 1)
  const subtopics = [...bySubtopic].sort((a, b) => b[1] - a[1])
  const shown = subtopics.slice(0, 8)

  const exam = timed && sit !== 'practice'
  const marking =
    review === 'practice'
      ? 'Each answer is marked the moment you give it, with the working.'
      : 'Nothing is marked until you finish, the way a real paper works.'
  const clock = timed
    ? `A ${totalMinutes}-minute countdown. It hands itself in at zero.`
    : sit === 'test'
      ? 'A stopwatch times every question, so you see where the minutes went.'
      : 'No clock. Take the time you need.'

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
          {eyebrow}
        </p>
        <h1 className="text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.03em]" style={{ textWrap: 'balance' }}>
          {title}
        </h1>
        {subtopics.length > 1 && (
          <p className="mt-3 text-[14.5px]" style={{ color: 'var(--text-muted)' }}>
            {subtopics.length} subtopics, mixed together
          </p>
        )}
      </header>

      {/* The numbers that decide how long this takes and what it is worth. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border sm:grid-cols-4" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
        <Stat label="Questions" value={questions.length} note={typed ? `${typed} written, ${questions.length - typed} choice` : 'Multiple choice'} />
        <Stat label="Marks" value={totalMarks} note={totalMarks !== questions.length ? 'Some worth more' : 'One each'} />
        <Stat label={timed ? 'Time limit' : 'Timing'} value={timed ? `${totalMinutes} min` : sit === 'test' ? 'Timed' : 'Untimed'} note={timed ? `About ${Math.max(1, Math.round((totalMinutes * 60) / Math.max(1, totalMarks)))} s a mark` : sit === 'test' ? 'Stopwatch' : 'Your own pace'} />
        <Stat label="Mastery points" value={`up to ${points}`} note="Right answers, once each" />
      </div>

      <div className="grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <div className="flex min-w-0 flex-col gap-8">
          {/* How hard, as one bar and a key. */}
          {heat.length > 0 && (
            <section>
              <h2 className="mb-3 text-[13px] font-semibold tracking-[-0.01em]">How hard</h2>
              <div className="flex h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--border-strong)' }} role="img" aria-label={heat.map((h) => `${h.n} ${h.label}`).join(', ')}>
                {heat.map((h) => (
                  <span key={h.key} style={{ width: `${(h.n / questions.length) * 100}%`, background: `var(${HEAT_VAR[h.key]})` }} />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                {heat.map((h) => (
                  <li key={h.key} className="flex items-center gap-1.5 text-[12.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: `var(${HEAT_VAR[h.key]})` }} />
                    {h.n} {h.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* What it covers. */}
          {shown.length > 0 && (
            <section>
              <h2 className="mb-3 text-[13px] font-semibold tracking-[-0.01em]">What is in it</h2>
              <ul className="flex flex-wrap gap-2">
                {shown.map(([name, n]) => (
                  <li key={name} className="max-w-full truncate rounded-full border px-3 py-1.5 text-[12.5px]" style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }} title={displaySubtopic(name)}>
                    {displaySubtopic(name)}
                    <span className="ml-1.5 tabular-nums" style={{ color: 'var(--text-faint)' }}>
                      {n}
                    </span>
                  </li>
                ))}
                {subtopics.length > shown.length && (
                  <li className="px-1 py-1.5 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                    and {subtopics.length - shown.length} more
                  </li>
                )}
              </ul>
              {redemptionCount > 0 && (
                <p className="mt-3 text-[13px]" style={{ color: 'var(--brand)' }}>
                  {redemptionCount === 1 ? 'One question is one' : `${redemptionCount} questions are ones`} you got wrong before.
                </p>
              )}
            </section>
          )}
        </div>

        {/* How this sitting runs. */}
        <section className="min-w-0 rounded-[16px] px-5 py-5" style={{ background: 'var(--surface-sunken)' }}>
          <h2 className="mb-4 text-[13px] font-semibold tracking-[-0.01em]">How it runs</h2>
          <ul className="flex flex-col gap-3">
            <Rule>{clock}</Rule>
            <Rule>{marking}</Rule>
            <Rule>
              {hintsAllowed && !exam ? 'Hints are there if you want one, and asking for one is noted on your results.' : 'No hints, as in the exam.'}
            </Rule>
            {(timed || sit === 'test') && <Rule>Pause any time. The clock stops and the questions hide until you come back.</Rule>}
            <Rule>Finish early and only what you answered is marked. Every minute counts toward your study time and streak.</Rule>
          </ul>
          <p className="mt-5 hidden text-[12px] md:block" style={{ color: 'var(--text-faint)' }}>
            Keys 1–4 answer, Enter goes on, ← goes back. The calculator is bottom right.
          </p>
        </section>
      </div>

      {paperNote && (
        <p className="-mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          {paperNote}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
        <button onClick={onStart} className="btn btn-solid control-lg">
          {startLabel}
        </button>
        {backHref && (
          <Link href={backHref} className="btn btn-quiet control-lg" style={{ color: 'var(--text-muted)' }}>
            Not now
          </Link>
        )}
      </div>
    </div>
  )
}
