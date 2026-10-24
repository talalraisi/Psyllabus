'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { PageHeader } from '@/components/PageShell'
import { IconArrowLeft } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { MAX_BOX } from '@/lib/flashcards'

/**
 * Ready-made decks, laid out the way the course is.
 *
 * Every subject the student takes is on the shelf, with how many cards it
 * has and how far they are into them. Opening one shows its syllabus: topics
 * in the guide's order, the units inside them, and every subtopic with its
 * cards, so a student studies "Cell respiration" or the whole of "Topic C",
 * never an unexplained "20 cards" from somewhere in the subject.
 *
 * Only the counts are loaded up front (preset_deck_counts). A subtopic's
 * cards are fetched when it is studied, together with the ones the student
 * has already taken, so a deck they started carries on rather than starting
 * again.
 */

const MODES = [
  { key: 'flip', label: 'Flip' },
  { key: 'write', label: 'Write' },
  { key: 'blank', label: 'Blank' },
  { key: 'test', label: 'Test' },
]

/* The study mode, shared with StudyMenu: the same key on this device. */
const KEY = 'psyllabus:study-mode'
const listeners = new Set()
const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const readMode = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
const saveMode = (m) => {
  try {
    localStorage.setItem(KEY, m)
  } catch {}
  listeners.forEach((fn) => fn())
}

/** Started and known, from the student's own cards, against a total. */
function Progress({ total, started, known }) {
  const pct = (n) => `${Math.min(100, (n / Math.max(1, total)) * 100)}%`
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }} aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(started), background: 'color-mix(in oklab, var(--brand) 35%, var(--surface-sunken))' }} />
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(known), background: 'var(--brand)' }} />
    </span>
  )
}

/** How many of the student's own cards sit in each subtopic, started and known. */
function useMine(mine, subject) {
  return useMemo(() => {
    const by = new Map()
    for (const c of mine) {
      if (c.subject !== subject) continue
      const k = c.subtopic || ''
      const e = by.get(k) || { started: 0, known: 0 }
      e.started++
      if ((c.box || 0) >= MAX_BOX) e.known++
      by.set(k, e)
    }
    return by
  }, [mine, subject])
}

/* ------------------------------------------------------------------ shelf */

