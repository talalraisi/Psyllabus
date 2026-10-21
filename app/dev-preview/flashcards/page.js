'use client'

/**
 * The flashcards page and review without signing in. Development only.
 * Sample cards, nothing saved: marks and edits change this tab only.
 */

import { useState } from 'react'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import FlashcardsView from '@/components/flashcards/FlashcardsView'
import FlashcardReview from '@/components/FlashcardReview'
import FlashcardWrite from '@/components/FlashcardWrite'
import FlashcardTest from '@/components/FlashcardTest'

const ENABLED = process.env.NODE_ENV !== 'production'
const DAY = 86400000
const make = (BASE, i, subject, subtopic, front, back, box, dueDays) => ({ id: `c${i}`, subject, subtopic, front, back, box, reviews: box, due_at: new Date(BASE + dueDays * DAY).toISOString(), source: i % 4 ? 'manual' : 'syllabi' })
const sample = (BASE) => [
  make(BASE, 1, 'Biology HL', 'Enzymes', 'What does a competitive inhibitor do?', 'Binds the active site and blocks the substrate from binding.', 0, -1),
  make(BASE, 2, 'Biology HL', 'Enzymes', 'Define activation energy.', 'The minimum energy needed for a reaction to start.', 1, -1),
  make(BASE, 3, 'Biology HL', 'Enzymes', 'Why does enzyme activity fall above the optimum temperature?', 'The enzyme denatures: the active site changes shape so the substrate no longer fits.', 2, 2),
  make(BASE, 4, 'Biology HL', 'Cell membranes', 'What is facilitated diffusion?', 'Passive movement of molecules across a membrane through channel or carrier proteins.', 3, 6),
  make(BASE, 5, 'Biology HL', 'Cell membranes', 'Why do phospholipids form a bilayer?', 'Hydrophilic heads face the water, hydrophobic tails face each other.', 4, 15),
  make(BASE, 6, 'Economics HL', 'Elasticity', 'Formula for PED', '$PED = \\frac{\\%\\Delta Q_d}{\\%\\Delta P}$', 1, -2),
  make(BASE, 7, 'Economics HL', 'Elasticity', 'If PED is -0.4 and price rises, what happens to revenue?', 'Revenue rises: demand is inelastic.', 0, -1),
  make(BASE, 8, 'Economics HL', 'Market failure', 'What is a negative externality?', 'A cost to third parties not reflected in the market price.', 5, 30),
  make(BASE, 9, 'Physics SL', 'SHM', 'Condition for simple harmonic motion', 'Acceleration is proportional to displacement and directed towards equilibrium.', 2, 1),
  make(BASE, 10, 'Physics SL', 'SHM', 'Period of a simple pendulum', '$T = 2\\pi\\sqrt{L/g}$', 3, -1),
]

export default function FlashcardsPreview() {
  // Dated from now, read once, so some are always due.
  const [cards, setCards] = useState(() => sample(Date.now()))
  const [session, setSession] = useState(null)
  if (!ENABLED) notFound()
  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', grad_year: '2028', subjects: ['Biology HL', 'Economics HL', 'Physics SL'] }
  return (
    <DashboardLayout profile={profile}>
      {session ? (
        session.mode === 'test' ? (
          <FlashcardTest cards={session.cards} onMark={() => {}} onExit={() => setSession(null)} />
        ) : session.mode === 'write' || session.mode === 'blank' ? (
          <FlashcardWrite cards={session.cards} mode={session.mode} onMark={() => {}} onDelete={() => {}} onExit={() => setSession(null)} />
        ) : (
          <FlashcardReview cards={session.cards} onMark={() => {}} onDelete={() => {}} onExit={() => setSession(null)} />
        )
      ) : (
        <FlashcardsView
          cards={cards}
          presets={[]}
          notes={[]}
          subjects={profile.subjects}
          syllabi
          onReview={(pool, mode = 'flip') => setSession({ cards: pool, mode })}
          onAdd={async (list) => (setCards((c) => [...list.map((x, i) => ({ ...x, id: `n${Date.now()}${i}`, box: 0, due_at: c[0]?.due_at })), ...c]), true)}
          onEdit={async (card, patch) => (setCards((c) => c.map((x) => (x.id === card.id ? { ...x, ...patch } : x))), true)}
          onDelete={(card) => setCards((c) => c.filter((x) => x.id !== card.id))}
        />
      )}
    </DashboardLayout>
  )
}
