'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading, EmptyState, Section } from '@/components/PageShell'
import { IconCheck, IconClose, IconArrowRight } from '@/components/Icons'
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
 * What they do give is something to do on a day when you do not want to sit a
 * quiz, and a way to use the app before the question bank is deep.
 */
export default function FlashcardsPage() {
  const [profile, setProfile] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('overview') // overview | review | new
  const [error, setError] = useState('')

  // Review session
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [sessionStats, setSessionStats] = useState({ right: 0, wrong: 0 })

  // New card
  const [draft, setDraft] = useState({ subject: '', subtopic: '', front: '', back: '' })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(null)

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

    const { data } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .order('due_at', { ascending: true })

    setCards(data || [])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    load()
  }, [load])

  const due = useMemo(() => cards.filter((c) => isDue(c)), [cards])

  const startReview = () => {
    if (!due.length) return
    setQueue([...due].sort(() => Math.random() - 0.5))
    setIndex(0)
    setRevealed(false)
    setSessionStats({ right: 0, wrong: 0 })
    setMode('review')
  }

  const mark = async (correct) => {
    const card = queue[index]
    if (!card) return

    const patch = scheduleAfter(card, correct)
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))
    setSessionStats((s) => ({ ...s, [correct ? 'right' : 'wrong']: s[correct ? 'right' : 'wrong'] + 1 }))

    await supabase.from('flashcards').update(patch).eq('id', card.id)

    if (index + 1 >= queue.length) setMode('done')
    else {
      setIndex(index + 1)
      setRevealed(false)
    }
  }

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

  /**
   * Build cards from notes the student has already written.
   * Shown for approval rather than inserted straight away: a card the app got
   * wrong is worse than a missing one, because they will sit there trying to
   * recall something nobody wrote.
   */
  const generateFromNotes = async () => {
    if (generating) return
    setGenerating(true)
    setError('')
    const user = await getCurrentUser(supabase)
    if (!user) return

    const { data: notes } = await supabase.from('notes').select('*').eq('user_id', user.id)

    const existing = new Set(cards.filter((c) => c.source === 'note').map((c) => c.source_id))
    const proposed = (notes || [])
      .filter((n) => !existing.has(n.id))
      .flatMap(cardsFromNote)

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

  /* ---------------------------------------------------------------- review */

  if (mode === 'review' && queue.length) {
    return (
      <DashboardLayout profile={profile}>
        <FlashcardReview
          cards={queue}
          stats={sessionStats}
          onMark={async (card, correct) => {
            const patch = scheduleAfter(card, correct)
            setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))
            setSessionStats((st) => ({
              ...st,
              [correct ? 'right' : 'wrong']: st[correct ? 'right' : 'wrong'] + 1,
            }))
            await supabase.from('flashcards').update(patch).eq('id', card.id)
          }}
          onExit={({ finished }) => setMode(finished ? 'done' : 'overview')}
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
            due.length > 0 ? (
              <button onClick={startReview} className="btn btn-solid control-md">
                Review {due.length}
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

        {/* Make one */}
        <Section title="Write a card">
          <form onSubmit={saveCard} className="surface grid gap-4 p-5 sm:grid-cols-2">
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
        </Section>

        {/* Import */}
        <Section title="Turn notes into cards">
          <NoteImport
            subject={draft.subject}
            subjects={subjects}
            onCards={(cards) => setGenerated(cards)}
          />
        </Section>

        {/* Generate */}
        <Section title="Build from notes already in the app">
          <div className="surface p-5">
            <p className="t-small">
              Turns headings, and lines written as <strong className="text-[var(--text)]">term: definition</strong>{' '}
              or <strong className="text-[var(--text)]">Q: … A: …</strong>, into cards. Anything it cannot read
              confidently is left alone.
            </p>

            {generated === null ? (
              <button
                onClick={generateFromNotes}
                disabled={generating}
                className="btn btn-quiet control-md mt-4"
              >
                {generating ? 'Reading your notes…' : 'Build cards from notes'}
              </button>
            ) : generated.length === 0 ? (
              <p className="t-small mt-4">
                Nothing new to build. Write some notes on a subtopic first, or you already have
                cards for everything.{' '}
                <Link href="/dashboard/subjects" className="text-[var(--brand)] hover:underline">
                  Open a subject
                </Link>
              </p>
            ) : (
              <div className="mt-4">
                <p className="t-small mb-3">
                  {generated.length} card{generated.length === 1 ? '' : 's'} found. Check them before
                  adding.
                </p>
                <ul className="mb-4 flex max-h-72 flex-col gap-2 overflow-y-auto">
                  {generated.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-[var(--r-md)] border border-[var(--border-strong)] p-3"
                    >
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
          </div>
        </Section>

        {/* All cards */}
        <Section title={`Your cards (${cards.length})`}>
          {cards.length === 0 ? (
            <EmptyState
              title="No cards yet"
              description="Write one above, or build a set from notes you have already made."
            />
          ) : (
            <ul className="surface">
              {cards.slice(0, 40).map((c, i) => (
                <li key={c.id} className={i > 0 ? 'border-t border-[var(--border)]' : undefined}>
                  <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-[12rem] flex-1">
                      <p className="t-caption truncate">
                        {c.subject}
                        {c.subtopic ? ` · ${displaySubtopic(c.subtopic)}` : ''}
                        {c.source !== 'manual' ? ` · from your ${c.source}s` : ''}
                      </p>
                      <p className="truncate text-sm text-[var(--text)]">{c.front}</p>
                    </div>
                    <span className={`t-caption shrink-0 ${isDue(c) ? 'text-[var(--brand)]' : ''}`}>
                      {dueLabel(c)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {cards.length > 40 && (
            <p className="t-caption mt-2">Showing 40 of {cards.length}.</p>
          )}
        </Section>
      </Page>
    </DashboardLayout>
  )
}
