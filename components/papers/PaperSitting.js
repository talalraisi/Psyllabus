'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import MathText from '@/components/MathText'
import CodeText from '@/components/CodeText'
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
 * Four ways in: exam conditions (the real duration, counting down), timing
 * yourself (a stopwatch that pauses), no clock at all, or just reading it
 * (the questions and their markschemes, nothing answered or saved).
 *
 * Presentational: the page loads the paper and saves the attempt.
 */

/** The time now, for the handlers: outside the component, so it is plainly not render. */
const stamp = () => Date.now()

const MODES = [
  { key: 'exam', title: 'Exam conditions', line: (m) => `The real ${m}, counting down. Keeps going into overtime so you can finish.` },
  { key: 'stopwatch', title: 'Time yourself', line: () => 'A stopwatch you can pause. See how long the paper takes you.' },
  { key: 'practice', title: 'No clock', line: () => 'Answer at your own pace, then mark it against the markscheme.' },
  { key: 'view', title: 'Just read it', line: () => 'Look through the questions and their markschemes. Nothing is saved.' },
]

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

function Stimulus({ q, subject }) {
  if (!q.stimulus && (!q.figure || q.figure.kind === 'none')) return null
  return (
    <div className="mt-3 rounded-[14px] border p-4 sm:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
      {q.stimulus && (
        <div className="whitespace-pre-line text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
          <CodeText text={q.stimulus} subject={subject} />
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

/** A part's markscheme on its own, for reading a paper rather than sitting it. */
function ReadScheme({ part }) {
  const [open, setOpen] = useState(false)
  const s = part.markscheme || {}
  const answerLine = part.type === 'mcq' ? part.correct_answer?.toUpperCase() : part.type !== 'written' ? (part.accepted_answers || [])[0] : null
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-[13px] font-semibold" style={{ color: 'var(--brand)' }}>
        {open ? 'Hide markscheme' : 'Show markscheme'}
      </button>
      {open && (
        <div className="mt-2 rounded-[14px] border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          {answerLine && (
            <p className="text-[14px] font-semibold" style={{ color: 'var(--status-proficient)' }}>
              Answer: <MathText>{answerLine}</MathText>
            </p>
          )}
          {(s.points || []).length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {s.points.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--text-faint)' }} />
                  <span>
                    <MathText>{p.point}</MathText> <span style={{ color: 'var(--text-faint)' }}>[{p.marks}]</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {String(s.markbands || '').trim() && (
            <div className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              <MathText>{s.markbands}</MathText>
            </div>
          )}
          {s.indicative_content?.length > 0 && (
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {s.indicative_content.map((c, i) => (
                <li key={i}>
                  <MathText>{c}</MathText>
                </li>
              ))}
            </ul>
          )}
          {s.guidance && (
            <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              <MathText>{s.guidance}</MathText>
            </p>
          )}
        </div>
      )}
    </div>
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
  // An unfinished sitting opens on the intro, which offers to carry on or start again.
  const [phase, setPhase] = useState(initial?.submitted_at ? 'marking' : 'intro')
  const [resumable, setResumable] = useState(Boolean(initial && !initial.submitted_at))
  const [answers, setAnswers] = useState(initial?.answers || {})
  const [chosen, setChosen] = useState(initial?.chosen || [])
  const [marks, setMarks] = useState(initial?.marks || {})
  const [startedAt, setStartedAt] = useState(() => (initial?.started_at ? new Date(initial.started_at).getTime() : null))
  const [now, setNow] = useState(() => Date.now())
  const [mode, setMode] = useState(initial?.mode || 'exam')
  // The stopwatch: time spent paused, and when the current pause began.
  const [pausedMs, setPausedMs] = useState(0)
  const [pausedAt, setPausedAt] = useState(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (phase !== 'sitting' || mode === 'practice') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase, mode])

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
  const elapsed = startedAt ? ((pausedAt ?? now) - startedAt - pausedMs) / 1000 : 0
  const left = paper.minutes * 60 - elapsed

  const start = (m) => {
    if (m === 'view') {
      setPhase('reading')
      window.scrollTo({ top: 0 })
      return
    }
    const t = stamp()
    setMode(m)
    setStartedAt(t)
    setNow(t)
    setPausedMs(0)
    setPausedAt(null)
    setPhase('sitting')
    onSave?.({ start: true, mode: m })
  }

  /** Back into the unfinished sitting, answers and clock as they were. */
  const carryOn = () => {
    setNow(stamp())
    setResumable(false)
    setPhase('sitting')
    window.scrollTo({ top: 0 })
  }

  /** Throw the unfinished sitting away: a clean paper, and the choice of how to sit it. */
  const startAgain = () => {
    clearTimeout(saveTimer.current)
    setAnswers({})
    setChosen([])
    setMarks({})
    setResumable(false)
  }

  const togglePause = () => {
    const t = stamp()
    if (pausedAt) {
      setPausedMs((p) => p + (t - pausedAt))
      setPausedAt(null)
    } else setPausedAt(t)
    setNow(t)
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
    const done = Object.values(answers).filter((v) => String(v ?? '').trim()).length
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
          {resumable ? (
            <div className="mt-6 rounded-[16px] border p-4 sm:p-5" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}>
              <p className="text-[14.5px] font-semibold">You have this paper in progress</p>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                {MODES.find((m) => m.key === mode)?.title || 'Exam conditions'} · {done} answer{done === 1 ? '' : 's'} so far
                {startedAt ? ` · started ${new Date(startedAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={carryOn} className="btn btn-solid control-md">
                  Carry on
                </button>
                <button type="button" onClick={startAgain} className="btn btn-outline control-md">
                  Start again from the beginning
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                Written in the format of the real IB paper, with new questions. How do you want to take it?
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => start(m.key)}
                    className="lift flex flex-col items-start rounded-[16px] border p-4 text-left transition-colors hover:border-[var(--brand)]"
                    style={{ borderColor: m.key === 'exam' ? 'var(--brand)' : 'var(--border-strong)', background: m.key === 'exam' ? 'var(--brand-tint)' : 'var(--surface)' }}
                  >
                    <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                      {m.key !== 'view' && m.key !== 'practice' && <IconClock width={15} height={15} />}
                      {m.title}
                    </span>
                    <span className="mt-1 text-[12.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {m.line(`${Math.floor(paper.minutes / 60) ? `${Math.floor(paper.minutes / 60)} h ` : ''}${paper.minutes % 60 ? `${paper.minutes % 60} min` : ''}`.trim())}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------- sitting / marking --- */
  const marking = phase === 'marking'
  const reading = phase === 'reading'
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur" style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--bg) 88%, transparent)' }}>
        <Link
          href={backHref}
          aria-label={marking || reading ? `Leave: back to ${backLabel}` : 'Leave. Your answers are saved, so you can carry on later.'}
          title={marking || reading ? undefined : 'Your answers are saved, so you can carry on later'}
          className="-ml-1.5 flex h-9 shrink-0 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <IconArrowLeft width={14} height={14} />
          Leave
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{paper.name}</p>
          <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {paper.subject}
          </p>
        </div>
        {reading ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
              Reading
            </span>
            <button type="button" onClick={() => setPhase('intro')} className="btn btn-solid control-sm">
              Sit it
            </button>
          </div>
        ) : marking ? (
          <p className="shrink-0 text-[15px] font-semibold tabular-nums">
            {score}/{paper.marks}
            {unmarked > 0 && <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--text-faint)' }}>{unmarked} to mark</span>}
          </p>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            {mode === 'exam' && (
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: left < 0 ? 'var(--status-weak)' : left < 300 ? 'var(--heat-hot)' : 'var(--text)' }}>
                {clock(left)}
              </span>
            )}
            {mode === 'practice' && (
              <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                No clock
              </span>
            )}
            {mode === 'stopwatch' && (
              <>
                <span className="text-[15px] font-semibold tabular-nums" style={{ color: pausedAt ? 'var(--text-faint)' : 'var(--text)' }}>
                  {clock(elapsed)}
                </span>
                <button type="button" onClick={togglePause} className="btn btn-quiet control-sm">
                  {pausedAt ? 'Resume' : 'Pause'}
                </button>
              </>
            )}
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
                    {choice && !marking && !reading && (
                      <button type="button" onClick={() => choose(si, qi)} className={picked ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}>
                        {picked ? 'Answering this one' : 'Answer this question'}
                      </button>
                    )}
                  </div>
                  <Stimulus q={q} subject={paper.subject} />
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
                        {reading ? <ReadScheme part={p} /> : show && <AnswerBox part={p} value={answers[k]} disabled={marking} onChange={(v) => answer(k, v)} />}
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

      {reading ? (
        <div className="mb-16 flex flex-wrap gap-2">
          <button type="button" onClick={() => setPhase('intro')} className="btn btn-solid control-md">
            Sit this paper
          </button>
          <Link href={backHref} className="btn btn-quiet control-md">
            Done
          </Link>
        </div>
      ) : !marking ? (
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
