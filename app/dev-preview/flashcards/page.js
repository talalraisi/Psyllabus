'use client'

/**
 * The flashcard modes without signing in. Development only: sample cards,
 * nothing saved. ?mode=review (flip through) or ?mode=write (type the answer).
 */

import { Suspense, useState, useSyncExternalStore } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import FlashcardReview from '@/components/FlashcardReview'
import FlashcardWrite from '@/components/FlashcardWrite'

const ENABLED = process.env.NODE_ENV !== 'production'

const CARDS = [
  { id: 'c1', front: 'What is the SI unit of force?', back: 'The newton', subtopic: 'Forces' },
  { id: 'c2', front: 'State Newton’s second law.', back: 'Force equals the rate of change of momentum', subtopic: 'Forces' },
  { id: 'c3', front: 'What is weight?', back: 'The gravitational force on a mass', subtopic: 'Forces' },
]

function Preview() {
  const mode = useSearchParams().get('mode') || 'review'
  const [done, setDone] = useState(null)
  // The deck is shuffled: render it in the browser only, so server and client agree.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  if (!ready) return null
  if (done) return <p className="p-10">Finished: {JSON.stringify(done)}</p>
  const props = { cards: CARDS, onMark: () => {}, onEdit: () => {}, onDelete: () => {}, onExit: setDone }
  return mode === 'write' ? <FlashcardWrite {...props} /> : <FlashcardReview {...props} />
}

export default function FlashcardsPreview() {
  if (!ENABLED) notFound()
  return (
    <Suspense>
      <Preview />
    </Suspense>
  )
}
