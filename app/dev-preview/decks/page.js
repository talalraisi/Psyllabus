'use client'

/**
 * The flashcards shelf with decks and folders, without signing in.
 * Development only: everything lives in memory and nothing is saved; adding a
 * ready-made topic to a deck reads the real presets, which anyone can read.
 */

import { useState } from 'react'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import FlashcardsView from '@/components/flashcards/FlashcardsView'
import { createClient } from '@/lib/supabase'

const ENABLED = process.env.NODE_ENV !== 'production'
const SUBJECTS = ['Biology HL', 'Chemistry HL']
let n = 0
const id = () => `p${++n}`

const START = [
  { id: 'c1', subject: 'Biology HL', subtopic: 'Cell respiration', front: 'Where does glycolysis happen?', back: 'In the cytoplasm.', box: 2, source: 'manual' },
  { id: 'c2', subject: 'Biology HL', subtopic: 'Cell respiration', front: 'Net ATP from glycolysis?', back: 'Two per glucose.', box: 5, source: 'manual' },
  { id: 'c3', subject: 'Chemistry HL', subtopic: 'Moles', front: 'What is a mole?', back: '$6.02 \\times 10^{23}$ particles.', box: 0, source: 'manual' },
]

export default function DecksPreview() {
  const [cards, setCards] = useState(START)
  const [decks, setDecks] = useState([])
  const [folders, setFolders] = useState([])
  const [counts, setCounts] = useState(null)
  const supabase = createClient()

  if (!ENABLED) notFound()
  if (!counts) {
    Promise.all(SUBJECTS.map((s) => supabase.from('preset_deck_counts').select('topic, subtopic, cards').eq('subject', s))).then((rows) => setCounts(Object.fromEntries(SUBJECTS.map((s, i) => [s, rows[i].data || []]))))
  }

  const act = {
    createDeck: async (name, folder_id = null) => {
      const d = { id: id(), name, folder_id }
      setDecks((p) => [...p, d])
      return d
    },
    updateDeck: async (deck, patch) => (setDecks((p) => p.map((d) => (d.id === deck.id ? { ...d, ...patch } : d))), true),
    deleteDeck: async (deck) => {
      setDecks((p) => p.filter((d) => d.id !== deck.id))
      setCards((p) => p.filter((c) => c.deck_id !== deck.id))
    },
    deleteCards: async (list) => setCards((p) => p.filter((c) => !list.some((x) => x.id === c.id))),
    moveCards: async (list, deck_id) => (setCards((p) => p.map((c) => (list.some((x) => x.id === c.id) ? { ...c, deck_id } : c))), true),
    createFolder: async (name) => {
      const f = { id: id(), name }
      setFolders((p) => [...p, f])
      return f
    },
    renameFolder: async (folder, name) => (setFolders((p) => p.map((f) => (f.id === folder.id ? { ...f, name } : f))), true),
    deleteFolder: async (folder) => {
      setFolders((p) => p.filter((f) => f.id !== folder.id))
      setDecks((p) => p.map((d) => (d.folder_id === folder.id ? { ...d, folder_id: null } : d)))
    },
    addReadyToDeck: async (subject, subtopics, target) => {
      const deck = target.id ? decks.find((d) => d.id === target.id) : await act.createDeck(target.name)
      const { data } = await supabase.from('flashcard_presets').select('subject, topic, subtopic, front, back').eq('subject', subject).in('subtopic', subtopics).limit(1000)
      setCards((p) => [...(data || []).map((c) => ({ ...c, id: id(), deck_id: deck.id, box: 0, source: 'preset' })), ...p])
      return deck
    },
  }

  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: SUBJECTS }
  return (
    <DashboardLayout profile={profile}>
      <FlashcardsView
        cards={cards}
        decks={decks}
        folders={folders}
        deckActions={act}
        readyCounts={counts || {}}
        notes={[]}
        subjects={SUBJECTS}
        syllabi={false}
        onReview={() => {}}
        onAdd={async (list) => (setCards((p) => [...list.map((c) => ({ ...c, id: id(), box: 0 })), ...p]), true)}
        onEdit={async () => true}
        onDelete={async (card) => setCards((p) => p.filter((c) => c.id !== card.id))}
        loadSyllabus={async (subject) => (await supabase.from('syllabus_content').select('subject, topic, unit, code, subtopic, position').eq('subject', subject)).data || []}
        onStudyReady={() => {}}
      />
    </DashboardLayout>
  )
}
