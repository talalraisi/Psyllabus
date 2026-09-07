'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading, EmptyState } from '@/components/PageShell'
import { IconClose, IconArrowRight, IconArrowLeft, IconCards } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { accessibleSubjects } from '@/lib/access'
import { scheduleAfter, isDue, dueLabel } from '@/lib/flashcards'
import FlashcardReview from '@/components/FlashcardReview'
import NoteImport from '@/components/NoteImport'

/**
 * Flashcards.
 *
 * Cards are self-marked, so they never award mastery points. That is the line
 * the rest of the product is built on and it holds here: a card you told the
 * app you got right is not evidence, and letting it colour the heatmap would
 * undo the one thing that makes the heatmap worth looking at.
 *
 * The page is a shelf of decks, and opening one replaces the shelf rather than
 * unfolding underneath it. Revision is a one-thing-at-a-time activity: the
 * night before a biology test you want biology enzymes on the screen, not every
 * card you have ever written with biology somewhere in the middle.
 */
export default function FlashcardsPage() {
  const [profile, setProfile] = useState(null)
  const [cards, setCards] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(null)
  const [error, setError] = useState('')

  // null = the shelf. A subject = that deck, opened.
  const [openDeck, setOpenDeck] = useState(null)
  const [openSubtopic, setOpenSubtopic] = useState(null)

  const [adding, setAdding] = useState('') // '' | 'write' | 'notes'
  const [draft, setDraft] = useState({ subject: '', subtopic: '', front: '', back: '' })
  const [saving, setSaving] = useState(false)
  const [proposed, setProposed] = useState(null)
  const [sessionStats, setSessionStats] = useState({ right: 0, wrong: 0 })

  const router = useRouter()
  const supabase = createClient()

  const load = useCallback(async () => {
    const user = await getCurrentUser(supabase)
    if (!user) {
      router.push('/login')
      return
    }
    const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })
    if (!profileData) {
      router.push('/onboarding')
      return
    }
    setProfile(profileData)
    setDraft((d) => ({ ...d, subject: d.subject || accessibleSubjects(profileData)[0] || '' }))

    const [{ data: cardRows }, { data: noteRows }] = await Promise.all([
      supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .order('due_at', { ascending: true }),
      supabase
        .from('notes')
        .select('id, subject, subtopic, body')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
    ])

    setCards(cardRows || [])
    setNotes((noteRows || []).filter((n) => (n.body || '').trim().length > 20))
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    load()
  }, [load])

  /* ------------------------------------------------------------------ decks */

  const decks = useMemo(() => {
    const map = new Map()
    for (const c of cards) {
      if (!map.has(c.subject)) map.set(c.subject, { subject: c.subject, total: 0, due: 0 })
      const deck = map.get(c.subject)
      deck.total++
      if (isDue(c)) deck.due++
    }
    return [...map.values()].sort((a, b) => b.due - a.due || a.subject.localeCompare(b.subject))
  }, [cards])

  const subtopics = useMemo(() => {
    if (!openDeck) return []
    const map = new Map()
    for (const c of cards) {
      if (c.subject !== openDeck) continue
      const key = c.subtopic || ''
      if (!map.has(key)) map.set(key, { subtopic: key, total: 0, due: 0 })
      const group = map.get(key)
      group.total++
      if (isDue(c)) group.due++
    }
    return [...map.values()].sort((a, b) => a.subtopic.localeCompare(b.subtopic))
  }, [cards, openDeck])

  const inScope = useMemo(
    () =>
      cards.filter(
        (c) =>
          (!openDeck || c.subject === openDeck) &&
          (openSubtopic === null || (c.subtopic || '') === openSubtopic)
      ),
    [cards, openDeck, openSubtopic]
  )

  const dueInScope = useMemo(() => inScope.filter(isDue), [inScope])
  const totalDue = useMemo(() => cards.filter(isDue).length, [cards])

  /* ----------------------------------------------------------------- review */

  const review = (pool, cramming = false) => {
    if (!pool.length) return
    setSessionStats({ right: 0, wrong: 0 })
    setReviewing({ cards: [...pool].sort(() => Math.random() - 0.5), cramming })
  }

  const markCard = async (card, correct) => {
    setSessionStats((s) => ({
      ...s,
      [correct ? 'right' : 'wrong']: s[correct ? 'right' : 'wrong'] + 1,
    }))
    // Cramming a card that is not due should not drag its real schedule
    // around: the night before a test is not new evidence about next month.
    if (reviewing?.cramming && !isDue(card)) return

    const patch = scheduleAfter(card, correct)
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))
    await supabase.from('flashcards').update(patch).eq('id', card.id)
  }

  /* ------------------------------------------------------------------ cards */

  const saveCard = async (e) => {
    e?.preventDefault()
    if (saving || !draft.front.trim() || !draft.back.trim() || !draft.subject) return
    setSaving(true)
    const user = await getCurrentUser(supabase)
    if (!user) return

    const { data, error: err } = await supabase
      .from('flashcards')
      .insert({
        user_id: user.id,
        subject: draft.subject,
        subtopic: draft.subtopic || null,
        front: draft.front.trim(),
        back: draft.back.trim(),
        source: 'manual',
      })
      .select()
      .single()

    setSaving(false)
    if (err) return setError(err.message)
    setCards((prev) => [data, ...prev])
    setDraft((d) => ({ ...d, front: '', back: '' }))
  }

  const deleteCard = async (card) => {
    setCards((prev) => prev.filter((c) => c.id !== card.id))
    const { error: err } = await supabase.from('flashcards').delete().eq('id', card.id)
    // Put it back rather than pretending it went: a card that reappears on
    // refresh is worse than one that never left.
    if (err) {
      setError('Could not delete that card.')
      setCards((prev) => [card, ...prev])
    }
  }

  const acceptProposed = async () => {
    if (!proposed?.length) return
    setSaving(true)
    const user = await getCurrentUser(supabase)
    if (!user) return

    const { data, error: err } = await supabase
      .from('flashcards')
      .insert(proposed.map((c) => ({ ...c, user_id: user.id })))
      .select()

    setSaving(false)
    if (err) return setError(err.message)
    setCards((prev) => [...(data || []), ...prev])
    setProposed(null)
    setAdding('')
  }

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Flashcards" width="default" rows={4} />
      </DashboardLayout>
    )
  }

  if (reviewing) {
    return (
      <DashboardLayout profile={profile}>
        <FlashcardReview
          cards={reviewing.cards}
          stats={sessionStats}
          onMark={markCard}
          onExit={() => setReviewing(null)}
        />
      </DashboardLayout>
    )
  }

  const subjects = accessibleSubjects(profile)

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        {openDeck ? (
          /* ------------------------------------------------------ one deck */
          <>
            <button
              onClick={() => {
                setOpenDeck(null)
                setOpenSubtopic(null)
              }}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
            >
              <IconArrowLeft width={14} height={14} />
              All decks
            </button>

            <PageHeader
              title={openDeck}
              subtitle={`${inScope.length} card${inScope.length === 1 ? '' : 's'}${
                dueInScope.length ? ` · ${dueInScope.length} due now` : ' · nothing due yet'
              }`}
              action={
                dueInScope.length > 0 ? (
                  <button onClick={() => review(dueInScope)} className="btn btn-solid control-md">
                    Review {dueInScope.length}
                    <IconArrowRight width={16} height={16} />
                  </button>
                ) : inScope.length > 0 ? (
                  <button onClick={() => review(inScope, true)} className="btn btn-outline control-md">
                    Practise all {inScope.length}
                  </button>
                ) : null
              }
            />

            {subtopics.length > 1 && (
              <div className="mb-6 flex flex-wrap gap-2">
                <Chip
                  label="All"
                  count={decks.find((d) => d.subject === openDeck)?.total ?? 0}
                  due={decks.find((d) => d.subject === openDeck)?.due ?? 0}
                  active={openSubtopic === null}
                  onClick={() => setOpenSubtopic(null)}
                />
                {subtopics.map((s) => (
                  <Chip
                    key={s.subtopic || 'none'}
                    label={s.subtopic ? displaySubtopic(s.subtopic) : 'No subtopic'}
                    count={s.total}
                    due={s.due}
                    active={openSubtopic === s.subtopic}
                    onClick={() => setOpenSubtopic(s.subtopic)}
                  />
                ))}
              </div>
            )}

            {dueInScope.length > 0 && inScope.length > dueInScope.length && (
              <button
                onClick={() => review(inScope, true)}
                className="btn btn-quiet control-sm mb-4 text-xs"
                title="Go through every card here. Cards that are not due keep their schedule."
              >
                Practise all {inScope.length} instead
              </button>
            )}

            <ul className="surface">
              {inScope.map((c, i) => (
                <li key={c.id} className={i > 0 ? 'border-t border-[var(--border)]' : undefined}>
                  <div className="flex items-start gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text)]">{c.front}</p>
                      <p className="t-small mt-1 line-clamp-2">{c.back}</p>
                      <p className="t-caption mt-2">
                        {c.subtopic ? `${displaySubtopic(c.subtopic)} · ` : ''}
                        <span className={isDue(c) ? 'text-[var(--brand)]' : ''}>{dueLabel(c)}</span>
                        {c.source === 'note' ? ' · from your notes' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteCard(c)}
                      aria-label={`Delete card: ${c.front}`}
                      title="Delete this card"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                    >
                      <IconClose width={16} height={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          /* --------------------------------------------------------- shelf */
          <>
            <PageHeader
              title="Flashcards"
              subtitle="Write your own or make them from your notes. Nothing here needs the question bank."
              action={
                totalDue > 0 ? (
                  <button
                    onClick={() => review(cards.filter(isDue))}
                    className="btn btn-solid control-md"
                  >
                    Review {totalDue} due
                    <IconArrowRight width={16} height={16} />
                  </button>
                ) : null
              }
            />

            {error && (
              <div className="mb-6 rounded-[var(--r-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3">
                <p className="text-sm text-[var(--danger)]">{error}</p>
              </div>
            )}

            {cards.length === 0 ? (
              <EmptyState
                title="No cards yet"
                description="Write one, or turn notes you have already made into a set. Both take a minute."
              />
            ) : (
              <div className="mb-10 grid gap-3 sm:grid-cols-2">
                {decks.map((d) => (
                  <button
                    key={d.subject}
                    onClick={() => {
                      setOpenDeck(d.subject)
                      setOpenSubtopic(null)
                    }}
                    className="surface surface-interactive flex flex-col justify-between gap-4 p-5 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[var(--text)]">{d.subject}</h3>
                      <span className="text-[var(--text-faint)]">
                        <IconCards width={18} height={18} />
                      </span>
                    </div>
                    <div>
                      <p className="t-stat text-[var(--text)]">{d.total}</p>
                      <p className="t-caption mt-0.5">
                        {d.due > 0 ? (
                          <span className="font-medium text-[var(--brand)]">{d.due} due now</span>
                        ) : (
                          'nothing due'
                        )}
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                        <div
                          className="h-full rounded-full bg-[var(--brand)]"
                          style={{ width: `${d.total ? (d.due / d.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ----------------------------------------------------- adding */}

            <div className="surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--text)]">Add cards</h2>
                  <p className="t-caption mt-0.5">
                    Write them one at a time, or turn a page of notes into a set.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAdding(adding === 'write' ? '' : 'write')}
                    className={`btn control-md ${adding === 'write' ? 'btn-solid' : 'btn-outline'}`}
                  >
                    Write one
                  </button>
                  <button
                    onClick={() => setAdding(adding === 'notes' ? '' : 'notes')}
                    className={`btn control-md ${adding === 'notes' ? 'btn-solid' : 'btn-outline'}`}
                  >
                    From notes
                  </button>
                </div>
              </div>

              {adding === 'write' && (
                <form onSubmit={saveCard} className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
                  <label>
                    <span className="t-overline">Subject</span>
                    <select
                      value={draft.subject}
                      onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                      className="input mt-1"
                    >
                      {subjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="t-overline">Subtopic (optional)</span>
                    <input
                      value={draft.subtopic}
                      onChange={(e) => setDraft({ ...draft, subtopic: e.target.value })}
                      placeholder="Enzymes"
                      className="input mt-1"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="t-overline">Front</span>
                    <textarea
                      rows={2}
                      value={draft.front}
                      onChange={(e) => setDraft({ ...draft, front: e.target.value })}
                      placeholder="What does a competitive inhibitor do?"
                      className="input mt-1"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="t-overline">Back</span>
                    <textarea
                      rows={3}
                      value={draft.back}
                      onChange={(e) => setDraft({ ...draft, back: e.target.value })}
                      placeholder="Binds the active site and blocks the substrate."
                      className="input mt-1"
                    />
                  </label>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={saving || !draft.front.trim() || !draft.back.trim()}
                      className="btn btn-solid control-md"
                    >
                      {saving ? 'Saving…' : 'Add card'}
                    </button>
                  </div>
                </form>
              )}

              {adding === 'notes' && (
                <div className="mt-5 border-t border-[var(--border)] pt-5">
                  <NoteImport
                    subject={draft.subject}
                    subjects={subjects}
                    savedNotes={notes}
                    onCards={setProposed}
                  />
                  {notes.length === 0 && (
                    <p className="t-caption mt-3">
                      You have not written any notes in the app yet. Every subtopic has a notes box
                      inside it.{' '}
                      <Link href="/dashboard/subjects" className="text-[var(--brand)] hover:underline">
                        Open a subject
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Approval. Whatever made the cards, they are checked the same way
                before anything is written. */}
            {proposed?.length > 0 && (
              <div className="surface mt-3 p-5">
                <p className="t-small mb-3">
                  {proposed.length} card{proposed.length === 1 ? '' : 's'} found. Check them before
                  adding.
                </p>
                <ul className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
                  {proposed.map((c, i) => (
                    <li key={i} className="rounded-[var(--r-md)] border border-[var(--border-strong)] p-3">
                      <p className="text-sm font-medium text-[var(--text)]">{c.front}</p>
                      <p className="t-small mt-1">{c.back}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button onClick={() => setProposed(null)} className="btn btn-quiet control-md">
                    Discard
                  </button>
                  <button onClick={acceptProposed} disabled={saving} className="btn btn-solid control-md">
                    {saving ? 'Adding…' : `Add ${proposed.length}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Page>
    </DashboardLayout>
  )
}

/** A subtopic filter inside an open deck. */
function Chip({ label, count, due, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 ${
        active
          ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
          : 'border-[var(--border)] text-[var(--text-body)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="text-[var(--text-faint)]">{count}</span>
      {due > 0 && (
        <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {due}
        </span>
      )}
    </button>
  )
}
