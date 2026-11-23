'use client'

/** Onboarding's first step: curriculum, graduation year, exam session. Development only. */

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { CURRICULUMS } from '@/lib/catalogue'
import StartStep from '@/components/onboarding/StartStep'

const ENABLED = process.env.NODE_ENV !== 'production'

export default function OnboardingStartPreview() {
  const [curriculum, setCurriculum] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [session, setSession] = useState('')
  const [went, setWent] = useState('')
  if (!ENABLED) notFound()
  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-xl rounded-[14px] border p-6 md:p-9" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <StartStep
          curriculum={curriculum}
          offered={Boolean(CURRICULUMS[curriculum])}
          gradYear={gradYear}
          session={session}
          email="student@example.com"
          onCurriculum={setCurriculum}
          onYear={(y, s) => {
            setGradYear(y)
            setSession(s)
          }}
          onSession={setSession}
          onWaitlist={async () => true}
          onContinue={() => setWent(`${curriculum} · ${gradYear} · ${session}`)}
        />
        {went && <p className="mt-4 text-[13px]" role="status">Continue: {went}</p>}
      </div>
    </main>
  )
}
