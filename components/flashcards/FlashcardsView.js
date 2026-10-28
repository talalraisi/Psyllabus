'use client'

import { useMemo, useState } from 'react'
import MathText from '@/components/MathText'
import { Page, PageHeader } from '@/components/PageShell'
import { IconArrowLeft, IconFolder, IconPlus } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { levelOf, studyOrder, MAX_BOX } from '@/lib/flashcards'
import StudyMenu from '@/components/StudyMenu'
import LockedPanel from '@/components/LockedPanel'
import Select from '@/components/Select'
import CardMaker from '@/components/flashcards/CardMaker'
import { ReadyShelf, ReadySubject } from '@/components/flashcards/ReadyDecks'
import { ConfirmSheet, DotsMenu, NameSheet, PickDeckSheet, PickFolderSheet, Toast } from '@/components/flashcards/DeckDialogs'

/**
 * The flashcards page, laid out.
 *
 *   Make cards      upload notes, paste them, or write one (CardMaker)
 *   Your cards      how many, one button to study, and the boxes: every
 *                   card's place in its spacing, so a student can see the
 *                   deck moving out as they learn it
 *   Your decks      folders, the decks the student named, and a deck per
 *                   subject for cards in no deck; each can be renamed,
 *                   moved into a folder or deleted
 *   Ready-made      every subject they take; opening one lays its cards
 *                   out by topic, unit and subtopic (ReadyDecks.js)
 *
 * Opening a deck shows its cards as a grid you can filter by subtopic or
 * search, twelve at a time, each editable in place.
 */

// From never answered to known: each right answer moves a card one box along,
// and the boxes read as the four levels a card shows (levelOf).
const LEVELS = [
  { label: 'New', boxes: [0] },
  { label: 'Learning', boxes: [1, 2] },
  { label: 'Familiar', boxes: [3, 4] },
  { label: 'Known', boxes: [5] },
]
const PAGE = 12

