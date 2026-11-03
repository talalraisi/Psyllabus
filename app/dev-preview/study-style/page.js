'use client'

/** How you study best, without signing in. Development only; nothing is saved. */

import { notFound } from 'next/navigation'
import { Page } from '@/components/PageShell'
import StudyStyle from '@/components/StudyStyle'

const ENABLED = process.env.NODE_ENV !== 'production'

export default function StudyStylePreview() {
  if (!ENABLED) notFound()
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Page>
        <StudyStyle onApply={() => new Promise((r) => setTimeout(() => r(true), 500))} />
      </Page>
    </main>
  )
}
