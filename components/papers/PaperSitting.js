'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import MathText from '@/components/MathText'
import QuestionFigure from '@/components/QuestionFigure'
import { IconCheck, IconClock, IconArrowLeft } from '@/components/Icons'
import { gradeShortAnswer } from '@/lib/grading'
import { checkWritten } from '@/lib/flashcard-modes'

/**
 * Sitting a predicted paper, the way the real one is sat.
 *
 * The paper is shown whole, in its sections, with the real instructions and
 * the real choice ("answer one question from a choice of two"): choosing is
 * part of the exam, so the student chooses here too. The clock runs from the
 * real duration and keeps going into overtime rather than taking the paper
 * away, because finishing the paper teaches more than being stopped.
 *
 * Marking happens after, against the markscheme. Multiple choice and numeric
 * parts mark themselves. Written parts are shown beside their markscheme for
 * the student to mark honestly: ticking the points earned, or choosing the
 * band the answer fits. That is how IB students are taught to use a
 * markscheme, and it is free.
 *
 * Presentational: the page loads the paper and saves the attempt.
 */

const keyOf = (si, qi, pi) => `${si}.${qi}.${pi}`

export function autoMark(part, response) {
  if (response == null || String(response).trim() === '') return 0
  if (part.type === 'mcq') return response === part.correct_answer ? part.marks : 0
  if (part.type === 'numeric') {
    return gradeShortAnswer({ accepted_answers: part.accepted_answers, answer_kind: 'numeric' }, response).correct ? part.marks : 0
  }
  if (part.type === 'short_text') {
    const r = checkWritten(response, (part.accepted_answers || []).join(' / '))
    return r.correct || r.close ? part.marks : 0
  }
  return null // written: marked by the student or Syllabi
}

