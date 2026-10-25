'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import ScoreRing, { ringColour } from '@/components/ScoreRing'
import SyllabiMark from '@/components/SyllabiMark'
import { KINDS, rubricFor, isPaper } from '@/lib/criteria'
import { segments } from '@/lib/draft-review'
import { senseCheck, MIN_WORDS } from '@/lib/sense-check'
import { shortName } from '@/lib/subject-short'
import { Chevron, Copy, Check, Download, Collapse, Refresh, FileIcon } from '@/components/syllabi/icons'
import Select from '@/components/Select'
import { readDraft, DraftFileProblem, DRAFT_ACCEPT } from '@/components/syllabi/draftFile'

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
 * Every marking is saved to the student's account by the route (syllabi_marks),
 * grouped by draft, so My drafts lists them and "This draft over time" shows
 * each redraft's score. The text being edited is also kept in this tab, so a
 * refresh does not lose unmarked changes.
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

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const shortDate = (at) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/**
 * Every draft this student has had marked, newest first: one entry per
 * draft, with its latest marking and how far it has come since the first.
 */
function MyDrafts({ onOpen, onClose }) {
  const [drafts, setDrafts] = useState(null)
  const [confirming, setConfirming] = useState(null)

  useEffect(() => {
    let gone = false
    const load = async () => {
      const { data } = await createClient()
        .from('syllabi_marks')
        .select('id, draft_id, subject, kind, title, total, out_of, grade, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      const byDraft = new Map()
      for (const m of data || []) {
        const d = byDraft.get(m.draft_id)
        if (!d) byDraft.set(m.draft_id, { ...m, latest: m, first: m, count: 1 })
        else {
          d.first = m
          d.count += 1
        }
      }
      if (!gone) setDrafts([...byDraft.values()])
    }
    load()
    return () => {
      gone = true
    }
  }, [])

  const remove = async (d) => {
    const { error } = await createClient().from('syllabi_marks').delete().eq('draft_id', d.draft_id)
    if (!error) setDrafts((list) => list.filter((x) => x.draft_id !== d.draft_id))
  }

  return (
    <div className="pop-enter absolute right-3 top-[58px] z-40 flex max-h-[70vh] w-[min(26rem,calc(100%-1.5rem))] flex-col rounded-[18px] border shadow-2xl" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[14px] font-semibold">My drafts</p>
        <button type="button" onClick={onClose} className="text-[12.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
          Close
        </button>
      </div>
      <div className="overflow-y-auto p-2">
        {drafts === null ? (
          [0, 1, 2].map((i) => <div key={i} className="m-1 h-14 animate-pulse rounded-[12px]" style={{ background: 'var(--surface-sunken)' }} />)
        ) : drafts.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Every draft you get marked is kept here, with each marking.
          </p>
        ) : (
          drafts.map((d) => {
            const gain = d.latest.total - d.first.total
            return (
              <div key={d.draft_id} className="group relative">
                <button type="button" onClick={() => onOpen(d.latest.id)} className="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2.5 pr-16 text-left transition-colors hover:bg-[var(--surface-sunken)]">
                  <ScoreRing value={d.latest.total} max={d.latest.out_of || 1} size={40} stroke={3.5}>
                    <span className="text-[11.5px] font-semibold">{d.latest.total}</span>
                  </ScoreRing>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{d.title || 'Untitled draft'}</span>
                    <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      {shortName(d.subject || '')} · {KINDS.find((k) => k.key === d.kind)?.label} · {shortDate(d.latest.created_at)}
                      {d.count > 1 && ` · ${d.count} markings`}
                    </span>
                  </span>
                  {d.count > 1 && gain !== 0 && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: `color-mix(in srgb, ${gain > 0 ? 'var(--status-proficient)' : 'var(--status-weak)'} 16%, transparent)`, color: gain > 0 ? 'var(--status-proficient)' : 'var(--status-weak)' }}>
                      {gain > 0 ? '+' : ''}
                      {gain}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => (confirming === d.draft_id ? remove(d) : setConfirming(d.draft_id))}
                  onBlur={() => setConfirming(null)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-[8px] px-2 py-1 text-[11.5px] font-semibold transition-opacity ${confirming === d.draft_id ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                  style={confirming === d.draft_id ? { background: 'var(--status-weak)', color: '#fff' } : { color: 'var(--text-faint)' }}
                >
                  {confirming === d.draft_id ? 'Delete all' : 'Delete'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
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
function asText(review, { subject, kind, question = '' }) {
  const total = review.criteria.reduce((a, c) => a + c.score, 0)
  const outOf = review.criteria.reduce((a, c) => a + c.max, 0)
  const lines = [
    `Syllabi feedback · ${subject} · ${KINDS.find((k) => k.key === kind)?.label}`,
    `${total}/${outOf} · likely grade ${review.grade_estimate || '–'} (an estimate, not a mark)`,
    review.grade_note,
    ...(isPaper(kind) && question.trim() ? ['', `Question: ${question.trim()}`] : []),
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
function HighlightEditor({ text, onChange, parts, active, show, onCaret, markRefs, disabled, placeholder = 'Paste or write your draft here.' }) {
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
        placeholder={placeholder}
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
  const [subject, setSubject] = useState(saved.subject && subjects.includes(saved.subject) ? saved.subject : subjects[0] || '')
  const [kind, setKind] = useState(saved.kind || 'ia')
  const [text, setText] = useState(saved.text || '')
  // For an exam paper: the question answered, and the extract for a Paper 1.
  const [question, setQuestion] = useState(saved.question || '')
  const [questionOpen, setQuestionOpen] = useState(!saved.question)
  const [review, setReview] = useState(saved.review || null)
  const [markedText, setMarkedText] = useState(saved.markedText || '')
  const [markedFor, setMarkedFor] = useState(saved.markedFor || '')
  // Which draft this is (its markings share it) and which marking is showing.
  const [draftId, setDraftId] = useState(saved.draftId || newId())
  const [markId, setMarkId] = useState(saved.markId || null)
  const [history, setHistory] = useState([])
  const [drafts, setDraftsOpen] = useState(false)
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
      sessionStorage.setItem(STORE, JSON.stringify({ subject, kind, text, question, review, markedText, markedFor, draftId, markId }))
    } catch {
      /* too big or blocked: it just will not survive a refresh */
    }
  }, [subject, kind, text, question, review, markedText, markedFor, draftId, markId])

  // Every marking of this draft, oldest first, for the progress view.
  useEffect(() => {
    let gone = false
    const load = async () => {
      const { data } = await createClient()
        .from('syllabi_marks')
        .select('id, total, out_of, grade, created_at')
        .eq('draft_id', draftId)
        .order('created_at', { ascending: true })
      if (!gone) setHistory(data || [])
    }
    load()
    return () => {
      gone = true
    }
  }, [draftId])

  /** Open a saved marking: its text, its review, and the draft it belongs to. */
  const openMark = useCallback(
    async (id) => {
      if (text !== markedText && text.trim() && !window.confirm('Open that marking? Edits you have not had marked will be replaced.')) return
      const { data } = await createClient().from('syllabi_marks').select('id, draft_id, subject, kind, text, question, review').eq('id', id).maybeSingle()
      if (!data) return
      setDraftsOpen(false)
      if (data.subject && subjects.includes(data.subject)) setSubject(data.subject)
      setKind(data.kind)
      setText(data.text)
      setReview(data.review)
      setMarkedText(data.text)
      setQuestion(data.question || '')
      setQuestionOpen(false)
      setMarkedFor(`${data.subject && subjects.includes(data.subject) ? data.subject : subject}|${data.kind}${isPaper(data.kind) ? `|${(data.question || '').trim()}` : ''}`)
      setDraftId(data.draft_id)
      setMarkId(data.id)
      setActive(null)
      setOnly(null)
      setTab('marks')
    },
    [text, markedText, subjects, subject]
  )

  const newDraft = () => {
    if (text.trim() && text !== markedText && !window.confirm('Start a new draft? Edits you have not had marked will be cleared.')) return
    setText('')
    setQuestion('')
    setQuestionOpen(true)
    setReview(null)
    setMarkedText('')
    setMarkedFor('')
    setDraftId(newId())
    setMarkId(null)
    setDraftsOpen(false)
  }

  // The reading messages turn over while it works.
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setStep((s) => Math.min(READING.length - 1, s + 1)), 4500)
    return () => clearInterval(t)
  }, [busy])

  const words = countWords(text)
  const rubric = rubricFor(kind, subject)
  const stale = Boolean(review) && text !== markedText
  // What a marking was for: re-marking is offered when any of it changes.
  const forKey = `${subject}|${kind}${isPaper(kind) ? `|${question.trim()}` : ''}`
  // Marking again costs one of today's few, so only when something changed.
  const changed = !review || stale || markedFor !== forKey
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
        body: JSON.stringify({ task: 'draft_feedback', text: sentText, subject, kind, draft_id: draftId, question: isPaper(kind) ? question : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.review) {
        setError(data.code === 'not_configured' ? 'Syllabi is being switched on. Try again soon.' : data.error || 'That did not work.')
      } else {
        setReview(data.review)
        setMarkedText(sentText)
        setMarkedFor(forKey)
        setRemaining(data.remaining ?? null)
        if (data.saved) {
          setMarkId(data.saved.id)
          const total = data.review.criteria.reduce((a, c) => a + c.score, 0)
          const out_of = data.review.criteria.reduce((a, c) => a + c.max, 0)
          setHistory((h) => [...h, { id: data.saved.id, total, out_of, grade: data.review.grade_estimate, created_at: data.saved.created_at }])
        }
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

  const exportText = review ? asText(review, { subject, kind, question }) : ''
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

  // A PDF, a Word file or a text file, opened or dropped: its text becomes the draft.
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const openFile = async (file) => {
    if (!file || busy) return
    setError('')
    setReading(true)
    try {
      setText((await readDraft(file)).slice(0, MAX))
    } catch (e) {
      setError(e instanceof DraftFileProblem ? e.message : 'That file could not be opened. Paste the text in instead.')
    } finally {
      setReading(false)
    }
  }
  const dropZone = {
    onDragOver: (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
    },
    onDrop: (e) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      setDragging(false)
      openFile(e.dataTransfer.files[0])
    },
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

            {/* Every marking of this draft, so a redraft shows what it gained. */}
            {history.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold tracking-[-0.01em]">This draft over time</p>
                  {history.length > 1 && (() => {
                    const gain = history[history.length - 1].total - history[0].total
                    return (
                      <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: gain >= 0 ? 'var(--status-proficient)' : 'var(--status-weak)' }}>
                        {gain >= 0 ? '+' : ''}
                        {gain} since the first marking
                      </span>
                    )
                  })()}
                </div>
                {markId && history.length > 1 && markId !== history[history.length - 1].id && (
                  <p className="mt-2 flex items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: 'color-mix(in srgb, var(--status-developing) 14%, transparent)' }}>
                    <span>You are looking at an earlier marking.</span>
                    <button type="button" onClick={() => openMark(history[history.length - 1].id)} className="font-semibold text-[var(--brand)] hover:underline">
                      Open latest
                    </button>
                  </p>
                )}
                <div className="mt-3 flex h-[104px] items-end gap-2 overflow-x-auto pb-1">
                  {history.map((h, i) => {
                    const fraction = h.out_of ? h.total / h.out_of : 0
                    const on = h.id === markId
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => !on && openMark(h.id)}
                        title={`${shortDate(h.created_at)}: ${h.total}/${h.out_of}${h.grade ? `, likely ${h.grade}` : ''}`}
                        className="flex w-11 shrink-0 flex-col items-center justify-end gap-1"
                      >
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: on ? 'var(--text)' : 'var(--text-muted)' }}>
                          {h.total}
                        </span>
                        <span
                          className="w-full rounded-[6px] transition-[height] duration-500"
                          style={{
                            height: `${Math.max(8, fraction * 60)}px`,
                            background: ringColour(fraction),
                            opacity: on ? 1 : 0.45,
                            outline: on ? '2px solid var(--text)' : 'none',
                            outlineOffset: 2,
                            animationDelay: `${i * 60}ms`,
                          }}
                        />
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                          {shortDate(h.created_at)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
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
          disabled={busy || words < MIN_WORDS || !changed}
          className="flex h-12 shrink-0 items-center gap-2 rounded-[14px] px-5 text-[15px] font-semibold transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
          title={words < MIN_WORDS ? `At least ${MIN_WORDS} words` : undefined}
        >
          {review ? 'Re-mark' : 'Mark it'}
          <Refresh size={17} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      {drafts && <MyDrafts onOpen={openMark} onClose={() => setDraftsOpen(false)} />}
      {/* The document bar. */}
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b px-4 md:px-5" style={{ borderColor: 'var(--border)' }}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
          <FileIcon size={15} />
        </span>
        <p className="min-w-0 flex-1 truncate text-[15.5px] font-medium tracking-[-0.01em]" title={title}>
          {title}
        </p>
        <button type="button" onClick={() => setDraftsOpen((v) => !v)} aria-expanded={drafts} className="h-9 shrink-0 rounded-full border px-3 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border-strong)' }}>
          My drafts
        </button>
        <button type="button" onClick={newDraft} disabled={busy} className="hidden h-9 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)] sm:block" style={{ color: 'var(--text-muted)' }}>
          + New
        </button>
        {review && (
          <span className="hidden items-center gap-1.5 text-[12.5px] font-medium sm:flex" style={{ color: stale ? 'var(--status-developing)' : 'var(--status-proficient)' }}>
            {stale ? '●' : <Check size={14} />}
            {stale ? 'Edited' : 'Marked'}
          </span>
        )}
        <Select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={busy}
          aria-label="Subject"
          className="hidden h-9 max-w-[13rem] rounded-full border bg-transparent pl-3.5 pr-1.5 text-[13px] outline-none xl:flex"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
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
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} aria-label="Subject" className="h-9 min-w-0 flex-1 rounded-full border bg-transparent pl-3.5 pr-2 text-[14px] outline-none sm:max-w-[16rem] sm:flex-none sm:text-[13px]" style={{ borderColor: 'var(--border-strong)' }}>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy} aria-label="What it is" className="h-9 rounded-full border bg-transparent pl-3.5 pr-2 text-[14px] outline-none sm:text-[13px]" style={{ borderColor: 'var(--border-strong)' }}>
          {KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* The page. A file dropped anywhere on it opens as the draft. */}
        <section className="relative flex min-w-0 flex-1 flex-col" {...dropZone}>
          {(dragging || reading) && (
            <div
              className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-[18px] border-2 border-dashed text-[14px] font-semibold"
              style={{ borderColor: 'var(--brand)', background: 'color-mix(in oklab, var(--brand) 8%, var(--bg))', color: 'var(--brand)' }}
            >
              {reading ? 'Reading your file…' : 'Drop your draft here: PDF, Word or text'}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[760px] px-6 pb-20 pt-8 sm:px-12">
              {isPaper(kind) && (
                <div className="mb-7 rounded-[14px] border" style={{ borderColor: question.trim() ? 'var(--border)' : 'var(--brand)', background: 'var(--surface-sunken)' }}>
                  <button type="button" onClick={() => setQuestionOpen((v) => !v)} aria-expanded={questionOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--brand)' }}>
                      Question
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: question.trim() ? 'var(--text-body)' : 'var(--text-faint)' }}>
                      {question.trim() ? question.trim().split('\n')[0] : kind === 'p1' ? 'Paste the question you answered, and the extract if there was one' : 'Paste the question you answered'}
                    </span>
                    <Chevron up={questionOpen} />
                  </button>
                  {questionOpen && (
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value.slice(0, 8000))}
                      disabled={busy}
                      rows={kind === 'p1' ? 7 : 3}
                      placeholder={kind === 'p1' ? 'The question, then the text or extract it was about.' : 'The essay question, exactly as it was set.'}
                      aria-label="The question you answered"
                      className="block w-full resize-y border-t bg-transparent px-4 py-3 text-[16px] leading-relaxed outline-none placeholder:text-[var(--text-faint)] sm:text-[14px]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }}
                    />
                  )}
                </div>
              )}
              <HighlightEditor placeholder={isPaper(kind) ? 'Paste or write your answer here.' : undefined} text={text} onChange={setText} parts={parts} active={active} show={show} onCaret={caret} markRefs={markRefs} disabled={busy} />
            </div>
          </div>
          <footer className="flex h-12 shrink-0 items-center gap-1 border-t px-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <button type="button" onClick={pasteIn} disabled={busy} className="h-8 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
              Paste
            </button>
            <input ref={fileRef} type="file" accept={DRAFT_ACCEPT} hidden onChange={(e) => (openFile(e.target.files?.[0]), (e.target.value = ''))} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
              <FileIcon size={14} />
              Open
            </button>
            {text && (
              <button
                type="button"
                onClick={newDraft}
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
