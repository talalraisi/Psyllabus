'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import MathText from '@/components/MathText'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading, EmptyState } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconClose, IconArrowRight, IconArrowLeft, IconCards } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { accessibleSubjects, canUse } from '@/lib/access'
import { scheduleAfter, isDue, dueLabel } from '@/lib/flashcards'
import FlashcardReview from '@/components/FlashcardReview'
import FlashcardWrite from '@/components/FlashcardWrite'
import FlashcardTest from '@/components/FlashcardTest'
import NoteImport from '@/components/NoteImport'
import LockedPanel from '@/components/LockedPanel'

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

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight. A page that has arrived but has no data yet is the
  // part that feels broken.
  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])
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
  // Ready-made decks available for the subjects this student takes, and which
  // of them they have already taken a copy of.
  const [presets, setPresets] = useState([])
  const [openPresetSubject, setOpenPresetSubject] = useState(null)

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

    const usable = accessibleSubjects(profileData)

    const [{ data: cardRows }, { data: noteRows }, { data: presetRows }] = await Promise.all([
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
      // Only the verified ones are readable at all, so this needs no filter of
      // its own beyond the subjects they actually take.
      usable.length
        ? supabase
            .from('flashcard_presets')
            .select('id, subject, topic, subtopic, front, back')
            .eq('verified', true)
            .in('subject', usable)
        : Promise.resolve({ data: [] }),
    ])

    setPresets(presetRows || [])
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

  /**
   * Ready-made decks the student has not taken yet.
   *
   * "Not taken" is by front text rather than by a flag, because that is what
   * start_preset_deck() skips on. A deck that has gained cards since you
   * started it shows the number still missing rather than disappearing, so a
   * top-up is one press and never a duplicate.
   */
  const availablePresets = useMemo(() => {
    const mine = new Set(cards.map((c) => `${c.subject}||${c.front}`))
    const bySubtopic = new Map()
    for (const p of presets) {
      const key = `${p.subject}||${p.subtopic}`
      const entry =
        bySubtopic.get(key) ||
        { subject: p.subject, topic: p.topic, subtopic: p.subtopic, total: 0, cards: [] }
      entry.total++
      // Marked so the reviewer knows this card is not the student's yet.
      entry.cards.push({ ...p, preset: true, box: 1, reviews: 0 })
      if (mine.has(`${p.subject}||${p.front}`)) entry.cards.pop()
      bySubtopic.set(key, entry)
    }
    // How many of each deck are already in their own cards.
    const held = new Map()
    for (const c of cards) {
      const key = `${c.subject}||${c.subtopic}`
      held.set(key, (held.get(key) || 0) + 1)
    }
    return [...bySubtopic.values()]
      .map((d) => ({ ...d, have: held.get(`${d.subject}||${d.subtopic}`) || 0 }))
      .filter((d) => d.have < d.total)
      .filter((d) => !openDeck || d.subject === openDeck)
      .sort((a, b) => a.subject.localeCompare(b.subject) || a.subtopic.localeCompare(b.subtopic))
  }, [presets, cards, openDeck])

  /**
   * Ready-made decks, gathered under their subject.
   *
   * Offered one subtopic at a time, a science was thirty separate decisions
   * and nobody made thirty. Under a subject heading it is one: take biology,
   * or take the enzymes deck out of it.
   */
  const presetsBySubject = useMemo(() => {
    const map = new Map()
    for (const deck of availablePresets) {
      if (!map.has(deck.subject)) map.set(deck.subject, { subject: deck.subject, decks: [], cards: 0 })
      const entry = map.get(deck.subject)
      entry.decks.push(deck)
      entry.cards += deck.total - deck.have
    }
    return [...map.values()].sort((a, b) => b.cards - a.cards)
  }, [availablePresets])

  const totalDue = useMemo(() => cards.filter(isDue).length, [cards])

  /* ----------------------------------------------------------------- review */

  /**
   * Start a session in one of the modes.
   *
   * Flip is the old behaviour and stays the default: it is the right thing
   * for a card you have never seen. Write and blank are for a deck you think
   * you know, which is where flipping stops telling you anything true.
   */
  const review = (pool, cramming = false, mode = 'flip') => {
    if (!pool.length) return
    setSessionStats({ right: 0, wrong: 0 })
    setReviewing({ cards: [...pool].sort(() => Math.random() - 0.5), cramming, mode })
  }

  const markCard = async (card, correct) => {
    setSessionStats((s) => ({
      ...s,
      [correct ? 'right' : 'wrong']: s[correct ? 'right' : 'wrong'] + 1,
    }))

    /**
     * A ready-made card becomes yours the moment you answer it.
     *
     * Asking somebody to "add" a deck before studying it is a decision about
     * a deck they have not seen. So the decks are simply offered, and the
     * first time a card is reviewed it is copied into their own — which is
     * what makes the schedule theirs to keep.
     */
    if (card.preset) {
      const user = await getCurrentUser(supabase)
      if (!user) return
      const patch = scheduleAfter({ box: 1, reviews: 0 }, correct)
      const { data } = await supabase
        .from('flashcards')
        .insert({
          user_id: user.id,
          subject: card.subject,
          topic: card.topic || null,
          subtopic: card.subtopic || null,
          front: card.front,
          back: card.back,
          source: 'preset',
          ...patch,
        })
        .select()
        .single()
      if (data) setCards((prev) => [data, ...prev])
      return
    }

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
        <PageLoading title="Flashcards" width="default" rows={4} variant="cards" />
      </DashboardLayout>
    )
  }

  if (reviewing) {
    return (
      <DashboardLayout profile={profile}>
        {reviewing.mode === 'flip' ? (
          <FlashcardReview
            cards={reviewing.cards}
            stats={sessionStats}
            onMark={markCard}
            onExit={() => setReviewing(null)}
          />
        ) : reviewing.mode === 'test' ? (
          <FlashcardTest
            cards={reviewing.cards}
            onMark={markCard}
            onExit={() => setReviewing(null)}
          />
        ) : (
          <FlashcardWrite
            cards={reviewing.cards}
            mode={reviewing.mode}
            onMark={markCard}
            onExit={() => setReviewing(null)}
          />
        )}
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
                inScope.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {dueInScope.length > 0 ? (
                      <button onClick={() => review(dueInScope)} className="btn btn-solid control-md">
                        Review {dueInScope.length}
                        <IconArrowRight width={16} height={16} />
                      </button>
                    ) : (
                      <button onClick={() => review(inScope, true)} className="btn btn-outline control-md">
                        Flip through {inScope.length}
                      </button>
                    )}
                    {/* The two modes that ask for recall rather than
                        recognition. Named for what they make you do. */}
                    <button
                      onClick={() => review(dueInScope.length ? dueInScope : inScope, !dueInScope.length, 'write')}
                      className="btn btn-outline control-md"
                    >
                      Write it
                    </button>
                    <button
                      onClick={() => review(dueInScope.length ? dueInScope : inScope, !dueInScope.length, 'blank')}
                      className="btn btn-outline control-md"
                    >
                      Fill the blank
                    </button>
                    {inScope.length >= 4 && (
                      <button
                        onClick={() => review(inScope, true, 'test')}
                        className="btn btn-outline control-md"
                      >
                        Test me
                      </button>
                    )}
                  </div>
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

            <ul className="flex flex-col">
              {inScope.map((c, i) => (
                <li
                  key={c.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start gap-4 px-1 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium"><MathText>{c.front}</MathText></p>
                      <p className="mt-1 line-clamp-2 text-[13.5px]" style={{ color: 'var(--text-muted)' }}><MathText>{c.back}</MathText></p>
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
              subtitle="Take a ready-made deck, write your own, or make them from your notes."
              action={
                totalDue > 0 ? (
                  <button
                    onClick={() => review(cards.filter(isDue))}
                    className="btn btn-solid control-md"
                  >
                    Review {totalDue} due
                    <IconArrowRight width={16} height={16} />
                  </button>
                ) : cards.length > 0 ? (
                  // Nothing due is not nothing to do. Ten cards, ahead of
                  // schedule, marked as cramming so it does not disturb the
                  // spacing that is doing the real work.
                  <button
                    onClick={() => review(cards.slice(0, 10), true)}
                    className="btn btn-outline control-md"
                  >
                    Quick 10
                    <IconArrowRight width={16} height={16} />
                  </button>
                ) : null
              }
            />

            {error && (
              <div className="mb-6 border-l-2 pl-4" style={{ borderColor: 'var(--danger)' }}>
                <p className="text-sm text-[var(--danger)]">{error}</p>
              </div>
            )}

            {cards.length === 0 ? (
              presetsBySubject.length === 0 ? (
                <EmptyState
                  title="No cards yet"
                  description="Write one, or turn notes you have already made into a set. Both take a minute."
                />
              ) : null
            ) : (
              <div className="mb-10 grid gap-3 sm:grid-cols-2">
                {decks.map((d) => (
                  <button
                    key={d.subject}
                    onClick={() => {
                      setOpenDeck(d.subject)
                      setOpenSubtopic(null)
                    }}
                    className="elev lift flex flex-col justify-between gap-5 rounded-[12px] border p-5 text-left"
                    style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[15px] font-semibold tracking-[-0.015em]">{d.subject}</h3>
                      <span style={{ color: 'var(--text-faint)' }}>
                        <IconCards width={17} height={17} />
                      </span>
                    </div>
                    <div>
                      <p className="text-[26px] font-semibold leading-none tracking-[-0.028em] tabular-nums">
                        {d.total}
                      </p>
                      <p className="mt-2 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                        {d.due > 0 ? (
                          <span className="font-medium" style={{ color: 'var(--brand)' }}>
                            {d.due} due now
                          </span>
                        ) : (
                          'nothing due'
                        )}
                      </p>
                      <div
                        className="mt-4 h-1 overflow-hidden rounded-full"
                        style={{ background: 'var(--border-strong)' }}
                      >
                        <div
                          className="bar-fill h-full rounded-full"
                          style={{
                            width: `${d.total ? (d.due / d.total) * 100 : 0}%`,
                            background: 'var(--brand)',
                          }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Decks somebody already wrote.
                Writing your own cards is the better way to learn and also the
                one nobody does at eleven at night. A ready-made deck per
                subtopic is the version that actually gets used, and taking one
                copies it into your own cards so the scheduling is yours. */}
            {!canUse('presetDecks', profile) && (
              <div className="mb-10">
                <LockedPanel
                  title="Decks somebody already wrote"
                  blurb="Checked cards for every subtopic of your subjects, ready to study. Writing your own stays free."
                />
              </div>
            )}

            {canUse('presetDecks', profile) && availablePresets.length > 0 && (
              <div className="mb-10 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-[-0.012em]">Decks on offer</h2>
                  <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                    {availablePresets.length} available
                  </span>
                </div>
                <p className="mb-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  Checked before anybody sees them. Study one now — a card becomes yours, with its
                  own schedule, the first time you answer it.
                </p>

                <ul className="stagger flex flex-col">
                  {presetsBySubject.map((group) => {
                    const expanded = openPresetSubject === group.subject
                    return (
                      <li
                        key={group.subject}
                        className="border-b py-3 last:border-b-0"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() =>
                              setOpenPresetSubject(expanded ? null : group.subject)
                            }
                            aria-expanded={expanded}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-[14px]" style={{ color: 'var(--text-body)' }}>
                              {group.subject}
                            </p>
                            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
                              {group.cards} cards across {group.decks.length}{' '}
                              {group.decks.length === 1 ? 'subtopic' : 'subtopics'}
                            </p>
                          </button>
                          <button
                            onClick={() =>
                              review(
                                group.decks.flatMap((d) => d.cards).slice(0, 20),
                                false
                              )
                            }
                            className="btn btn-outline control-sm shrink-0"
                          >
                            Study
                          </button>
                        </div>

                        {expanded && (
                          <ul className="mt-2 flex flex-col pl-1">
                            {group.decks.map((deck) => {
                              const key = `${deck.subject}||${deck.subtopic}`
                              const missing = deck.total - deck.have
                              const partial = deck.have > 0
                              return (
                                <li key={key} className="flex items-center gap-3 py-1.5">
                                  <span
                                    className="min-w-0 flex-1 truncate text-[13px]"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    {displaySubtopic(deck.subtopic)}
                                  </span>
                                  <span
                                    className="shrink-0 text-[12px] tabular-nums"
                                    style={{ color: 'var(--text-faint)' }}
                                  >
                                    {partial ? `${missing} new` : deck.total}
                                  </span>
                                  <button
                                    onClick={() => review(deck.cards, false)}
                                    disabled={!deck.cards.length}
                                    className="shrink-0 text-[12.5px] font-medium underline-offset-2 hover:underline disabled:opacity-40"
                                    style={{ color: 'var(--brand)' }}
                                  >
                                    Study
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* ----------------------------------------------------- adding */}

            <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold tracking-[-0.012em]">Add cards</h2>
                  <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
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
              <div className="mt-6 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                <p className="t-small mb-3">
                  {proposed.length} card{proposed.length === 1 ? '' : 's'} found. Check them before
                  adding.
                </p>
                <ul className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
                  {proposed.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-xl border p-4"
                      style={{ borderColor: 'var(--border-strong)' }}
                    >
                      <p className="text-[14.5px] font-medium">{c.front}</p>
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
      className={active ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-60">{due > 0 ? `${due} due` : count}</span>
    </button>
  )
}
