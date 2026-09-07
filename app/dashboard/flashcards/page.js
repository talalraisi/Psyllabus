'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading, EmptyState, Section } from '@/components/PageShell'
import { IconClose, IconArrowRight } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { accessibleSubjects } from '@/lib/access'
import { scheduleAfter, isDue, dueLabel, cardsFromNote } from '@/lib/flashcards'
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
 * The page is organised as decks rather than one long list, because that is how
 * anybody actually revises: the night before a biology test you want biology
 * enzymes, not every card you have ever written shuffled together. Subject, then
 * subtopic, then review whatever is in front of you.
 */
export default function FlashcardsPage() {
  const [profile, setProfile] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(null) // null | { cards, cramming }
  const [error, setError] = useState('')

  // Which deck is open. null subject means every subject.
  const [scope, setScope] = useState({ subject: null, subtopic: null })

  // Adding cards is secondary to reviewing them, so it stays folded away.
  const [adding, setAdding] = useState('') // '' | 'write' | 'notes' | 'import'
  const [draft, setDraft] = useState({ subject: '', subtopic: '', front: '', back: '' })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(null)
  const [noteCount, setNoteCount] = useState(null)
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

    const [{ data }, { count }] = await Promise.all([
      supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .order('due_at', { ascending: true }),
      supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ])

    setCards(data || [])
    setNoteCount(count || 0)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    load()
  }, [load])

  /* ------------------------------------------------------------------ decks */

  /** One entry per subject that has cards, with the counts a deck needs. */
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

  /** Subtopics inside the open deck. Cards with no subtopic group together. */
  const subtopics = useMemo(() => {
    if (!scope.subject) return []
    const map = new Map()
    for (const c of cards) {
      if (c.subject !== scope.subject) continue
      const key = c.subtopic || ''
      if (!map.has(key)) map.set(key, { subtopic: key, total: 0, due: 0 })
      const group = map.get(key)
      group.total++
      if (isDue(c)) group.due++
    }
    return [...map.values()].sort((a, b) => a.subtopic.localeCompare(b.subtopic))
  }, [cards, scope.subject])

  /** Every card in the current scope, whether or not it is due. */
  const inScope = useMemo(
    () =>
      cards.filter(
        (c) =>
          (!scope.subject || c.subject === scope.subject) &&
          (scope.subtopic === null || (c.subtopic || '') === scope.subtopic)
      ),
    [cards, scope]
  )

  const dueInScope = useMemo(() => inScope.filter(isDue), [inScope])

  const scopeLabel = !scope.subject
    ? 'All subjects'
    : scope.subtopic
      ? `${scope.subject} · ${displaySubtopic(scope.subtopic)}`
      : scope.subject

  /* ----------------------------------------------------------------- review */

  /**
   * Start a session over the current scope. Due cards are the default because
   * that is what spacing is for, but a deck with nothing due can still be
   * revised: the night before a test, "come back in six days" is not an answer.
   */
  const startReview = (which) => {
    const pool = which === 'all' ? inScope : dueInScope
    if (!pool.length) return
    setSessionStats({ right: 0, wrong: 0 })
    setReviewing({ cards: [...pool].sort(() => Math.random() - 0.5), cramming: which === 'all' })
  }

  const markCard = async (card, correct) => {
    // Cramming a card that is not due should not push its real schedule
    // around, so it is practice and nothing more.
    if (reviewing?.cramming && !isDue(card)) {
      setSessionStats((s) => ({
        ...s,
        [correct ? 'right' : 'wrong']: s[correct ? 'right' : 'wrong'] + 1,
      }))
      return
    }
    const patch = scheduleAfter(card, correct)
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))
    setSessionStats((s) => ({
      ...s,
      [correct ? 'right' : 'wrong']: s[correct ? 'right' : 'wrong'] + 1,
    }))
    await supabase.from('flashcards').update(patch).eq('id', card.id)
  }

  /* ------------------------------------------------------------------ write */

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

  /**
   * Build cards from the notes written inside subtopics in this app.
   * Shown for approval rather than inserted straight away: a card the app got
   * wrong is worse than a missing one, because you sit there trying to recall
   * something nobody wrote.
   */
  const generateFromNotes = async () => {
    if (generating) return
    setGenerating(true)
    setError('')
    const user = await getCurrentUser(supabase)
    if (!user) return

    const { data: notes } = await supabase.from('notes').select('*').eq('user_id', user.id)

    const existing = new Set(cards.filter((c) => c.source === 'note').map((c) => c.source_id))
    const proposed = (notes || []).filter((n) => !existing.has(n.id)).flatMap(cardsFromNote)

    setNoteCount((notes || []).length)
    setGenerated(proposed)
    setGenerating(false)
  }

  const acceptGenerated = async () => {
    if (!generated?.length) return
    setSaving(true)
    const user = await getCurrentUser(supabase)
    if (!user) return

    const { data, error: err } = await supabase
      .from('flashcards')
      .insert(generated.map((c) => ({ ...c, user_id: user.id })))
      .select()

    setSaving(false)
    if (err) return setError(err.message)
    setCards((prev) => [...(data || []), ...prev])
    setGenerated(null)
  }

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Flashcards" width="default" rows={4} />
      </DashboardLayout>
    )
  }

  const subjects = accessibleSubjects(profile)
  const totalDue = cards.filter(isDue).length

  /* ---------------------------------------------------------------- review */

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

  /* -------------------------------------------------------------- overview */

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Flashcards"
          subtitle="Write your own, or build them from your notes. No question bank needed."
          action={
            totalDue > 0 ? (
              <button
                onClick={() => {
                  setScope({ subject: null, subtopic: null })
                  setSessionStats({ right: 0, wrong: 0 })
                  setReviewing({ cards: cards.filter(isDue).sort(() => Math.random() - 0.5) })
                }}
                className="btn btn-solid control-md"
              >
                Review all {totalDue} due
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
            description="Write one below, paste in your notes, or build a set from notes you have already written in a subtopic."
          />
        ) : (
          <>
            {/* Decks. Subject first, because that is the unit of a test. */}
            <Section title="Decks">
              <div className="flex flex-wrap gap-2">
                <DeckChip
                  label="All subjects"
                  total={cards.length}
                  due={totalDue}
                  active={!scope.subject}
                  onClick={() => setScope({ subject: null, subtopic: null })}
                />
                {decks.map((d) => (
                  <DeckChip
                    key={d.subject}
                    label={d.subject}
                    total={d.total}
                    due={d.due}
                    active={scope.subject === d.subject}
                    onClick={() => setScope({ subject: d.subject, subtopic: null })}
                  />
                ))}
              </div>

              {/* Subtopics only appear once a deck is open, so the page does
                  not start as a wall of chips. */}
              {scope.subject && subtopics.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <DeckChip
                    label="Whole subject"
                    small
                    total={decks.find((d) => d.subject === scope.subject)?.total ?? 0}
                    due={decks.find((d) => d.subject === scope.subject)?.due ?? 0}
                    active={scope.subtopic === null}
                    onClick={() => setScope((s) => ({ ...s, subtopic: null }))}
                  />
                  {subtopics.map((s) => (
                    <DeckChip
                      key={s.subtopic || 'none'}
                      label={s.subtopic ? displaySubtopic(s.subtopic) : 'No subtopic'}
                      small
                      total={s.total}
                      due={s.due}
                      active={scope.subtopic === s.subtopic}
                      onClick={() => setScope((sc) => ({ ...sc, subtopic: s.subtopic }))}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* What the open deck holds, and the two ways to review it. */}
            <Section title={scopeLabel}>
              <div className="surface flex flex-wrap items-center gap-3 p-5">
                <p className="t-small min-w-[12rem] flex-1">
                  <strong className="text-[var(--text)]">{inScope.length}</strong> card
                  {inScope.length === 1 ? '' : 's'}
                  {dueInScope.length > 0 ? (
                    <>
                      , <strong className="text-[var(--brand)]">{dueInScope.length}</strong> due now
                    </>
                  ) : (
                    ', nothing due yet'
                  )}
                </p>
                {dueInScope.length > 0 && (
                  <button onClick={() => startReview('due')} className="btn btn-solid control-md">
                    Review {dueInScope.length} due
                  </button>
                )}
                {inScope.length > dueInScope.length && (
                  <button
                    onClick={() => startReview('all')}
                    className="btn btn-outline control-md"
                    title="Go through every card in this deck. Cards that are not due yet keep their schedule."
                  >
                    Practise all {inScope.length}
                  </button>
                )}
              </div>

              <ul className="surface mt-3">
                {inScope.slice(0, 60).map((c, i) => (
                  <li key={c.id} className={i > 0 ? 'border-t border-[var(--border)]' : undefined}>
                    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <div className="min-w-[12rem] flex-1">
                        <p className="t-caption truncate">
                          {c.subject}
                          {c.subtopic ? ` · ${displaySubtopic(c.subtopic)}` : ''}
                          {c.source === 'note' ? ' · from your notes' : ''}
                        </p>
                        <p className="truncate text-sm text-[var(--text)]">{c.front}</p>
                      </div>
                      <span className={`t-caption shrink-0 ${isDue(c) ? 'text-[var(--brand)]' : ''}`}>
                        {dueLabel(c)}
                      </span>
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
              {inScope.length > 60 && (
                <p className="t-caption mt-2">
                  Showing 60 of {inScope.length}. Open a subtopic to narrow it down.
                </p>
              )}
            </Section>
          </>
        )}

        {/* -------------------------------------------------------- adding */}

        <Section title="Add cards">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAdding(adding === 'write' ? '' : 'write')}
              className={`btn control-md ${adding === 'write' ? 'btn-solid' : 'btn-outline'}`}
            >
              Write one
            </button>
            <button
              onClick={() => setAdding(adding === 'import' ? '' : 'import')}
              className={`btn control-md ${adding === 'import' ? 'btn-solid' : 'btn-outline'}`}
            >
              Paste or upload notes
            </button>
            <button
              onClick={() => setAdding(adding === 'notes' ? '' : 'notes')}
              className={`btn control-md ${adding === 'notes' ? 'btn-solid' : 'btn-outline'}`}
            >
              From notes in the app
            </button>
          </div>

          {adding === 'write' && (
            <form onSubmit={saveCard} className="surface mt-3 grid gap-4 p-5 sm:grid-cols-2">
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

          {adding === 'import' && (
            <div className="mt-3">
              <NoteImport
                subject={draft.subject}
                subjects={subjects}
                onCards={(made) => setGenerated(made)}
              />
            </div>
          )}

          {adding === 'notes' && (
            <div className="surface mt-3 p-5">
              <p className="t-small">
                Every subtopic has a notes box inside it. This reads the notes you have written
                there and turns headings, lines written as{' '}
                <strong className="text-[var(--text)]">term: definition</strong>, and{' '}
                <strong className="text-[var(--text)]">Q: … A: …</strong> pairs into cards. Anything
                it cannot read confidently is left alone.
              </p>

              {generated === null ? (
                <button
                  onClick={generateFromNotes}
                  disabled={generating || noteCount === 0}
                  className="btn btn-solid control-md mt-4"
                >
                  {generating ? 'Reading your notes…' : 'Build cards from my notes'}
                </button>
              ) : generated.length === 0 ? (
                <p className="t-small mt-4">
                  {noteCount === 0
                    ? 'You have not written any notes in the app yet.'
                    : 'Your notes are already turned into cards. Write more notes, or paste some in above.'}{' '}
                  <Link href="/dashboard/subjects" className="text-[var(--brand)] hover:underline">
                    Open a subject
                  </Link>
                </p>
              ) : null}

              {noteCount === 0 && generated === null && (
                <p className="t-caption mt-2">
                  Nothing to read yet. Open a subject, pick a subtopic, and write in its notes box
                  first.
                </p>
              )}
            </div>
          )}

          {/* Approval sits outside the tabs: whichever route made the cards,
              they are checked the same way before anything is saved. */}
          {generated?.length > 0 && (
            <div className="surface mt-3 p-5">
              <p className="t-small mb-3">
                {generated.length} card{generated.length === 1 ? '' : 's'} found. Check them before
                adding.
              </p>
              <ul className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
                {generated.map((c, i) => (
                  <li key={i} className="rounded-[var(--r-md)] border border-[var(--border-strong)] p-3">
                    <p className="text-sm font-medium text-[var(--text)]">{c.front}</p>
                    <p className="t-small mt-1">{c.back}</p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button onClick={() => setGenerated(null)} className="btn btn-quiet control-md">
                  Discard
                </button>
                <button onClick={acceptGenerated} disabled={saving} className="btn btn-solid control-md">
                  {saving ? 'Adding…' : `Add ${generated.length}`}
                </button>
              </div>
            </div>
          )}
        </Section>
      </Page>
    </DashboardLayout>
  )
}

/** A deck button: name, how many cards, and how many are waiting. */
function DeckChip({ label, total, due, active, onClick, small = false }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border px-3 ${small ? 'py-1.5' : 'py-2'} transition-colors duration-150 ${
        active
          ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
          : 'border-[var(--border)] text-[var(--text-body)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]'
      }`}
    >
      <span className={`${small ? 'text-xs' : 'text-sm'} font-medium`}>{label}</span>
      <span className="text-xs text-[var(--text-faint)]">{total}</span>
      {due > 0 && (
        <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {due}
        </span>
      )}
    </button>
  )
}
