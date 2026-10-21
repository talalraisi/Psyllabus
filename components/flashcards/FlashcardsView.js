'use client'

import { useMemo, useState } from 'react'
import MathText from '@/components/MathText'
import { Page, PageHeader } from '@/components/PageShell'
import { IconArrowLeft, IconArrowRight, IconPlus } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { isDue, dueLabel, MAX_BOX } from '@/lib/flashcards'
import StudyMenu from '@/components/StudyMenu'
import LockedPanel from '@/components/LockedPanel'
import Select from '@/components/Select'
import CardMaker from '@/components/flashcards/CardMaker'

/**
 * The flashcards page, laid out.
 *
 *   Make cards      upload notes, paste them, or write one (CardMaker)
 *   Today           what is due, one button to start, and the boxes: every
 *                   card's place in its spacing, so a student can see the
 *                   deck moving out as they learn it
 *   Your decks      one card per subject
 *   Ready-made      checked decks for their subjects, by subject
 *
 * Opening a deck shows its cards as a grid you can filter by subtopic or
 * search, twelve at a time, each editable in place.
 */

const BOX_LABEL = ['New', '1 day', '3 days', '1 week', '2 weeks', '5 weeks']
const PAGE = 12

function Boxes({ cards, compact = false }) {
  const counts = Array.from({ length: MAX_BOX + 1 }, (_, b) => cards.filter((c) => Math.min(MAX_BOX, c.box || 0) === b).length)
  const max = Math.max(1, ...counts)
  if (compact) {
    return (
      <span className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }} aria-hidden="true">
        {counts.map((n, b) => (
          <span key={b} style={{ width: `${(n / Math.max(1, cards.length)) * 100}%`, background: `color-mix(in oklab, var(--brand) ${25 + b * 15}%, var(--surface-sunken))` }} />
        ))}
      </span>
    )
  }
  return (
    <div>
      <div className="flex h-24 items-end gap-1.5" role="img" aria-label={counts.map((n, b) => `${BOX_LABEL[b]}: ${n}`).join(', ')}>
        {counts.map((n, b) => (
          <div key={b} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: n ? 'var(--text)' : 'var(--text-faint)' }}>
              {n}
            </span>
            <span
              className="w-full rounded-[6px] transition-[height] duration-700"
              style={{ height: `${Math.max(4, (n / max) * 64)}px`, background: n ? `color-mix(in oklab, var(--brand) ${30 + b * 14}%, var(--surface-sunken))` : 'var(--border)' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {BOX_LABEL.map((l) => (
          <span key={l} className="flex-1 truncate text-center text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

function CardTile({ card, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const due = isDue(card)

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-[16px] border p-4" style={{ borderColor: 'var(--brand)', background: 'var(--surface)' }}>
        <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} aria-label="Front" className="input resize-none text-[16px] font-medium sm:text-[14px]" style={{ height: 'auto', padding: '8px 12px' }} />
        <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} aria-label="Back" className="input resize-none text-[16px] sm:text-[13.5px]" style={{ height: 'auto', padding: '8px 12px' }} />
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (await onEdit(card, { front, back })) setEditing(false)
            }}
            disabled={!front.trim() || !back.trim()}
            className="btn btn-solid control-sm"
          >
            Save
          </button>
          <button
            onClick={() => {
              setFront(card.front)
              setBack(card.back)
              setEditing(false)
            }}
            className="btn btn-quiet control-sm"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="group flex flex-col rounded-[16px] border p-4 transition-colors hover:border-[var(--border-strong)]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="line-clamp-3 text-[14px] font-semibold leading-snug" style={{ color: 'var(--text)' }}>
        <MathText>{card.front}</MathText>
      </p>
      <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        <MathText>{card.back}</MathText>
      </p>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <span className="flex gap-0.5" title={`Box ${Math.min(MAX_BOX, card.box || 0)} of ${MAX_BOX}`} aria-label={`Box ${Math.min(MAX_BOX, card.box || 0)} of ${MAX_BOX}`}>
          {Array.from({ length: MAX_BOX }, (_, i) => (
            <span key={i} className="h-1.5 w-2.5 rounded-full" style={{ background: i < (card.box || 0) ? 'var(--brand)' : 'var(--border-strong)' }} />
          ))}
        </span>
        <span className="text-[11.5px] font-medium" style={{ color: due ? 'var(--brand)' : 'var(--text-faint)' }}>
          {dueLabel(card)}
        </span>
        {card.source === 'syllabi' && (
          <span className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
            · from your notes
          </span>
        )}
        <span className="ml-auto flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button onClick={() => setEditing(true)} className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
            Edit
          </button>
          <button onClick={() => onDelete(card)} className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]" style={{ color: 'var(--text-faint)' }}>
            Delete
          </button>
        </span>
      </div>
    </li>
  )
}

export default function FlashcardsView({ cards, presets = [], presetsLocked, notes, subjects, syllabi, error, onReview, onAdd, onEdit, onDelete }) {
  const [deck, setDeck] = useState(null)
  const [subtopic, setSubtopic] = useState('')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [making, setMaking] = useState(null) // null | 'upload' | 'paste' | 'write'
  const [openPreset, setOpenPreset] = useState(null)

  const due = useMemo(() => cards.filter(isDue), [cards])

  const decks = useMemo(() => {
    const map = new Map()
    for (const c of cards) {
      if (!map.has(c.subject)) map.set(c.subject, { subject: c.subject, cards: [], due: 0 })
      const d = map.get(c.subject)
      d.cards.push(c)
      if (isDue(c)) d.due++
    }
    return [...map.values()].sort((a, b) => b.due - a.due || a.subject.localeCompare(b.subject))
  }, [cards])

  // Ready-made decks not yet fully taken, by subject.
  const offered = useMemo(() => {
    const mine = new Set(cards.map((c) => `${c.subject}||${c.front}`))
    const map = new Map()
    for (const p of presets) {
      if (mine.has(`${p.subject}||${p.front}`)) continue
      if (!map.has(p.subject)) map.set(p.subject, { subject: p.subject, subtopics: new Map(), total: 0 })
      const s = map.get(p.subject)
      s.total++
      if (!s.subtopics.has(p.subtopic)) s.subtopics.set(p.subtopic, [])
      s.subtopics.get(p.subtopic).push({ ...p, preset: true, box: 1, reviews: 0 })
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [presets, cards])

  const open = (subject) => {
    setDeck(subject)
    setSubtopic('')
    setQuery('')
    setShown(PAGE)
    window.scrollTo?.({ top: 0 })
  }

  const maker = making && (
    <div className="mb-8">
      <CardMaker
        key={making}
        subjects={subjects}
        savedNotes={notes}
        syllabi={syllabi}
        initialTab={making}
        initialSubject={deck}
        onSave={async (list) => {
          const ok = await onAdd(list)
          if (ok) setMaking(null)
          return ok
        }}
        onClose={() => setMaking(null)}
      />
    </div>
  )

  /* ---------------------------------------------------------------- a deck */
  if (deck) {
    const all = cards.filter((c) => c.subject === deck)
    const subs = [...new Set(all.map((c) => c.subtopic || ''))].sort()
    const q = query.trim().toLowerCase()
    const list = all.filter((c) => (!subtopic || (c.subtopic || '') === subtopic) && (!q || `${c.front} ${c.back}`.toLowerCase().includes(q)))
    const dueHere = list.filter(isDue)
    return (
      <Page width="default">
        <button onClick={() => setDeck(null)} className="mb-4 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--brand)' }}>
          <IconArrowLeft width={14} height={14} />
          All decks
        </button>
        <PageHeader
          title={deck}
          subtitle={`${all.length} card${all.length === 1 ? '' : 's'} · ${all.filter(isDue).length ? `${all.filter(isDue).length} due now` : 'nothing due'}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setMaking(making ? null : syllabi ? 'upload' : 'paste')} className="btn btn-outline control-md">
                <IconPlus width={15} height={15} />
                Add cards
              </button>
              {list.length > 0 && (
                <StudyMenu
                  count={list.length}
                  primary={dueHere.length ? 'flip' : 'write'}
                  verb={dueHere.length ? 'Review' : 'Study'}
                  compact
                  onStart={(mode) => onReview(dueHere.length && mode === 'flip' ? dueHere : list, !dueHere.length || mode !== 'flip', mode)}
                />
              )}
            </div>
          }
        />
        {maker}

        <div className="mb-5 grid gap-2 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          {subs.length > 1 && (
            <Select value={subtopic} onChange={(e) => (setSubtopic(e.target.value), setShown(PAGE))} aria-label="Subtopic" className="input h-10 pr-2 text-[13.5px]">
              <option value="">All subtopics</option>
              {subs.map((s) => (
                <option key={s || 'none'} value={s}>
                  {s ? displaySubtopic(s) : 'No subtopic'}
                </option>
              ))}
            </Select>
          )}
          <input value={query} onChange={(e) => (setQuery(e.target.value), setShown(PAGE))} placeholder="Search these cards" aria-label="Search these cards" className={`input h-10 text-[16px] sm:text-[13.5px] ${subs.length > 1 ? '' : 'sm:col-span-2'}`} />
        </div>

        {list.length === 0 ? (
          <p className="rounded-[16px] border border-dashed px-6 py-10 text-center text-[13.5px]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
            {all.length ? 'No cards match that.' : 'No cards here yet.'}
          </p>
        ) : (
          <>
            <ul className="stagger grid gap-3 sm:grid-cols-2">
              {list.slice(0, shown).map((c) => (
                <CardTile key={c.id} card={c} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </ul>
            {list.length > shown && (
              <button onClick={() => setShown((n) => n + PAGE)} className="btn btn-outline control-md mx-auto mt-5 flex">
                Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
              </button>
            )}
          </>
        )}
      </Page>
    )
  }

  /* ------------------------------------------------------------- the shelf */
  return (
    <Page width="default">
      <PageHeader
        title="Flashcards"
        subtitle="Spaced cards that come back right before you forget them."
        action={
          !making && (
            <button onClick={() => setMaking(syllabi ? 'upload' : 'paste')} className="btn btn-outline control-md">
              <IconPlus width={15} height={15} />
              Make cards
            </button>
          )
        }
      />

      {error && (
        <p className="mb-6 rounded-[12px] px-4 py-3 text-[13px]" role="alert" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {maker}

      {cards.length === 0 && !making ? (
        /* First time: three ways in. */
        <section className="mb-10 rounded-[20px] border p-6 sm:p-8" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
            Start a deck
          </p>
          <h2 className="mt-3 text-[clamp(1.3rem,2.6vw,1.7rem)] font-semibold tracking-[-0.025em]">Your notes, as cards, in a minute.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['upload', 'Upload notes', syllabi ? 'Photos, PDFs or text. Syllabi writes the cards.' : 'Photos and PDFs, with Syllabi (Premium).'],
              ['paste', 'Paste notes', '“Term: definition” lines become cards.'],
              ['write', 'Write one', 'A front and a back.'],
            ].map(([k, title, line]) => (
              <button key={k} onClick={() => setMaking(k)} className="elev lift rounded-[16px] border p-4 text-left" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className="mt-1 block text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                  {line}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : cards.length > 0 ? (
        /* Today */
        <section className="elev-lg mb-10 overflow-hidden rounded-[20px] border" style={{ borderColor: due.length ? 'var(--brand)' : 'var(--border-strong)', background: 'var(--surface)' }}>
          <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-center">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
                {due.length ? 'Due today' : 'All caught up'}
              </p>
              <p className="mt-2 text-[clamp(2.2rem,5vw,2.9rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
                {due.length}
                <span className="ml-2.5 text-[14px] font-medium tracking-normal" style={{ color: 'var(--text-muted)' }}>
                  of {cards.length} cards
                </span>
              </p>
              <p className="mt-2.5 max-w-sm text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {due.length ? 'Each one you get right moves a box to the right and comes back later.' : 'Nothing is due. Practising now keeps them warm without moving their schedule.'}
              </p>
              <div className="mt-5">
                {due.length ? (
                  <StudyMenu count={due.length} primary="flip" verb="Review" onStart={(mode) => onReview(due, mode !== 'flip', mode)} />
                ) : (
                  <button onClick={() => onReview(cards.slice(0, 10), true)} className="btn btn-outline control-md">
                    Practise anyway
                    <IconArrowRight width={15} height={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-[16px] p-4" style={{ background: 'var(--surface-sunken)' }}>
              <p className="mb-3 text-[11.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                Where your cards are
              </p>
              <Boxes cards={cards} />
            </div>
          </div>
        </section>
      ) : null}

      {/* Your decks */}
      {decks.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">Your decks</h2>
          <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <li key={d.subject}>
                <button onClick={() => open(d.subject)} className="elev lift flex h-full w-full flex-col rounded-[16px] border p-5 text-left" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em]">{d.subject}</span>
                    {d.due > 0 && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                        {d.due} due
                      </span>
                    )}
                  </span>
                  <span className="mt-5 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{d.cards.length}</span>
                  <span className="mt-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                    cards
                  </span>
                  <span className="mt-4 w-full">
                    <Boxes cards={d.cards} compact />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ready-made */}
      {presetsLocked ? (
        <LockedPanel title="Decks somebody already wrote" blurb="Checked cards for every subtopic of your subjects, ready to study. Making your own stays free." />
      ) : (
        offered.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Ready-made decks</h2>
              <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                Checked before anyone sees them. A card becomes yours when you first answer it.
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {offered.map((s) => {
                const expanded = openPreset === s.subject
                const all = [...s.subtopics.values()].flat()
                return (
                  <li key={s.subject} className="overflow-hidden rounded-[16px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                      <button onClick={() => setOpenPreset(expanded ? null : s.subject)} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[14px] font-semibold">{s.subject}</span>
                        <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--text-faint)' }}>
                          {s.total} cards · {s.subtopics.size} subtopic{s.subtopics.size === 1 ? '' : 's'}
                        </span>
                      </button>
                      <button onClick={() => onReview(all.slice(0, 20))} className="btn btn-outline control-sm shrink-0">
                        Study 20
                      </button>
                    </div>
                    {expanded && (
                      <ul className="border-t px-2 py-1.5" style={{ borderColor: 'var(--border)' }}>
                        {[...s.subtopics.entries()].map(([t, list]) => (
                          <li key={t} className="flex items-center gap-3 rounded-[10px] px-3 py-2 transition-colors hover:bg-[var(--surface-sunken)]">
                            <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'var(--text-body)' }}>
                              {displaySubtopic(t)}
                            </span>
                            <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                              {list.length}
                            </span>
                            <button onClick={() => onReview(list)} className="text-[12.5px] font-semibold" style={{ color: 'var(--brand)' }}>
                              Study
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      )}
    </Page>
  )
}