function Boxes({ cards, compact = false }) {
  const counts = LEVELS.map((l) => cards.filter((c) => l.boxes.includes(Math.min(MAX_BOX, c.box || 0))).length)
  const max = Math.max(1, ...counts)
  if (compact) {
    return (
      <span className="flex h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }} aria-hidden="true">
        {counts.map((n, b) => (
          <span key={b} style={{ width: `${(n / Math.max(1, cards.length)) * 100}%`, background: `color-mix(in oklab, var(--brand) ${25 + b * 25}%, var(--surface-sunken))` }} />
        ))}
      </span>
    )
  }
  return (
    <div>
      <div className="flex h-24 items-end gap-1.5" role="img" aria-label={counts.map((n, b) => `${LEVELS[b].label}: ${n}`).join(', ')}>
        {counts.map((n, b) => (
          <div key={b} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: n ? 'var(--text)' : 'var(--text-faint)' }}>
              {n}
            </span>
            <span
              className="w-full rounded-[6px] transition-[height] duration-700"
              style={{ height: `${Math.max(4, (n / max) * 64)}px`, background: n ? `color-mix(in oklab, var(--brand) ${30 + b * 23}%, var(--surface-sunken))` : 'var(--border)' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {LEVELS.map((l) => (
          <span key={l.label} className="flex-1 truncate text-center text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function CardTile({ card, onEdit, onDelete, onMove }) {
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)

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
        <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-faint)' }}>
          {levelOf(card)}
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
          {onMove && (
            <button onClick={() => onMove(card)} className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
              Move
            </button>
          )}
          <button onClick={() => onDelete(card)} className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]" style={{ color: 'var(--text-faint)' }}>
            Delete
          </button>
        </span>
      </div>
    </li>
  )
}

/** One deck on the shelf: a tile that opens it, with its own menu. */
function DeckTile({ name, cards, known, inFolder, menu, onOpen }) {
  return (
    <li>
      {/* The lift is on this wrapper, not the li: the li runs the entrance
          animation, which holds its transform and would cancel a hover. */}
      <div className="lift-tile relative h-full">
      <button onClick={onOpen} className="elev flex h-full w-full flex-col rounded-[16px] border p-5 text-left" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <span className="flex items-start gap-2 pr-8">
          <span className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em]">{name}</span>
        </span>
        {inFolder && (
          <span className="mt-1 flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            <IconFolder width={11} height={11} />
            {inFolder}
          </span>
        )}
        <span className="mt-auto flex items-end justify-between gap-2 pt-5">
          <span>
            <span className="block text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{cards.length}</span>
            <span className="mt-1 block text-[12px]" style={{ color: 'var(--text-faint)' }}>
              card{cards.length === 1 ? '' : 's'}
            </span>
          </span>
          {known > 0 && (
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
              {known} known
            </span>
          )}
        </span>
        <span className="mt-4 w-full">
          <Boxes cards={cards} compact />
        </span>
      </button>
      <span className="absolute right-2.5 top-2.5">
        <DotsMenu label={`${name} options`} items={menu} />
      </span>
      </div>
    </li>
  )
}

export default function FlashcardsView({ cards, decks: named = [], folders = [], deckActions: act = {}, readyCounts = {}, presetsLocked, notes, subjects, syllabi, error, onReview, onAdd, onEdit, onDelete, loadSyllabus, onStudyReady }) {
  // The deck open: { id } for a deck the student named, { subject } for the
  // cards of a subject that sit in no deck.
  const [deck, setDeck] = useState(null)
  const [folder, setFolder] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [notice, setNotice] = useState('')
  const [subtopic, setSubtopic] = useState('')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [making, setMaking] = useState(null) // null | 'upload' | 'paste' | 'write'
  // The ready-made subject open, with its syllabus: { subject, syllabus }.
  const [ready, setReady] = useState(null)

  const known = (list) => list.filter((c) => (c.box || 0) >= MAX_BOX).length
  const say = (text) => {
    setNotice(text)
    setTimeout(() => setNotice((n) => (n === text ? '' : n)), 3500)
  }

  /* Every deck on the shelf, in one shape: the named ones, then a deck per
     subject for the cards that are in none. */
  const shelf = useMemo(() => {
    const ids = new Set(named.map((d) => d.id))
    const byDeck = new Map(named.map((d) => [d.id, []]))
    const loose = new Map()
    for (const c of cards) {
      if (c.deck_id && ids.has(c.deck_id)) byDeck.get(c.deck_id).push(c)
      else {
        if (!loose.has(c.subject)) loose.set(c.subject, [])
        loose.get(c.subject).push(c)
      }
    }
    const mine = named.map((d) => ({ key: d.id, id: d.id, name: d.name, folder_id: d.folder_id, row: d, cards: byDeck.get(d.id) }))
    const bySubject = [...loose.entries()]
      .map(([subject, list]) => ({ key: `s:${subject}`, subject, name: subject, folder_id: null, cards: list }))
      .sort((a, b) => b.cards.length - a.cards.length || a.name.localeCompare(b.name))
    return [...mine, ...bySubject]
  }, [cards, named])

  const current = deck && shelf.find((d) => (deck.id ? d.id === deck.id : !d.id && d.subject === deck.subject))
  const openFolder = folder && folders.find((f) => f.id === folder)
  const folderName = (id) => folders.find((f) => f.id === id)?.name

  const open = (d) => {
    setDeck(d.id ? { id: d.id } : { subject: d.subject })
    setSubtopic('')
    setQuery('')
    setShown(PAGE)
    window.scrollTo?.({ top: 0 })
  }

  /* A subject's loose cards become a named deck the first time the student
     renames or files them. */
  const ensureNamed = async (d, name = d.name) => {
    if (d.id) return d.row
    const made = await act.createDeck(name)
    if (!made) return null
    await act.moveCards(d.cards, made.id)
    if (deck && !deck.id && deck.subject === d.subject) setDeck({ id: made.id })
    return made
  }

  const deckMenu = (d) => [
    { label: 'Rename', onClick: () => setSheet({ kind: 'rename-deck', deck: d }) },
    { label: 'Move to a folder', onClick: () => setSheet({ kind: 'move-deck', deck: d }) },
    { label: 'Delete deck', danger: true, onClick: () => setSheet({ kind: 'delete-deck', deck: d }) },
  ]

  const sheets = sheet && (
    <>
      {sheet.kind === 'new-deck' && (
        <NameSheet
          title="New deck"
          sub={openFolder ? `In ${openFolder.name}` : 'Name it whatever you like. Add cards from your notes or from the ready-made decks.'}
          placeholder="e.g. Paper 1 definitions"
          action="Create"
          onSubmit={async (name) => {
            const d = await act.createDeck(name, openFolder?.id || null)
            if (d) open({ id: d.id })
            return !!d
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet.kind === 'new-folder' && (
        <NameSheet title="New folder" sub="Folders hold decks. Move a deck in from its ⋮ menu." placeholder="e.g. Sciences" action="Create" onSubmit={async (name) => !!(await act.createFolder(name))} onClose={() => setSheet(null)} />
      )}
      {sheet.kind === 'rename-deck' && (
        <NameSheet
          title="Rename deck"
          initial={sheet.deck.name}
          onSubmit={async (name) => (sheet.deck.id ? act.updateDeck(sheet.deck.row, { name }) : !!(await ensureNamed(sheet.deck, name)))}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet.kind === 'rename-folder' && <NameSheet title="Rename folder" initial={sheet.folder.name} onSubmit={(name) => act.renameFolder(sheet.folder, name)} onClose={() => setSheet(null)} />}
      {sheet.kind === 'move-deck' && (
        <PickFolderSheet
          deck={sheet.deck}
          folders={folders}
          onNewFolder={act.createFolder}
          onPick={async (folderId) => {
            const row = await ensureNamed(sheet.deck)
            if (row) await act.updateDeck(row, { folder_id: folderId })
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet.kind === 'delete-deck' && (
        <ConfirmSheet
          title={`Delete ${sheet.deck.name}?`}
          body={`Its ${sheet.deck.cards.length} card${sheet.deck.cards.length === 1 ? '' : 's'} go with it, and so does your progress on them. This cannot be undone.${sheet.deck.cards.some((c) => c.source === 'preset') ? ' Ready-made cards stay in the ready-made decks.' : ''}`}
          action="Delete deck"
          onConfirm={async () => {
            if (sheet.deck.id) await act.deleteDeck(sheet.deck.row)
            else await act.deleteCards(sheet.deck.cards)
            setDeck(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet.kind === 'delete-folder' && (
        <ConfirmSheet
          title={`Delete ${sheet.folder.name}?`}
          body="The folder goes. The decks in it stay, with all their cards, back on the shelf."
          action="Delete folder"
          onConfirm={async () => {
            await act.deleteFolder(sheet.folder)
            setFolder(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet.kind === 'move-card' && (
        <PickDeckSheet
          title="Move to a deck"
          sub={sheet.card.front.slice(0, 90)}
          decks={named}
          folders={folders}
          exclude={sheet.card.deck_id}
          onPick={async (target) => {
            const to = target.id ? { id: target.id } : await act.createDeck(target.name)
            if (!to) return false
            const ok = await act.moveCards([sheet.card], to.id)
            if (ok) say(`Moved to ${named.find((d) => d.id === to.id)?.name || target.name}`)
            return ok
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet.kind === 'add-ready' && (
        <PickDeckSheet
          title="Add to a deck"
          sub={`${sheet.label} · ${sheet.count.toLocaleString()} card${sheet.count === 1 ? '' : 's'}`}
          decks={named}
          folders={folders}
          suggest={sheet.label}
          onPick={async (target) => {
            const d = await act.addReadyToDeck(sheet.subject, sheet.subtopics, target)
            if (d) say(`Added to ${d.name}`)
            return !!d
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )

  const toast = notice && <Toast>{notice}</Toast>

  const maker = making && (
    <div className="mb-8">
      <CardMaker
        key={making}
        subjects={subjects}
        savedNotes={notes}
        syllabi={syllabi}
        initialTab={making}
        initialSubject={current?.subject || current?.cards[0]?.subject || null}
        onSave={async (list) => {
          const ok = await onAdd(current?.id ? list.map((c) => ({ ...c, deck_id: current.id })) : list)
          if (ok) setMaking(null)
          return ok
        }}
        onClose={() => setMaking(null)}
      />
    </div>
  )

  /* ------------------------------------------------------ a ready-made deck */
  if (ready) {
    return (
      <Page width="default">
        <ReadySubject
          subject={ready.subject}
          counts={readyCounts[ready.subject]}
          syllabus={ready.syllabus}
          mine={cards}
          onBack={() => setReady(null)}
          onStudy={onStudyReady}
          onAddToDeck={act.addReadyToDeck ? (subjectName, subtopics, label, count) => setSheet({ kind: 'add-ready', subject: subjectName, subtopics, label, count }) : null}
        />
        {sheets}
        {toast}
      </Page>
    )
  }

  const openReady = async (subject) => {
    const syllabus = await loadSyllabus(subject)
    setReady({ subject, syllabus })
    window.scrollTo?.({ top: 0 })
  }

  /* ---------------------------------------------------------------- a deck */
  if (current) {
    const all = current.cards
    const subs = [...new Set(all.map((c) => c.subtopic || ''))].sort()
    const q = query.trim().toLowerCase()
    const list = all.filter((c) => (!subtopic || (c.subtopic || '') === subtopic) && (!q || `${c.front} ${c.back}`.toLowerCase().includes(q)))
    const where = current.folder_id && folderName(current.folder_id)
    return (
      <Page width="default">
        <button
          onClick={() => {
            setDeck(null)
            setFolder(where ? current.folder_id : null)
          }}
          className="mb-4 flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: 'var(--brand)' }}
        >
          <IconArrowLeft width={14} height={14} />
          {where || 'All decks'}
        </button>
        <PageHeader
          title={current.name}
          subtitle={`${all.length} card${all.length === 1 ? '' : 's'} · ${known(all)} known`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setMaking(making ? null : syllabi ? 'upload' : 'paste')} className="btn btn-outline control-md">
                <IconPlus width={15} height={15} />
                Add cards
              </button>
              {list.length > 0 && (
                <StudyMenu
                  count={list.length}
                  primary="flip"
                  verb="Study"
                  compact
                  onStart={(mode) => onReview(studyOrder(list), mode)}
                />
              )}
              {act.createDeck && <DotsMenu label="Deck options" items={deckMenu(current)} />}
            </div>
          }
        />
        {maker}

        {all.length > 0 && (
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
        )}

        {list.length === 0 ? (
          <div className="rounded-[16px] border border-dashed px-6 py-10 text-center text-[13.5px]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
            {all.length ? (
              'No cards match that.'
            ) : (
              <>
                <p>No cards in this deck yet.</p>
                <p className="mt-1.5 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  Add your own with Add cards, or open a ready-made subject and add a topic to this deck.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <ul className="stagger grid gap-3 sm:grid-cols-2">
              {list.slice(0, shown).map((c) => (
                <CardTile key={c.id} card={c} onEdit={onEdit} onDelete={onDelete} onMove={act.moveCards ? (card) => setSheet({ kind: 'move-card', card }) : null} />
              ))}
            </ul>
            {list.length > shown && (
              <button onClick={() => setShown((n) => n + PAGE)} className="btn btn-outline control-md mx-auto mt-5 flex">
                Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
              </button>
            )}
          </>
        )}
        {sheets}
        {toast}
      </Page>
    )
  }

  /* ------------------------------------------------------------- the shelf */
  const looseDecks = shelf.filter((d) => (openFolder ? d.folder_id === openFolder.id : !d.folder_id || !folderName(d.folder_id)))
  const hasShelf = shelf.length > 0 || folders.length > 0
  return (
    <Page width="default">
      <PageHeader
        title="Flashcards"
        subtitle="Your own cards, from your notes or written yourself. Study them whenever you like."
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

      {cards.length === 0 && !hasShelf && !making ? (
        /* First time: three ways in. */
        <section className="mb-10 rounded-[20px] border p-6 sm:p-8" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
            Start a deck
          </p>
          <h2 className="mt-3 text-[clamp(1.3rem,2.6vw,1.7rem)] font-semibold tracking-[-0.025em]">Your notes, as cards, in a minute.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {[
              ['upload', 'Upload notes', syllabi ? 'Photos, PDFs or text. Syllabi writes the cards.' : 'Photos and PDFs, with Syllabi (Premium).'],
              ['paste', 'Paste notes', '“Term: definition” lines become cards.'],
              ['write', 'Write one', 'A front and a back.'],
              ...(act.createDeck ? [['deck', 'Name a deck', 'Then fill it, from your notes or the ready-made decks.']] : []),
            ].map(([k, title, line]) => (
              <button key={k} onClick={() => (k === 'deck' ? setSheet({ kind: 'new-deck' }) : setMaking(k))} className="elev lift rounded-[16px] border p-4 text-left" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                <span className="block text-[14px] font-semibold">{title}</span>
                <span className="mt-1 block text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                  {line}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : cards.length > 0 ? (
        /* Your cards */
        <section className="elev-lg mb-10 overflow-hidden rounded-[20px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-center">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
                Your cards
              </p>
              <p className="mt-2 text-[clamp(2.2rem,5vw,2.9rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
                {cards.length}
                <span className="ml-2.5 text-[14px] font-medium tracking-normal" style={{ color: 'var(--text-muted)' }}>
                  {known(cards)} known
                </span>
              </p>
              <p className="mt-2.5 max-w-sm text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Study whenever you like. The ones you know least come first, and every right answer moves a card one step towards known.
              </p>
              <div className="mt-5">
                <StudyMenu count={cards.length} primary="flip" verb="Study" onStart={(mode) => onReview(studyOrder(cards), mode)} />
              </div>
            </div>
            <div className="rounded-[16px] p-4" style={{ background: 'var(--surface-sunken)' }}>
              <p className="mb-3 text-[11.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                How well you know them
              </p>
              <Boxes cards={cards} />
            </div>
          </div>
        </section>
      ) : null}

      {/* Your decks */}
      {hasShelf && (
        <section className="mb-12">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {openFolder ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <button onClick={() => setFolder(null)} className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--text-muted)' }}>
                  Your decks
                </button>
                <span style={{ color: 'var(--text-faint)' }}>/</span>
                <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{openFolder.name}</h2>
                <DotsMenu
                  label="Folder options"
                  items={[
                    { label: 'Rename', onClick: () => setSheet({ kind: 'rename-folder', folder: openFolder }) },
                    { label: 'Delete folder', danger: true, onClick: () => setSheet({ kind: 'delete-folder', folder: openFolder }) },
                  ]}
                />
              </div>
            ) : (
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Your decks</h2>
            )}
            {act.createDeck && (
              <div className="flex items-center gap-1">
                {!openFolder && (
                  <button onClick={() => setSheet({ kind: 'new-folder' })} className="btn btn-quiet control-sm">
                    <IconFolder width={14} height={14} />
                    New folder
                  </button>
                )}
                <button onClick={() => setSheet({ kind: 'new-deck' })} className="btn btn-quiet control-sm">
                  <IconPlus width={14} height={14} />
                  New deck
                </button>
              </div>
            )}
          </div>
          <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {!openFolder &&
              folders.map((f) => {
                const inside = shelf.filter((d) => d.folder_id === f.id)
                const n = inside.reduce((a, d) => a + d.cards.length, 0)
                return (
                  <li key={f.id}>
                    <div className="lift-tile relative h-full">
                    <button onClick={() => setFolder(f.id)} className="flex h-full w-full flex-col rounded-[16px] border p-5 text-left" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }}>
                      <IconFolder width={22} height={22} style={{ color: 'var(--brand)' }} />
                      <span className="mt-3 pr-8 text-[14.5px] font-semibold leading-snug tracking-[-0.01em]">{f.name}</span>
                      <span className="mt-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                        {inside.length} deck{inside.length === 1 ? '' : 's'} · {n} card{n === 1 ? '' : 's'}
                      </span>
                    </button>
                    <span className="absolute right-2.5 top-2.5">
                      <DotsMenu
                        label={`${f.name} options`}
                        items={[
                          { label: 'Rename', onClick: () => setSheet({ kind: 'rename-folder', folder: f }) },
                          { label: 'Delete folder', danger: true, onClick: () => setSheet({ kind: 'delete-folder', folder: f }) },
                        ]}
                      />
                    </span>
                    </div>
                  </li>
                )
              })}
            {looseDecks.map((d) => (
              <DeckTile key={d.key} name={d.name} cards={d.cards} known={known(d.cards)} menu={act.createDeck ? deckMenu(d) : []} onOpen={() => open(d)} />
            ))}
          </ul>
          {openFolder && looseDecks.length === 0 && (
            <p className="rounded-[16px] border border-dashed px-6 py-8 text-center text-[13px]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
              Nothing in this folder yet. Make a deck here, or move one in from its ⋮ menu.
            </p>
          )}
        </section>
      )}

      {/* Ready-made */}
      {presetsLocked ? (
        <LockedPanel title="Decks somebody already wrote" blurb="Checked cards for every subtopic of your subjects, ready to study. Making your own stays free." />
      ) : (
        subjects.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Ready-made decks</h2>
              <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                Every subtopic of your subjects, checked before anyone sees it. Open a subject to pick what to study.
              </span>
            </div>
            <ReadyShelf subjects={subjects} counts={readyCounts} mine={cards} onOpen={openReady} />
          </section>
        )
      )}
      {sheets}
      {toast}
    </Page>
  )
}

