'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { accessibleSubjects, canUse, hasSyllabi } from '@/lib/access'
import { scheduleAfter, snoozeAfter, isDue } from '@/lib/flashcards'
import FlashcardReview from '@/components/FlashcardReview'
import FlashcardWrite from '@/components/FlashcardWrite'
import FlashcardTest from '@/components/FlashcardTest'
import FlashcardsView from '@/components/flashcards/FlashcardsView'

/**
 * Flashcards: loading, saving and the study sessions. The page itself is
 * laid out in components/flashcards/FlashcardsView.js.
 *
 * Cards are self-marked, so they never award mastery points. That is the line
 * the rest of the product is built on and it holds here: a card you told the
 * app you got right is not evidence, and letting it colour the heatmap would
 * undo the one thing that makes the heatmap worth looking at.
 */
export default function FlashcardsPage() {
  const [profile, setProfile] = useState(null)
  const [cards, setCards] = useState([])
  const [notes, setNotes] = useState([])
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])

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
    const usable = accessibleSubjects(profileData)

    const [{ data: cardRows }, { data: noteRows }, { data: presetRows }] = await Promise.all([
      supabase.from('flashcards').select('*').eq('user_id', user.id).order('due_at', { ascending: true }),
      supabase.from('notes').select('id, subject, subtopic, body').eq('user_id', user.id).order('updated_at', { ascending: false }),
      // Only the verified ones are readable at all.
      usable.length
        ? supabase.from('flashcard_presets').select('id, subject, topic, subtopic, front, back').eq('verified', true).in('subject', usable)
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

  /* ----------------------------------------------------------------- review */

  /**
   * Start a session. Flip is right for a card you have never seen; write,
   * blank and test are for a deck you think you know, where flipping stops
   * telling you anything true. `cramming` studies cards that are not due
   * without moving their schedule.
   */
  const review = (pool, cramming = false, mode = 'flip') => {
    if (!pool.length) return
    setReviewing({ cards: [...pool].sort(() => Math.random() - 0.5), cramming, mode })
  }

  const markCard = async (card, correct) => {
    /**
     * A ready-made card becomes yours the moment you answer it, so the
     * schedule is yours to keep without a separate "add deck" decision.
     */
    if (card.preset) {
      const user = await getCurrentUser(supabase)
      if (!user) return
      const patch = scheduleAfter({ box: 1, reviews: 0 }, correct)
      const { data } = await supabase
        .from('flashcards')
        .insert({ user_id: user.id, subject: card.subject, topic: card.topic || null, subtopic: card.subtopic || null, front: card.front, back: card.back, source: 'preset', ...patch })
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

  /** "Ask me again in five minutes": only the due date moves, never the box. */
  const snoozeCard = async (card, minutes) => {
    if (!card?.id || card.preset) return
    const patch = snoozeAfter(card, minutes)
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...patch } : c)))
    await supabase.from('flashcards').update(patch).eq('id', card.id)
  }

  /* ------------------------------------------------------------------ cards */

  const addCards = async (list) => {
    const user = await getCurrentUser(supabase)
    if (!user || !list.length) return false
    const { data, error: err } = await supabase
      .from('flashcards')
      .insert(list.map((c) => ({ ...c, user_id: user.id })))
      .select()
    if (err) {
      setError(err.message)
      return false
    }
    setCards((prev) => [...(data || []), ...prev])
    return true
  }

  const editCard = async (card, patch) => {
    const clean = { front: patch.front.trim(), back: patch.back.trim(), updated_at: new Date().toISOString() }
    if (!clean.front || !clean.back) return false
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...clean } : c)))
    const { error: err } = await supabase.from('flashcards').update(clean).eq('id', card.id)
    if (err) {
      setError('Could not save that card.')
      setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)))
      return false
    }
    return true
  }

  const deleteCard = async (card) => {
    setCards((prev) => prev.filter((c) => c.id !== card.id))
    const { error: err } = await supabase.from('flashcards').delete().eq('id', card.id)
    // Put it back rather than pretending it went.
    if (err) {
      setError('Could not delete that card.')
      setCards((prev) => [card, ...prev])
    }
  }

  const subjects = useMemo(() => (profile ? accessibleSubjects(profile) : []), [profile])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Flashcards" width="default" rows={4} variant="cards" />
      </DashboardLayout>
    )
  }

  if (reviewing) {
    const exit = () => setReviewing(null)
    return (
      <DashboardLayout profile={profile}>
        {reviewing.mode === 'flip' ? (
          <FlashcardReview cards={reviewing.cards} onMark={markCard} onSnooze={snoozeCard} onDelete={deleteCard} onExit={exit} />
        ) : reviewing.mode === 'test' ? (
          <FlashcardTest cards={reviewing.cards} onMark={markCard} onExit={exit} />
        ) : (
          <FlashcardWrite cards={reviewing.cards} mode={reviewing.mode} onMark={markCard} onSnooze={snoozeCard} onDelete={deleteCard} onExit={exit} />
        )}
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <FlashcardsView
        cards={cards}
        presets={canUse('presetDecks', profile) ? presets : []}
        presetsLocked={!canUse('presetDecks', profile)}
        notes={notes}
        subjects={subjects}
        syllabi={hasSyllabi(profile)}
        error={error}
        onReview={review}
        onAdd={addCards}
        onEdit={editCard}
        onDelete={deleteCard}
      />
    </DashboardLayout>
  )
}