function clock(seconds) {
  const s = Math.abs(Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${seconds < 0 ? '+' : ''}${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`
}

function Stimulus({ q }) {
  if (!q.stimulus && (!q.figure || q.figure.kind === 'none')) return null
  return (
    <div className="mt-3 rounded-[14px] border p-4 sm:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
      {q.stimulus && (
        <div className="whitespace-pre-line text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
          <MathText>{q.stimulus}</MathText>
        </div>
      )}
      {q.figure && q.figure.kind !== 'none' && (
        <div className="mt-4">
          <QuestionFigure figure={q.figure} />
        </div>
      )}
    </div>
  )
}

function AnswerBox({ part, value, onChange, disabled }) {
  if (part.type === 'mcq') {
    return (
      <div className="mt-2 flex flex-col gap-2">
        {part.options.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-start gap-3 rounded-[12px] border px-3.5 py-2.5 text-[14.5px]"
            style={{ borderColor: value === o.id ? 'var(--brand)' : 'var(--border)', background: value === o.id ? 'var(--brand-tint)' : 'var(--surface)' }}
          >
            <input type="radio" className="mt-1" checked={value === o.id} disabled={disabled} onChange={() => onChange(o.id)} />
            <span className="text-[12px] font-semibold uppercase" style={{ color: 'var(--text-faint)' }}>
              {o.id}
            </span>
            <span className="min-w-0">
              <MathText>{o.text}</MathText>
            </span>
          </label>
        ))}
      </div>
    )
  }
  if (part.type === 'written') {
    return (
      <textarea
        value={value || ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={part.marks >= 10 ? 14 : part.marks >= 4 ? 7 : 4}
        placeholder={part.marks >= 10 ? 'Write your answer. Plan first: the marks are for analysis and evaluation, not length.' : 'Your answer'}
        className="input mt-2 w-full resize-y py-3 text-[16px] leading-relaxed sm:text-[15px]"
      />
    )
  }
  return (
    <input
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={part.type === 'numeric' ? 'Your answer, with working on paper' : 'Your answer'}
      autoComplete="off"
      className="input mt-2 h-11 w-full max-w-sm text-[16px] sm:text-[15px]"
    />
  )
}

/** The markscheme for one part, with the student's mark beside it. */
function MarkPart({ part, response, mark, onMark }) {
  const auto = autoMark(part, response)
  const points = part.markscheme?.points || []
  const banded = Boolean(String(part.markscheme?.markbands || '').trim())
  const [ticked, setTicked] = useState([])
  const tick = (i) => {
    const next = ticked.includes(i) ? ticked.filter((x) => x !== i) : [...ticked, i]
    setTicked(next)
    onMark(Math.min(part.marks, next.reduce((a, k) => a + (points[k]?.marks || 0), 0)))
  }

  return (
    <div className="mt-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
        Markscheme
      </p>
      {part.type === 'written' && auto === 0 ? (
        <p className="mt-2 text-[14px] font-semibold" style={{ color: 'var(--status-weak)' }}>
          Not answered · 0 marks
        </p>
      ) : auto != null ? (
        <p className="mt-2 flex items-center gap-2 text-[14px] font-semibold" style={{ color: auto ? 'var(--status-proficient)' : 'var(--status-weak)' }}>
          {auto ? <IconCheck width={14} height={14} /> : null}
          {auto}/{part.marks} · answer:{' '}
          <MathText>{part.type === 'mcq' ? part.correct_answer?.toUpperCase() : (part.accepted_answers || [])[0]}</MathText>
        </p>
      ) : null}
      {points.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {auto == null && !banded ? (
                <input type="checkbox" className="mt-1.5" checked={ticked.includes(i)} onChange={() => tick(i)} aria-label={`Award: ${p.point}`} />
              ) : (
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--text-faint)' }} />
              )}
              <span>
                <MathText>{p.point}</MathText> <span style={{ color: 'var(--text-faint)' }}>[{p.marks}]</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {banded && (
        <div className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          <MathText>{part.markscheme.markbands}</MathText>
        </div>
      )}
      {part.markscheme?.indicative_content?.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            What a strong answer is likely to include
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {part.markscheme.indicative_content.map((c, i) => (
              <li key={i}>
                <MathText>{c}</MathText>
              </li>
            ))}
          </ul>
        </details>
      )}
      {part.markscheme?.guidance && (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <MathText>{part.markscheme.guidance}</MathText>
        </p>
      )}
      {auto == null && (
        <label className="mt-3 flex items-center gap-2 text-[13.5px] font-semibold">
          Your mark
          <select value={mark ?? ''} onChange={(e) => onMark(e.target.value === '' ? null : Number(e.target.value))} className="input h-9 w-20 text-[14px]">
            <option value="">–</option>
            {Array.from({ length: part.marks + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <span style={{ color: 'var(--text-faint)' }}>/ {part.marks}</span>
        </label>
      )}
    </div>
  )
}

export default function PaperSitting({ paper, initial, onSave, backHref, backLabel = 'Back' }) {
  const content = paper.content || {}
  const sections = useMemo(() => content.sections || [], [content.sections])
  const [phase, setPhase] = useState(initial?.submitted_at ? 'marking' : initial ? 'sitting' : 'intro')
  const [answers, setAnswers] = useState(initial?.answers || {})
  const [chosen, setChosen] = useState(initial?.chosen || [])
  const [marks, setMarks] = useState(initial?.marks || {})
  const [startedAt, setStartedAt] = useState(() => (initial?.started_at ? new Date(initial.started_at).getTime() : null))
  const [now, setNow] = useState(() => Date.now())
  const saveTimer = useRef(null)

  useEffect(() => {
    if (phase !== 'sitting') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  const save = (patch, immediate = false) => {
    clearTimeout(saveTimer.current)
    if (immediate) return onSave?.(patch)
    saveTimer.current = setTimeout(() => onSave?.(patch), 1200)
  }

  const answer = (k, v) => {
    const next = { ...answers, [k]: v }
    setAnswers(next)
    save({ answers: next, chosen })
  }

  const choose = (si, qi) => {
    const s = sections[si]
    const id = `${si}.${qi}`
    let next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]
    // Only as many as the paper allows from a section: the oldest choice gives way.
    const inSection = next.filter((c) => c.startsWith(`${si}.`))
    if (inSection.length > s.answer) next = next.filter((c) => c !== inSection[0])
    setChosen(next)
    save({ answers, chosen: next })
  }

  /** The questions that count: every one in a compulsory section, the chosen ones otherwise. */
  const counted = useMemo(
    () =>
      sections.flatMap((s, si) =>
        s.questions.map((q, qi) => ({ s, si, q, qi })).filter(({ si: i, qi }) => !(s.answer > 0 && s.answer < s.from) || chosen.includes(`${i}.${qi}`))
      ),
    [sections, chosen]
  )

  const allMarks = useMemo(() => {
    const out = {}
    for (const { q, si, qi } of counted) {
      q.parts.forEach((p, pi) => {
        const k = keyOf(si, qi, pi)
        const auto = autoMark(p, answers[k])
        out[k] = auto != null ? auto : marks[k]?.marks ?? null
      })
    }
    return out
  }, [counted, answers, marks])

  const score = Object.values(allMarks).reduce((a, m) => a + (m || 0), 0)
  const unmarked = Object.values(allMarks).filter((m) => m == null).length
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0
  const left = paper.minutes * 60 - elapsed

  const start = () => {
    const t = Date.now()
    setStartedAt(t)
    setNow(t)
    setPhase('sitting')
    onSave?.({ start: true })
  }

  const submit = () => {
    setPhase('marking')
    save({ answers, chosen, submitted: true, seconds_used: Math.round(elapsed) }, true)
    window.scrollTo({ top: 0 })
  }

  const setMark = (k, m) => {
    const next = { ...marks, [k]: { marks: m, by: 'self' } }
    setMarks(next)
    const nextAll = { ...allMarks, [k]: m }
    save({ marks: next, score: Object.values(nextAll).reduce((a, x) => a + (x || 0), 0), total: paper.marks })
  }

  /* ------------------------------------------------------------- intro --- */
  if (phase === 'intro') {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Link href={backHref} className="btn btn-quiet control-sm">
          <IconArrowLeft width={14} height={14} />
          {backLabel}
        </Link>
        <div className="mt-6 rounded-[20px] border p-6 sm:p-8" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
            {paper.subject} · Predicted paper{paper.version ? ` · Version ${paper.version}` : ''}
          </p>
          <h1 className="mt-2 text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-[1.15] tracking-[-0.03em]">{paper.name}</h1>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[
              [`${Math.floor(paper.minutes / 60) ? `${Math.floor(paper.minutes / 60)} h ` : ''}${paper.minutes % 60 ? `${paper.minutes % 60} min` : ''}`, 'Time'],
              [paper.marks, 'Marks'],
              [content.calculator === 'yes' ? 'Allowed' : content.calculator === 'no' ? 'Not allowed' : '—', 'Calculator'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-[14px] px-3 py-3" style={{ background: 'var(--surface-sunken)' }}>
                <p className="text-[17px] font-semibold">{v}</p>
                <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                  {l}
                </p>
              </div>
            ))}
          </div>
          <ul className="mt-5 flex flex-col gap-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {sections.map((s) => (
              <li key={s.name}>
                <span className="font-semibold">{s.name}</span> ({s.marks} marks). {s.instructions}
              </li>
            ))}
          </ul>
          {content.skipped?.length > 0 && (
            <p className="mt-4 rounded-[12px] px-3.5 py-2.5 text-[13.5px]" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
              The {content.skipped.join(' and ')} section needs audio, so it is left out here. Everything else is as in the real paper.
            </p>
          )}
          <p className="mt-5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            Written in the format of the real IB paper, with new questions. Sit it in one go, in exam conditions. The clock keeps running after time is up, so you can finish.
          </p>
          <button type="button" onClick={start} className="btn btn-solid control-lg mt-6 w-full">
            <IconClock width={16} height={16} />
            Start the paper
          </button>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------- sitting / marking --- */
  const marking = phase === 'marking'
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--bg) 88%, transparent)' }}>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{paper.name}</p>
          <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {paper.subject}
          </p>
        </div>
        {marking ? (
          <p className="shrink-0 text-[15px] font-semibold tabular-nums">
            {score}/{paper.marks}
            {unmarked > 0 && <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--text-faint)' }}>{unmarked} to mark</span>}
          </p>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: left < 0 ? 'var(--status-weak)' : left < 300 ? 'var(--heat-hot)' : 'var(--text)' }}>
              {clock(left)}
            </span>
            <button type="button" onClick={submit} className="btn btn-solid control-sm">
              Finish
            </button>
          </div>
        )}
      </div>

      {marking && (
        <div className="mb-8 rounded-[18px] p-5" style={{ background: 'var(--brand-tint)' }}>
          <p className="text-[16px] font-semibold">
            {unmarked ? 'Now mark your written answers against the markscheme.' : `You scored ${score} of ${paper.marks} (${Math.round((score / paper.marks) * 100)}%).`}
          </p>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
            {unmarked
              ? 'Multiple choice and numeric answers are marked already. Be as strict as an examiner would be: that is what makes the score worth having.'
              : 'Look again at the parts you dropped marks on: those are what to revise before the real paper.'}
          </p>
        </div>
      )}

      {sections.map((s, si) => {
        const choice = s.answer > 0 && s.answer < s.from
        return (
          <section key={si} className="mb-10">
            <div className="border-b pb-2" style={{ borderColor: 'var(--border-strong)' }}>
              <h2 className="text-[18px] font-semibold">{s.name}</h2>
              <p className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                {s.instructions} · {s.marks} marks
              </p>
            </div>
            {s.questions.map((q, qi) => {
              const picked = chosen.includes(`${si}.${qi}`)
              if (marking && choice && !picked) return null
              return (
                <article key={qi} className="mt-6" style={{ opacity: choice && !picked && !marking ? 0.92 : 1 }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[16px] font-semibold">
                      {q.parts.length === 1 && q.parts[0].type === 'mcq' ? `${q.number}.` : `Question ${q.number}`}
                      {q.title && q.parts[0]?.type !== 'mcq' ? ` · ${q.title}` : ''}
                    </h3>
                    {choice && !marking && (
                      <button type="button" onClick={() => choose(si, qi)} className={picked ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}>
                        {picked ? 'Answering this one' : 'Answer this question'}
                      </button>
                    )}
                  </div>
                  <Stimulus q={q} />
                  {q.parts.map((p, pi) => {
                    const k = keyOf(si, qi, pi)
                    const show = !choice || picked || marking
                    return (
                      <div key={pi} className="mt-4">
                        <p className="text-[15px] leading-relaxed">
                          {p.type !== 'mcq' || q.parts.length > 1 ? <span className="mr-1.5 font-semibold">({p.label})</span> : null}
                          <MathText>{p.prompt}</MathText>{' '}
                          <span className="whitespace-nowrap text-[13px]" style={{ color: 'var(--text-faint)' }}>
                            [{p.marks}]
                          </span>
                        </p>
                        {show && <AnswerBox part={p} value={answers[k]} disabled={marking} onChange={(v) => answer(k, v)} />}
                        {marking && <MarkPart part={p} response={answers[k]} mark={marks[k]?.marks} onMark={(m) => setMark(k, m)} />}
                      </div>
                    )
                  })}
                </article>
              )
            })}
          </section>
        )
      })}

      {!marking ? (
        <button type="button" onClick={submit} className="btn btn-solid control-lg mb-16 w-full">
          Finish and mark
        </button>
      ) : (
        <div className="mb-16 flex flex-wrap gap-2">
          <Link href={backHref} className="btn btn-solid control-md">
            Done
          </Link>
        </div>
      )}
    </div>
  )
}