export function ReadyShelf({ subjects, counts, mine, onOpen }) {
  return (
    <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {subjects.map((subject) => {
        const rows = counts[subject] || []
        const total = rows.reduce((a, r) => a + r.cards, 0)
        const own = mine.filter((c) => c.subject === subject && c.source === 'preset')
        const known = own.filter((c) => (c.box || 0) >= MAX_BOX).length
        return (
          <li key={subject}>
            <button
              onClick={() => onOpen(subject)}
              disabled={!total}
              className="elev lift flex h-full w-full flex-col rounded-[16px] border p-5 text-left disabled:cursor-default disabled:opacity-60"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <span className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em]">{subject}</span>
              {total ? (
                <>
                  <span className="mt-4 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{total.toLocaleString()}</span>
                  <span className="mt-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                    cards in {rows.length} subtopic{rows.length === 1 ? '' : 's'}
                  </span>
                  <span className="mt-4 w-full">
                    <Progress total={total} started={own.length} known={known} />
                  </span>
                  <span className="mt-1.5 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                    {own.length ? `${own.length.toLocaleString()} started · ${known.toLocaleString()} known` : 'Not started'}
                  </span>
                </>
              ) : (
                <span className="mt-3 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  Cards for this subject are on their way.
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------------------------------------------------------- subject */

export function ReadySubject({ subject, counts, syllabus, mine, onBack, onStudy }) {
  const saved = useSyncExternalStore(subscribe, readMode, () => null)
  const mode = MODES.some((m) => m.key === saved) ? saved : 'flip'
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const [busy, setBusy] = useState(null)
  const progress = useMine(mine, subject)

  /* Topics, then units, then subtopics, in the guide's order. A subtopic with
     cards that the syllabus no longer lists goes under "Other". */
  const topics = useMemo(() => {
    const cardsBy = new Map((counts || []).map((r) => [r.subtopic, r.cards]))
    const placed = new Set()
    const out = []
    const rows = [...(syllabus || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    for (const r of rows) {
      const n = cardsBy.get(r.subtopic)
      if (!n || placed.has(r.subtopic)) continue
      placed.add(r.subtopic)
      let t = out.find((x) => x.topic === r.topic)
      if (!t) out.push((t = { topic: r.topic, units: [] }))
      const unit = [r.code, r.unit].filter(Boolean).join(' ')
      let u = t.units.find((x) => x.unit === unit)
      if (!u) t.units.push((u = { unit, subtopics: [] }))
      u.subtopics.push({ name: r.subtopic, cards: n })
    }
    const rest = (counts || []).filter((r) => !placed.has(r.subtopic))
    if (rest.length) out.push({ topic: 'Other', units: [{ unit: '', subtopics: rest.map((r) => ({ name: r.subtopic, cards: r.cards })) }] })
    for (const t of out) {
      t.subtopics = t.units.flatMap((u) => u.subtopics)
      t.cards = t.subtopics.reduce((a, s) => a + s.cards, 0)
    }
    return out
  }, [counts, syllabus])

  const total = topics.reduce((a, t) => a + t.cards, 0)
  const q = query.trim().toLowerCase()
  const matches = (s) => !q || displaySubtopic(s.name).toLowerCase().includes(q)
  const isOpen = (t, i) => (q ? t.subtopics.some(matches) : open.has(t.topic) || (open.size === 0 && i === 0))
  const toggle = (topic) =>
    setOpen((prev) => {
      const next = new Set(prev.size ? prev : [topics[0]?.topic])
      next.has(topic) ? next.delete(topic) : next.add(topic)
      return next
    })

  const sum = (list, key) => list.reduce((a, s) => a + (progress.get(s.name)?.[key] || 0), 0)

  const study = async (id, names) => {
    setBusy(id)
    try {
      await onStudy(subject, names, mode)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--brand)' }}>
        <IconArrowLeft width={14} height={14} />
        All flashcards
      </button>
      <PageHeader
        title={subject}
        subtitle={`${total.toLocaleString()} ready-made cards in ${topics.reduce((a, t) => a + t.subtopics.length, 0)} subtopics. Pick a subtopic, or a whole topic, to study. A card becomes yours when you first answer it.`}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Study as
          </span>
          <div className="flex rounded-full border p-0.5" role="radiogroup" aria-label="How to study" style={{ borderColor: 'var(--border-strong)' }}>
            {MODES.map((m) => (
              <button
                key={m.key}
                role="radio"
                aria-checked={mode === m.key}
                onClick={() => saveMode(m.key)}
                className="rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors"
                style={mode === m.key ? { background: 'var(--brand)', color: '#fff' } : { color: 'var(--text-muted)' }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a subtopic"
          aria-label="Find a subtopic"
          className="input h-10 flex-1 text-[16px] sm:text-[13.5px]"
        />
      </div>

      <ul className="flex flex-col gap-2.5">
        {topics.map((t, i) => {
          const expanded = isOpen(t, i)
          const started = sum(t.subtopics, 'started')
          const known = sum(t.subtopics, 'known')
          if (q && !t.subtopics.some(matches)) return null
          return (
            <li key={t.topic} className="overflow-hidden rounded-[16px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <button onClick={() => toggle(t.topic)} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] transition-transform" style={{ color: 'var(--text-faint)', transform: expanded ? 'rotate(90deg)' : 'none' }} aria-hidden="true">
                      ▶
                    </span>
                    <span className="truncate text-[14px] font-semibold">{t.topic}</span>
                  </span>
                  <span className="mt-1 block pl-5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                    {t.cards.toLocaleString()} cards · {t.subtopics.length} subtopic{t.subtopics.length === 1 ? '' : 's'}
                    {started ? ` · ${started} started, ${known} known` : ''}
                  </span>
                  <span className="mt-2 block pl-5 sm:max-w-xs">
                    <Progress total={t.cards} started={started} known={known} />
                  </span>
                </button>
                <button onClick={() => study(t.topic, t.subtopics.map((s) => s.name))} disabled={busy != null} className="btn btn-outline control-sm shrink-0">
                  {busy === t.topic ? 'Loading…' : 'Study topic'}
                </button>
              </div>
              {expanded && (
                <div className="border-t px-2 pb-2" style={{ borderColor: 'var(--border)' }}>
                  {t.units.map((u) => {
                    const subs = u.subtopics.filter(matches)
                    if (!subs.length) return null
                    return (
                      <div key={u.unit || 'none'}>
                        {u.unit && t.units.length > 1 && (
                          <p className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                            {u.unit}
                          </p>
                        )}
                        <ul>
                          {subs.map((s) => {
                            const p = progress.get(s.name) || { started: 0, known: 0 }
                            return (
                              <li key={s.name} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors hover:bg-[var(--surface-sunken)]">
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13.5px] leading-snug" style={{ color: 'var(--text-body)' }}>
                                    {displaySubtopic(s.name)}
                                  </span>
                                  <span className="mt-0.5 block text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                                    {s.cards} cards{p.started ? ` · ${p.started} started, ${p.known} known` : ''}
                                  </span>
                                </span>
                                <button onClick={() => study(s.name, [s.name])} disabled={busy != null} className="btn btn-quiet control-sm shrink-0" style={{ color: 'var(--brand)' }}>
                                  {busy === s.name ? 'Loading…' : 'Study'}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
