'use client'

/** The study type card on the plan page, before and after the quiz. Development only. */

import { notFound } from 'next/navigation'
import { Page } from '@/components/PageShell'
import StudyTypeCard from '@/components/plan/StudyTypeCard'

const ENABLED = process.env.NODE_ENV !== 'production'
const ANSWERS = { revise: 'reread', start: 'night', focus: '25', wrong: 'move', check: 'familiar', mix: 'few', block: 'phone', methods: ['flashcards'], time: '45' }

export default function StudyTypeCardPreview() {
  if (!ENABLED) notFound()
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Page>
        <StudyTypeCard profile={{ plan_settings: {} }} onOpen={() => {}} onRetake={() => {}} />
        <StudyTypeCard profile={{ plan_settings: { studyStyle: { answers: ANSWERS, applied: true } } }} onOpen={() => {}} onRetake={() => {}} />
      </Page>
    </main>
  )
}
