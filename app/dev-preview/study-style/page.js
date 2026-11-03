'use client'

/** How you study best, without signing in. Development only; nothing is saved. */

import { notFound } from 'next/navigation'
import { Page } from '@/components/PageShell'
import DashboardLayout from '@/components/DashboardLayout'
import StudyStyle from '@/components/StudyStyle'

const ENABLED = process.env.NODE_ENV !== 'production'

export default function StudyStylePreview() {
  if (!ENABLED) notFound()
  return (
    <DashboardLayout profile={{ id: 'preview', full_name: 'Sample Student', curriculum: 'IB', subjects: ['Biology HL'] }}>
      <Page>
        <StudyStyle onResult={() => {}} onApply={() => new Promise((r) => setTimeout(() => r(true), 500))} />
      </Page>
    </DashboardLayout>
  )
}
