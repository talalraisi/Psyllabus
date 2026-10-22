'use client'

/**
 * A predicted paper without signing in. Development only: a real paper
 * written and checked by scripts/build-papers.mjs, nothing saved.
 */

import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Page } from '@/components/PageShell'
import PaperSitting from '@/components/papers/PaperSitting'
import sample from './sample.json'

const ENABLED = process.env.NODE_ENV !== 'production'

export default function PaperPreview() {
  if (!ENABLED) notFound()
  const profile = { is_admin: true, id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: ['Economics HL'] }
  return (
    <DashboardLayout profile={profile}>
      <Page>
        <PaperSitting paper={sample} initial={null} onSave={() => {}} backHref="/dev-preview/paper" backLabel="Economics HL" />
      </Page>
    </DashboardLayout>
  )
}
