'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ScoreRing, { ringColour } from '@/components/ScoreRing'
import SyllabiMark from '@/components/SyllabiMark'
import { KINDS, rubricFor } from '@/lib/criteria'
import { segments } from '@/lib/draft-review'
import { senseCheck } from '@/lib/sense-check'
import { shortName } from '@/lib/subject-short'
import { Chevron, Copy, Check, Download, Collapse, Refresh, FileIcon } from '@/components/syllabi/icons'

/**
 * The draft studio: a page to write on and a marker beside it.
 *
 * The draft is the page, and stays editable with its highlights showing in
 * it (a textarea laid over an exact copy of itself that carries the marks).
 * The panel on the right is the marking: the total and likely grade, each
 * criterion, what is costing and earning marks, and every comment, ranked.
 * Click a highlight and its comment opens; click a comment and the draft
 * scrolls to it. Edit the text and the panel says the marks are out of date
 * until you mark it again.
 *
 * Kept in this tab only (sessionStorage): a refresh keeps the essay, closing
 * the tab or a shared school computer does not.
 */

const STORE = 'psyllabus:draft-studio'
const MAX = 60000

const KIND = {
  issue: { colour: 'var(--status-weak)', label: 'Fix', plural: 'Fix' },
  question: { colour: 'var(--status-developing)', label: 'Think', plural: 'Think about' },
  strength: { colour: 'var(--status-proficient)', label: 'Strong', plural: 'Working' },
}
const IMPACT = { high: 3, medium: 2, low: 1 }
const READING = ['Reading your draft', 'Checking it against the criteria', 'Finding what earns marks', 'Finding what costs marks', 'Writing your feedback']

function read() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) || 'null') || {}
  } catch {
    return {}
  }
}

const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

/** Three dots, filled by how much a comment moves the mark. */
function Impact({ level, colour }) {
  return (
    <span className="flex shrink-0 items-center gap-[3px]" aria-label={`${level} impact`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="h-[7px] w-[7px] rounded-full" style={{ background: i <= IMPACT[level] ? colour : 'var(--border-strong)' }} />
      ))}
    </span>
  )
}

/** The plain-text version of a review, for copying or saving. */
function asText(review, { subject, kind }) {
  const total = review.criteria.reduce((a, c) => a + c.score, 0)
  const outOf = review.criteria.reduce((a, c) => a + c.max, 0)
  const lines = [
    `Syllabi feedback · ${subject} · ${KINDS.find((k) => k.key === kind)?.label}`,
    `${total}/${outOf} · likely grade ${review.grade_estimate || '–'} (an estimate, not a mark)`,
    review.grade_note,
    '',
    review.overview || '',
    '',
    ...(review.examiner_comment ? ['Examiner’s comment:', review.examiner_comment, ''] : []),
    ...review.criteria.map((c) => `Criterion ${c.id} · ${c.name}: ${c.score}/${c.max}\n${c.comment}${c.next_band ? `\nTo reach the next band: ${c.next_band}` : ''}`),
    ...((review.sections || []).length ? ['', 'Section by section:', ...review.sections.map((x) => `- ${x.name} (${x.rating}): ${x.comment}`)] : []),
    ...(review.writing ? ['', `Writing: ${review.writing}`] : []),
    '',
    'In the draft:',
    ...review.highlights.map((h, i) => `${i + 1}. [${KIND[h.kind].label}${h.criterion ? ` · ${h.criterion}` : ''}] "${h.quote}"\n   ${h.comment}${h.how_to_fix ? `\n   ${h.kind === 'strength' ? 'Keep doing' : 'How to approach it'}: ${h.how_to_fix}` : ''}`),
    '',
    `Do this first: ${review.next_step}`,
    ...((review.priorities || []).length ? ['', 'Priorities:', ...review.priorities.map((p, i) => `${i + 1}. ${p}`)] : []),
    ...(review.questions.length ? ['', 'Answer these in your next draft:', ...review.questions.map((q) => `- ${q}`)] : []),
  ]
  return lines.join('\n')
}

/**
 * The draft, editable, with its highlights drawn behind the text. The copy
 * underneath has transparent text and the same metrics, so each mark sits
 * exactly under the words it belongs to.
 */
