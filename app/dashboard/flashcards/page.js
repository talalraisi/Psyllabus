'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { PageLoading, SkeletonActions } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { accessibleSubjects, canUse, hasSyllabi } from '@/lib/access'
import { scheduleAfter, studyOrder } from '@/lib/flashcards'
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
  // Decks the student named, and the folders they keep them in.
  const [decks, setDecks] = useState([])
  const [folders, setFolders] = useState([])
  // Ready-made cards per subtopic, by subject: { subject: [{ topic, subtopic, cards }] }.
  const [readyCounts, setReadyCounts] = useState({})
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

    const [{ data: cardRows }, { data: noteRows }, { data: deckRows }, { data: folderRows }, ...countRows] = await Promise.all([
      supabase.from('flashcards').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('notes').select('id, subject, subtopic, body').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('flashcard_decks').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('flashcard_folders').select('*').eq('user_id', user.id).order('created_at'),
      // How many ready-made cards each subtopic has, one subject at a time:
      // the cards themselves are thousands a subject and are fetched to study.
      ...usable.map((subject) => supabase.from('preset_deck_counts').select('topic, subtopic, cards').eq('subject', subject)),
    ])
    setReadyCounts(Object.fromEntries(usable.map((subject, i) => [subject, countRows[i]?.data || []])))
    setCards(cardRows || [])
    setDecks(deckRows || [])
    setFolders(folderRows || [])
    setNotes((noteRows || []).filter((n) => (n.body || '').trim().length > 20))
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    load()
  }, [load])

  /* ----------------------------------------------------------------- review */

  /**
   * Start a session on the cards given, in the order given (the views pass
   * them least-known first). Flip is right for a card you have never seen;
   * write, blank and test are for a deck you think you know.
   */
  const review = (pool, mode = 'flip') => {
    if (!pool.length) return
    setReviewing({ cards: pool, mode })
  }

  /** A subject's syllabus, to lay its ready-made cards out by topic. */
  const loadSyllabus = (subject) => getSyllabus(supabase, [subject])

  /**
   * Study ready-made subtopics: the cards already taken from them, on their
   * own schedule, and the ones not yet met. Fetched in pages, because a
   * whole topic can run past the 1,000 rows one request returns.
   */
  const fetchPresets = async (subject, subtopics) => {
    const presets = []
    for (let i = 0; i < subtopics.length; i += 100) {
      const names = subtopics.slice(i, i + 100)
      for (let from = 0; ; from += 1000) {
        const { data, error: err } = await supabase
          .from('flashcard_presets')
          .select('id, subject, topic, subtopic, front, back')
          .eq('subject', subject)
          .in('subtopic', names)
          .order('subtopic')
          .order('position')
          .range(from, from + 999)
        if (err) {
          setError('Could not load those cards. Try again in a moment.')
          return null
        }
        presets.push(...(data || []))
        if (!data || data.length < 1000) break
      }
    }
    return presets
  }

  const studyReady = async (subject, subtopics, mode) => {
    const presets = await fetchPresets(subject, subtopics)
    if (!presets) return
    const wanted = new Set(subtopics)
    const own = cards.filter((c) => c.subject === subject && wanted.has(c.subtopic))
    const taken = new Set(own.map((c) => c.front))
    const fresh = presets.filter((p) => !taken.has(p.front)).map((p) => ({ ...p, preset: true, box: 1, reviews: 0 }))
    const pool = [...own, ...fresh]
    review(studyOrder(pool, pool.length), mode)
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
    const patch = scheduleAfter(card, correct)
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

  /* ------------------------------------------------- decks and folders */

  const createDeck = async (name, folderId = null) => {
    const user = await getCurrentUser(supabase)
    if (!user) return null
    const { data, error: err } = await supabase.from('flashcard_decks').insert({ user_id: user.id, name, folder_id: folderId }).select().single()
    if (err) {
      setError('Could not make that deck.')
      return null
    }
    setDecks((prev) => [...prev, data])
    return data
  }

  const updateDeck = async (deck, patch) => {
    setDecks((prev) => prev.map((d) => (d.id === deck.id ? { ...d, ...patch } : d)))
    const { error: err } = await supabase.from('flashcard_decks').update(patch).eq('id', deck.id)
    if (err) {
      setError('Could not save that deck.')
      setDecks((prev) => prev.map((d) => (d.id === deck.id ? deck : d)))
      return false
    }
    return true
  }

  /** A deck and every card in it. */
  const deleteDeck = async (deck) => {
    const { error: err } = await supabase.from('flashcard_decks').delete().eq('id', deck.id)
    if (err) return setError('Could not delete that deck.')
    setDecks((prev) => prev.filter((d) => d.id !== deck.id))
    setCards((prev) => prev.filter((c) => c.deck_id !== deck.id))
  }

  /** Cards by id, in chunks: a URL holds only so many ids. */
  const inChunks = async (ids, run) => {
    for (let i = 0; i < ids.length; i += 200) {
      const { error: err } = await run(ids.slice(i, i + 200))
      if (err) return false
    }
    return true
  }

  const deleteCards = async (list) => {
    const ids = list.map((c) => c.id)
    const gone = new Set(ids)
    const ok = await inChunks(ids, (chunk) => supabase.from('flashcards').delete().in('id', chunk))
    if (!ok) setError('Could not delete all of those cards.')
    setCards((prev) => prev.filter((c) => !gone.has(c.id)))
  }

  /** Put cards in a deck (deckId) or take them out of one (null). */
  const moveCards = async (list, deckId) => {
    const ids = list.map((c) => c.id)
    const moving = new Set(ids)
    const ok = await inChunks(ids, (chunk) => supabase.from('flashcards').update({ deck_id: deckId }).in('id', chunk))
    if (!ok) {
      setError('Could not move those cards.')
      return false
    }
    setCards((prev) => prev.map((c) => (moving.has(c.id) ? { ...c, deck_id: deckId } : c)))
    return true
  }

  const createFolder = async (name) => {
    const user = await getCurrentUser(supabase)
    if (!user) return null
    const { data, error: err } = await supabase.from('flashcard_folders').insert({ user_id: user.id, name }).select().single()
    if (err) {
      setError('Could not make that folder.')
      return null
    }
    setFolders((prev) => [...prev, data])
    return data
  }

  const renameFolder = async (folder, name) => {
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, name } : f)))
    const { error: err } = await supabase.from('flashcard_folders').update({ name }).eq('id', folder.id)
    if (err) setError('Could not rename that folder.')
    return !err
  }

  /** The folder goes; its decks stay, loose. */
  const deleteFolder = async (folder) => {
    const { error: err } = await supabase.from('flashcard_folders').delete().eq('id', folder.id)
    if (err) return setError('Could not delete that folder.')
    setFolders((prev) => prev.filter((f) => f.id !== folder.id))
    setDecks((prev) => prev.map((d) => (d.folder_id === folder.id ? { ...d, folder_id: null } : d)))
  }

  /**
   * Ready-made subtopics into one of the student's decks. Cards they already
   * took from those subtopics move into the deck with their progress; the
   * rest are copied in as new cards.
   */
  const addReadyToDeck = async (subject, subtopics, target) => {
    const deck = target.id ? decks.find((d) => d.id === target.id) : await createDeck(target.name)
    if (!deck) return false
    const presets = await fetchPresets(subject, subtopics)
    if (!presets) return false
    const wanted = new Set(subtopics)
    const own = cards.filter((c) => c.subject === subject && wanted.has(c.subtopic) && c.deck_id !== deck.id)
    const byFront = new Map(own.map((c) => [c.front, c]))
    const inDeck = new Set(cards.filter((c) => c.deck_id === deck.id).map((c) => c.front))
    const move = presets.map((p) => byFront.get(p.front)).filter((c) => c && !inDeck.has(c.front))
    const fresh = presets.filter((p) => !byFront.has(p.front) && !inDeck.has(p.front))
    if (move.length && !(await moveCards(move, deck.id))) return false
    const user = await getCurrentUser(supabase)
    for (let i = 0; i < fresh.length; i += 500) {
      const rows = fresh.slice(i, i + 500).map((p) => ({ user_id: user.id, deck_id: deck.id, subject, topic: p.topic || null, subtopic: p.subtopic || null, front: p.front, back: p.back, source: 'preset' }))
      const { data, error: err } = await supabase.from('flashcards').insert(rows).select()
      if (err) {
        setError('Could not add all of those cards.')
        return false
      }
      setCards((prev) => [...(data || []), ...prev])
    }
    return deck
  }

  const subjects = useMemo(() => (profile ? accessibleSubjects(profile) : []), [profile])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading
          title="Flashcards"
          subtitle="Your own cards, from your notes or written yourself. Study them whenever you like."
          action={<SkeletonActions widths={[132]} />}
          variant="flashcards"
        />
      </DashboardLayout>
    )
  }

  if (reviewing) {
    const exit = () => setReviewing(null)
    return (
      <DashboardLayout profile={profile}>
        {reviewing.mode === 'flip' ? (
          <FlashcardReview cards={reviewing.cards} onMark={markCard} onDelete={deleteCard} onExit={exit} />
        ) : reviewing.mode === 'test' ? (
          <FlashcardTest cards={reviewing.cards} onMark={markCard} onExit={exit} />
        ) : (
          <FlashcardWrite cards={reviewing.cards} mode={reviewing.mode} onMark={markCard} onDelete={deleteCard} onExit={exit} />
        )}
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <FlashcardsView
        cards={cards}
        decks={decks}
        folders={folders}
        deckActions={{ createDeck, updateDeck, deleteDeck, deleteCards, moveCards, createFolder, renameFolder, deleteFolder, addReadyToDeck }}
        readyCounts={canUse('presetDecks', profile) ? readyCounts : {}}
        presetsLocked={!canUse('presetDecks', profile)}
        notes={notes}
        subjects={subjects}
        syllabi={hasSyllabi(profile)}
        error={error}
        onReview={review}
        onAdd={addCards}
        onEdit={editCard}
        onDelete={deleteCard}
        loadSyllabus={loadSyllabus}
        onStudyReady={studyReady}
      />
    </DashboardLayout>
  )
}
