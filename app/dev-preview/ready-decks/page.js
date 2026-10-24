'use client'

/**
 * Ready-made decks with real counts, without signing in. Development only:
 * presets are readable by anyone, so this reads the live counts and syllabus;
 * studying shows what would be dealt instead of starting a session.
 */

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Page } from '@/components/PageShell'
import { createClient } from '@/lib/supabase'
import { ReadyShelf, ReadySubject } from '@/components/flashcards/ReadyDecks'

const ENABLED = process.env.NODE_ENV !== 'production'
const SUBJECTS = ['Biology HL', 'History HL', 'Math Analysis & Approaches SL', 'Spanish B SL', 'English A: Literature HL', 'Philosophy HL']

export default function ReadyDecksPreview() {
  const [counts, setCounts] = useState({})
  const [open, setOpen] = useState(null)
  const [dealt, setDealt] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (!ENABLED) return
    Promise.all(SUBJECTS.map((s) => supabase.from('preset_deck_counts').select('topic, subtopic, cards').eq('subject', s))).then((rows) =>
      setCounts(Object.fromEntries(SUBJECTS.map((s, i) => [s, rows[i].data || []])))
    )
  }, [supabase])

  if (!ENABLED) notFound()
  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: SUBJECTS }
  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        {dealt && <p className="mb-4 rounded-[12px] p-3 text-[13px]" style={{ background: 'var(--brand-tint)' }}>{dealt}</p>}
        {open ? (
          <ReadySubject
            subject={open.subject}
            counts={counts[open.subject]}
            syllabus={open.syllabus}
            mine={[]}
            onBack={() => setOpen(null)}
            onStudy={async (subject, names, mode) => setDealt(`Would study ${names.length} subtopic(s) of ${subject} as ${mode}: ${names.slice(0, 3).join('; ')}`)}
          />
        ) : (
          <ReadyShelf
            subjects={SUBJECTS}
            counts={counts}
            mine={[]}
            onOpen={async (subject) => {
              const { data } = await supabase.from('syllabus_content').select('subject, topic, unit, code, subtopic, position').eq('subject', subject)
              setOpen({ subject, syllabus: data || [] })
            }}
          />
        )}
      </Page>
    </DashboardLayout>
  )
}