function HighlightEditor({ text, onChange, parts, active, show, onCaret, markRefs, disabled }) {
  const boxRef = useRef(null)
  const metrics = 'whitespace-pre-wrap break-words text-[17px] leading-[2] tracking-[0.005em] sm:text-[16.5px]'

  // Grow with the text, so the page scrolls rather than the box.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  return (
    <div className="relative">
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 text-transparent ${metrics}`}>
        {parts.map((p, i) => {
          if (p.n === undefined || !show) return <span key={i}>{p.text}</span>
          const k = KIND[p.kind]
          const on = active === p.n
          return (
            <mark
              key={`${i}-${on}`}
              ref={(el) => {
                markRefs.current[p.n] = el
              }}
              className={`rounded-[4px] text-transparent ${on ? 'sy-flash' : ''}`}
              style={{
                background: `color-mix(in srgb, ${k.colour} ${on ? 34 : 17}%, transparent)`,
                boxShadow: `inset 0 -2px 0 color-mix(in srgb, ${k.colour} ${on ? 100 : 70}%, transparent)`,
                transition: 'background-color 200ms',
              }}
            >
              {p.text}
            </mark>
          )
        })}
        {'\n'}
      </div>
      <textarea
        ref={boxRef}
        value={text}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
        onClick={(e) => onCaret(e.currentTarget.selectionStart)}
        onKeyUp={(e) => onCaret(e.currentTarget.selectionStart)}
        disabled={disabled}
        spellCheck
        placeholder="Paste or write your draft here."
        aria-label="Your draft"
        rows={12}
        className={`relative block min-h-[60vh] w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-[var(--text-faint)] disabled:opacity-70 ${metrics}`}
        style={{ color: 'var(--text-body)' }}
      />
    </div>
  )
}

/** One comment, closed to a line; open, the reason and where it is. */
function CommentRow({ h, open, onToggle, onShow, refFn }) {
  const k = KIND[h.kind]
  return (
    <div
      ref={refFn}
      className="overflow-hidden rounded-[14px] border transition-colors"
      style={{ borderColor: open ? `color-mix(in srgb, ${k.colour} 45%, var(--border))` : 'var(--border)', background: open ? 'var(--surface)' : 'var(--surface-sunken)' }}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <Impact level={h.impact} colour={k.colour} />
        <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'var(--text-body)' }}>
          {h.quote}
        </span>
        <Chevron up={open} />
      </button>
      {open && (
        <div className="sy-rise px-3.5 pb-3.5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full px-2 py-0.5" style={{ background: `color-mix(in srgb, ${k.colour} 18%, transparent)`, color: k.colour }}>
              {k.label}
            </span>
            {h.criterion && <span style={{ color: 'var(--text-faint)' }}>Criterion {h.criterion}</span>}
            <span className="capitalize" style={{ color: 'var(--text-faint)' }}>
              · {h.impact} impact
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text)' }}>
            {h.comment}
          </p>
          {h.how_to_fix && (
            <p className="mt-2.5 rounded-[10px] px-3 py-2 text-[12.5px] leading-relaxed" style={{ background: 'var(--surface-sunken)', color: 'var(--text-body)' }}>
              <span className="font-semibold" style={{ color: k.colour }}>
                {h.kind === 'strength' ? 'Keep doing: ' : 'How to approach it: '}
              </span>
              {h.how_to_fix}
            </p>
          )}
          <button type="button" onClick={onShow} className="mt-2.5 text-[12.5px] font-medium text-[var(--brand)] hover:underline">
            Show in draft
          </button>
        </div>
      )}
    </div>
  )
}

export default function DraftStudio({ subjects = [] }) {
  const [saved] = useState(() => (typeof window === 'undefined' ? {} : read()))
  const [subject, setSubject] = useState(saved.subject && subjects.includes(saved.subject) ? saved.subject : subjects.find((s) => !/Creativity|CAS/.test(s)) || subjects[0] || '')
  const [kind, setKind] = useState(saved.kind || 'ia')
  const [text, setText] = useState(saved.text || '')
  const [review, setReview] = useState(saved.review || null)
  const [markedText, setMarkedText] = useState(saved.markedText || '')
  const [markedFor, setMarkedFor] = useState(saved.markedFor || '')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(null)
  const [tab, setTab] = useState('marks')
  const [active, setActive] = useState(null)
  const [only, setOnly] = useState(null)
  const [filter, setFilter] = useState('all')
  const [show, setShow] = useState(true)
  const [panel, setPanel] = useState(true)
  const [sheet, setSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const markRefs = useRef({})
  const rowRefs = useRef({})
  const fileRef = useRef(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ subject, kind, text, review, markedText, markedFor }))
    } catch {
      /* too big or blocked: it just will not survive a refresh */
    }
  }, [subject, kind, text, review, markedText, markedFor])

  // The reading messages turn over while it works.
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setStep((s) => Math.min(READING.length - 1, s + 1)), 4500)
    return () => clearInterval(t)
  }, [busy])

  const words = countWords(text)
  const rubric = rubricFor(kind, subject)
  const stale = Boolean(review) && text !== markedText
  // Marking again costs one of today's few, so only when something changed.
  const changed = !review || stale || markedFor !== `${subject}|${kind}`
  const title = text.trim().split('\n').find((l) => l.trim())?.trim().slice(0, 90) || 'Untitled draft'
  const highlights = useMemo(() => (review?.highlights || []).map((h, n) => ({ ...h, n })), [review])
  const parts = useMemo(
    () => (review ? segments(text, review.highlights).map((p) => (p.n === undefined ? p : { ...p, kind: review.highlights[p.n].kind })) : [{ text }]),
    [review, text]
  )
  const placed = new Set(parts.filter((p) => p.n !== undefined).map((p) => p.n))
  const visible = highlights.filter((h) => (!only || h.criterion === only) && (filter === 'all' || h.kind === filter))
  const fixes = highlights.filter((h) => h.kind === 'issue').sort((a, b) => IMPACT[b.impact] - IMPACT[a.impact])
  const total = review ? review.criteria.reduce((a, c) => a + c.score, 0) : 0
  const outOf = review ? review.criteria.reduce((a, c) => a + c.max, 0) : rubric ? rubric.criteria.reduce((a, c) => a + c.max, 0) : 0
  const weight = (list) => list.reduce((a, h) => a + IMPACT[h.impact], 0)
  const bar = review
    ? [
        ['issue', weight(highlights.filter((h) => h.kind === 'issue'))],
        ['question', weight(highlights.filter((h) => h.kind === 'question'))],
        ['strength', weight(highlights.filter((h) => h.kind === 'strength'))],
      ]
    : []
  const barTotal = bar.reduce((a, [, w]) => a + w, 0) || 1

  const mark = async () => {
    if (busy) return
    // The same check the server makes, so nonsense never leaves the page.
    const why = senseCheck(text)
    if (why) {
      setError(why)
      setSheet(true)
      setPanel(true)
      return
    }
    setBusy(true)
    setStep(0)
    setError('')
    setSheet(true)
    setPanel(true)
    const sentText = text
    try {
      const res = await fetch('/api/syllabi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: 'draft_feedback', text: sentText, subject, kind }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.review) {
        setError(data.code === 'not_configured' ? 'Syllabi is being switched on. Try again soon.' : data.error || 'That did not work.')
      } else {
        setReview(data.review)
        setMarkedText(sentText)
        setMarkedFor(`${subject}|${kind}`)
        setRemaining(data.remaining ?? null)
        setActive(null)
        setOnly(null)
        setFilter('all')
        setTab('marks')
      }
    } catch {
      setError('Could not reach Syllabi. Check your connection.')
    }
    setBusy(false)
  }

  const openComment = (n) => {
    setActive((a) => (a === n ? null : n))
    setTab('comments')
    setFilter('all')
    setOnly(null)
    setSheet(true)
    setPanel(true)
    requestAnimationFrame(() => rowRefs.current[n]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  const showInDraft = (n) => {
    setActive(n)
    setSheet(false)
    requestAnimationFrame(() => markRefs.current[n]?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  const caret = (pos) => {
    if (!review || !show) return
    const hit = parts.find((p) => p.n !== undefined && pos >= p.start && pos <= p.end)
    if (hit && hit.n !== active) openComment(hit.n)
  }

  const exportText = review ? asText(review, { subject, kind }) : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* nothing to do */
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportText], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `Syllabi feedback - ${title.slice(0, 40)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openFile = async (file) => {
    if (!file) return
    if (!/\.(txt|md)$/i.test(file.name) && !file.type.startsWith('text/')) {
      setError('Open a .txt file here, or paste from Word or Google Docs.')
      return
    }
    if (file.size > 400 * 1024) {
      setError('That file is too long for one draft.')
      return
    }
    setText((await file.text()).slice(0, MAX))
  }

  const pasteIn = async () => {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) setText((t) => (t.trim() ? `${t}\n\n${clip}` : clip).slice(0, MAX))
    } catch {
      setError('Your browser blocked pasting from here. Use Ctrl+V or ⌘V in the page.')
    }
  }

  /* ---------- The panel ---------- */

  const panelBody = busy ? (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 100 100" className="h-full w-full animate-spin" style={{ animationDuration: '1.4s' }} aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-strong)" strokeWidth="6" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" strokeDasharray="70 200" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--brand)' }}>
          <SyllabiMark size={26} />
        </span>
      </div>
      <div>
        <p key={step} className="sy-rise text-[15px] font-semibold">
          {READING[step]}…
        </p>
        <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          About a minute. It reads every line.
        </p>
      </div>
    </div>
  ) : !review ? (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      <p className="text-[16px] font-semibold tracking-[-0.01em]">Get your draft marked</p>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Paste the whole thing. Syllabi marks it against the criteria, highlights what earns and costs you marks, and never rewrites a word.
      </p>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
        {rubric ? `${rubric.name} · out of ${outOf}` : `${shortName(subject)} criteria`}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {(rubric?.criteria || []).map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-[13px]" style={{ borderColor: 'var(--border)' }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
              {c.id}
            </span>
            <span className="flex-1">{c.name}</span>
            <span className="tabular-nums" style={{ color: 'var(--text-faint)' }}>
              /{c.max}
            </span>
          </li>
        ))}
        {!rubric && (
          <li className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Syllabi uses the IB criteria for this subject as it knows them. Check them against your guide.
          </li>
        )}
      </ul>
    </div>
  ) : (
    <>
      <div className="flex shrink-0 gap-1 border-b px-3" style={{ borderColor: 'var(--border)' }}>
        {[
          ['marks', 'Marks'],
          ['comments', `Comments · ${highlights.length}`],
          ['report', 'Report'],
          ['next', 'Next steps'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="relative whitespace-nowrap px-2.5 py-3.5 text-[13px] font-medium transition-colors"
            style={{ color: tab === key ? 'var(--text)' : 'var(--text-muted)' }}
          >
            {label}
            {tab === key && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full" style={{ background: 'var(--brand)' }} />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === 'marks' && (
          <div key="marks" className="sy-rise flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold tracking-[-0.01em]">Syllabi review</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={copy} className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border-strong)' }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button type="button" onClick={download} className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border-strong)' }}>
                  <Download size={13} />
                  Save
                </button>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <ScoreRing value={total} max={outOf} size={112} stroke={8}>
                <span className="text-[28px] font-semibold leading-none tracking-[-0.03em]">{total}</span>
                <span className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  of {outOf}
                </span>
              </ScoreRing>
              <div className="min-w-0">
                <p className="text-[15px] leading-snug">
                  This draft would most likely get{' '}
                  <span className="whitespace-nowrap text-[17px] font-semibold" style={{ color: ringColour(outOf ? total / outOf : 0), boxShadow: `inset 0 -2px 0 ${ringColour(outOf ? total / outOf : 0)}` }}>
                    {/^[AE]/.test(review.grade_estimate) ? 'an' : 'a'} {review.grade_estimate || '–'}
                  </span>
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {review.grade_note}
                </p>
              </div>
            </div>

            {review.overview && (
              <p className="rounded-[14px] px-4 py-3 text-[13.5px] leading-relaxed" style={{ background: 'var(--surface-sunken)', color: 'var(--text-body)' }}>
                {review.overview}
              </p>
            )}

            <div>
              <p className="mb-2.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                By criterion · tap one to read it
              </p>
              <div className="flex flex-wrap gap-2">
                {review.criteria.map((c) => {
                  const on = only === c.id
                  const col = ringColour(c.max ? c.score / c.max : 0)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOnly(on ? null : c.id)}
                      aria-pressed={on}
                      className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold tabular-nums transition-colors"
                      style={{ borderColor: col, background: on ? `color-mix(in srgb, ${col} 18%, transparent)` : 'transparent', color: on ? 'var(--text)' : 'var(--text-body)' }}
                    >
                      {c.id} <span style={{ color: col }}>{c.score}</span>
                      <span className="font-normal" style={{ color: 'var(--text-faint)' }}>
                        /{c.max}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {review.criteria
                  .filter((c) => !only || c.id === only)
                  .map((c) => (
                    <div key={c.id} className="sy-rise rounded-[14px] border p-3.5" style={{ borderColor: only === c.id ? 'var(--border-strong)' : 'var(--border)' }}>
                      <button type="button" onClick={() => setOnly(only === c.id ? null : c.id)} className="flex w-full items-center gap-3 text-left">
                        <ScoreRing value={c.score} max={c.max} size={38} stroke={3.5}>
                          <span className="text-[12px] font-semibold">{c.score}</span>
                        </ScoreRing>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                            Criterion {c.id}
                          </p>
                          <p className="truncate text-[13.5px] font-medium">{c.name}</p>
                        </div>
                        <Chevron up={only === c.id} />
                      </button>
                      {(only === c.id || review.criteria.length <= 2) && (
                        <div className="sy-rise">
                          {c.comment && (
                            <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                              {c.comment}
                            </p>
                          )}
                          {c.next_band && (
                            <div className="mt-3 rounded-[10px] px-3 py-2.5" style={{ background: 'var(--brand-tint)' }}>
                              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--brand)' }}>
                                To reach the next band
                              </p>
                              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                                {c.next_band}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {barTotal > 0 && highlights.length > 0 && (
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">What is moving your mark</p>
                <div className="mt-3 flex h-2.5 gap-[3px] overflow-hidden rounded-full">
                  {bar.map(([k, w]) =>
                    w ? <span key={k} className="h-full transition-[width] duration-700" style={{ width: `${(w / barTotal) * 100}%`, background: KIND[k].colour }} /> : null
                  )}
                </div>
                <div className="mt-2 flex justify-between text-[12.5px] font-medium">
                  <span style={{ color: 'var(--status-weak)' }}>Costing marks</span>
                  <span style={{ color: 'var(--status-proficient)' }}>Earning marks</span>
                </div>
              </div>
            )}

            {fixes.length > 0 && (
              <div>
                <p className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">Biggest fixes</p>
                <div className="flex flex-col gap-2">
                  {fixes.slice(0, 4).map((h) => (
                    <CommentRow
                      key={h.n}
                      h={h}
                      open={active === h.n}
                      onToggle={() => setActive(active === h.n ? null : h.n)}
                      onShow={() => showInDraft(h.n)}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              An estimate, not a mark. Your teacher’s marking is what counts.{!review.known && ' Criteria as Syllabi knows them: check them against your guide.'}
            </p>
          </div>
        )}

        {tab === 'comments' && (
          <div key="comments" className="sy-rise flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              {[['all', 'All'], ...Object.entries(KIND).map(([k, v]) => [k, v.plural])].map(([k, label]) => {
                const n = k === 'all' ? highlights.length : highlights.filter((h) => h.kind === k).length
                const on = filter === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    aria-pressed={on}
                    className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors"
                    style={{
                      borderColor: on ? (k === 'all' ? 'var(--text)' : KIND[k].colour) : 'var(--border-strong)',
                      background: on ? (k === 'all' ? 'var(--text)' : `color-mix(in srgb, ${KIND[k].colour} 16%, transparent)`) : 'transparent',
                      color: on && k === 'all' ? 'var(--bg)' : 'var(--text-body)',
                    }}
                  >
                    {label}
                    <span className="tabular-nums opacity-60">{n}</span>
                  </button>
                )
              })}
              {only && (
                <button type="button" onClick={() => setOnly(null)} className="h-8 rounded-full px-3 text-[12.5px] font-medium text-[var(--brand)]">
                  Criterion {only} ✕
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {visible.map((h) => (
                <CommentRow
                  key={h.n}
                  h={h}
                  open={active === h.n}
                  onToggle={() => setActive(active === h.n ? null : h.n)}
                  onShow={() => showInDraft(h.n)}
                  refFn={(el) => {
                    rowRefs.current[h.n] = el
                  }}
                />
              ))}
              {visible.length === 0 && (
                <p className="py-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  Nothing here.
                </p>
              )}
              {highlights.some((h) => !placed.has(h.n)) && (
                <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Some comments are about text you have since changed, so they are no longer highlighted.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'report' && (
          <div key="report" className="sy-rise flex flex-col gap-6">
            {review.examiner_comment && (
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">Examiner’s comment</p>
                <blockquote className="mt-3 border-l-[3px] pl-4 text-[13.5px] leading-[1.75]" style={{ borderColor: 'var(--brand)', color: 'var(--text-body)' }}>
                  {review.examiner_comment}
                </blockquote>
              </div>
            )}
            {(review.sections || []).length > 0 && (
              <div>
                <p className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">Section by section</p>
                <ol className="flex flex-col gap-2">
                  {review.sections.map((sec, i) => {
                    const col = sec.rating === 'strong' ? 'var(--status-proficient)' : sec.rating === 'weak' ? 'var(--status-weak)' : 'var(--status-developing)'
                    return (
                      <li key={i} className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[13.5px] font-semibold">{sec.name}</p>
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize" style={{ background: `color-mix(in srgb, ${col} 18%, transparent)`, color: col }}>
                            {sec.rating}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                          {sec.comment}
                        </p>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
            {(review.writing || review.word_count_note) && (
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">Writing</p>
                {review.writing && (
                  <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {review.writing}
                  </p>
                )}
                {review.word_count_note && (
                  <p className="mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--text-body)' }}>
                      {words.toLocaleString()} words
                    </span>
                    {review.word_count_note}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'next' && (
          <div key="next" className="sy-rise flex flex-col gap-6">
            {review.next_step && (
              <div className="rounded-[16px] p-4" style={{ background: 'var(--brand-tint)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--brand)' }}>
                  Do this first
                </p>
                <p className="mt-1.5 text-[14.5px] font-medium leading-relaxed">{review.next_step}</p>
              </div>
            )}
            {(review.priorities || []).length > 0 && (
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">Your priorities, in order</p>
                <ol className="mt-3 flex flex-col gap-2">
                  {review.priorities.map((p, i) => (
                    <li key={i} className="flex gap-3 rounded-[12px] border px-3.5 py-3 text-[13.5px] leading-relaxed" style={{ borderColor: 'var(--border)' }}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: i === 0 ? 'var(--brand)' : 'var(--surface-sunken)', color: i === 0 ? '#fff' : 'var(--text-muted)' }}>
                        {i + 1}
                      </span>
                      <span style={{ color: 'var(--text-body)' }}>{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {review.questions.length > 0 && (
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">Answer these in your next draft</p>
                <ol className="mt-3 flex flex-col gap-2.5">
                  {review.questions.map((q, i) => (
                    <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                        {i + 1}
                      </span>
                      <span style={{ color: 'var(--text-body)' }}>{q}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {review.strengths.length > 0 && (
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.01em]">Keep</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {review.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                      <span className="mt-1 shrink-0" style={{ color: 'var(--status-proficient)' }}>
                        <Check size={14} />
                      </span>
                      <span style={{ color: 'var(--text-body)' }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )

  const panelFooter = (
    <div className="shrink-0 border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
      {error && (
        <p className="sy-rise mb-3 text-[12.5px]" style={{ color: 'var(--status-weak)' }} role="alert">
          {error}
        </p>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11.5px] font-medium"
            style={{
              background: stale ? 'color-mix(in srgb, var(--status-developing) 16%, transparent)' : 'var(--surface-sunken)',
              color: stale ? 'var(--status-developing)' : 'var(--text-muted)',
            }}
          >
            {!review ? 'Not marked yet' : stale ? 'Edited since marking' : 'Marks up to date'}
          </span>
          <p className="mt-1.5 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {text.length.toLocaleString()} characters · {words.toLocaleString()} words
            {remaining !== null && ` · ${remaining} left today`}
          </p>
        </div>
        <button
          type="button"
          onClick={mark}
          disabled={busy || words < 150 || !changed}
          className="flex h-12 shrink-0 items-center gap-2 rounded-[14px] px-5 text-[15px] font-semibold transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
          title={words < 150 ? `At least 150 words` : undefined}
        >
          {review ? 'Re-mark' : 'Mark it'}
          <Refresh size={17} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      {/* The document bar. */}
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b px-4 md:px-5" style={{ borderColor: 'var(--border)' }}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
          <FileIcon size={15} />
        </span>
        <p className="min-w-0 flex-1 truncate text-[15.5px] font-medium tracking-[-0.01em]" title={title}>
          {title}
        </p>
        {review && (
          <span className="hidden items-center gap-1.5 text-[12.5px] font-medium sm:flex" style={{ color: stale ? 'var(--status-developing)' : 'var(--status-proficient)' }}>
            {stale ? '●' : <Check size={14} />}
            {stale ? 'Edited' : 'Marked'}
          </span>
        )}
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          aria-label="Subject"
          className="hidden h-9 max-w-[13rem] cursor-pointer rounded-full border bg-transparent px-3 text-[13px] outline-none xl:block"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="hidden shrink-0 rounded-full p-0.5 xl:flex" style={{ background: 'var(--surface-sunken)' }}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              disabled={busy}
              aria-pressed={kind === k.key}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors"
              style={kind === k.key ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.12)' } : { color: 'var(--text-muted)' }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </header>

      {/* What it is, on a phone. */}
      <div className="flex shrink-0 gap-2 border-b px-4 py-2 xl:hidden" style={{ borderColor: 'var(--border)' }}>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} aria-label="Subject" className="h-9 min-w-0 flex-1 rounded-full border bg-transparent px-3 text-[16px] outline-none sm:max-w-[16rem] sm:flex-none sm:text-[13px]" style={{ borderColor: 'var(--border-strong)' }}>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy} aria-label="What it is" className="h-9 rounded-full border bg-transparent px-3 text-[16px] outline-none sm:text-[13px]" style={{ borderColor: 'var(--border-strong)' }}>
          {KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* The page. */}
        <section className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[760px] px-6 pb-20 pt-8 sm:px-12">
              <HighlightEditor text={text} onChange={setText} parts={parts} active={active} show={show} onCaret={caret} markRefs={markRefs} disabled={busy} />
            </div>
          </div>
          <footer className="flex h-12 shrink-0 items-center gap-1 border-t px-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <button type="button" onClick={pasteIn} disabled={busy} className="h-8 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
              Paste
            </button>
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain" hidden onChange={(e) => (openFile(e.target.files?.[0]), (e.target.value = ''))} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
              <FileIcon size={14} />
              Open
            </button>
            {text && (
              <button
                type="button"
                onClick={() => {
                  setText('')
                  setReview(null)
                  setMarkedText('')
                }}
                disabled={busy}
                className="h-8 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear
              </button>
            )}
            {review && (
              <button type="button" onClick={() => setShow((v) => !v)} className="h-8 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: show ? 'var(--brand)' : 'var(--text-muted)' }}>
                {show ? 'Highlights on' : 'Highlights off'}
              </button>
            )}
            <div className="flex-1" />
            <span className="px-2 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {words.toLocaleString()} words
            </span>
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold lg:hidden"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              {review ? `${total}/${outOf}` : 'Mark it'}
            </button>
          </footer>

          <button
            type="button"
            onClick={() => setPanel((p) => !p)}
            aria-label={panel ? 'Hide the marks' : 'Show the marks'}
            className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border shadow-sm transition-colors hover:bg-[var(--surface-sunken)] lg:flex"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            <Collapse size={14} flip={!panel} />
          </button>
        </section>

        {/* The marks: beside the page on a wide screen, a sheet on a narrow one. */}
        {(panel || sheet) && (
          <aside
            className={`${sheet ? 'fixed inset-x-0 bottom-0 top-[18vh] z-50 flex rounded-t-[22px] shadow-2xl' : 'hidden'} ${panel ? 'lg:static lg:z-auto lg:flex lg:rounded-none lg:shadow-none' : 'lg:hidden'} w-full flex-col border-l lg:w-[460px] lg:shrink-0`}
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex shrink-0 justify-center pt-2 lg:hidden">
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="h-1.5 w-10 rounded-full" style={{ background: 'var(--border-strong)' }} />
            </div>
            {panelBody}
            {panelFooter}
          </aside>
        )}
        {sheet && <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgb(0 0 0 / 0.4)' }} onClick={() => setSheet(false)} aria-hidden="true" />}
      </div>
    </div>
  )
}
