'use client'

/**
 * A predicted paper without signing in. Development only: a real paper
 * written and checked by scripts/build-papers.mjs, nothing saved.
 */

import { Suspense } from 'react'
import { notFound, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Page } from '@/components/PageShell'
import PaperSitting from '@/components/papers/PaperSitting'
import sample from './sample.json'

const ENABLED = process.env.NODE_ENV !== 'production'

function Preview() {
  // ?resume=1: as if a sitting had been left unfinished.
  const resume = useSearchParams().get('resume')
  const initial = resume ? { mode: 'stopwatch', started_at: '2026-10-28T09:00:00Z', answers: { '0.0.0': 'An answer' }, chosen: [] } : null
  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: ['Economics HL'] }
  return (
    <DashboardLayout profile={profile}>
      <Page>
        <PaperSitting paper={sample} initial={initial} onSave={() => {}} backHref="/dev-preview/paper" backLabel="Economics HL" />
      </Page>
    </DashboardLayout>
  )
}

export default function PaperPreview() {
  if (!ENABLED) notFound()
  return (
    <Suspense>
      <Preview />
    </Suspense>
  )
}
