'use client'

/**
 * Syllabi: ask it anything about your subjects, or use one of its tools on
 * your own work. Premium, like the routes behind it, which check again.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import LockedPanel from '@/components/LockedPanel'
import { Page, PageHeader, PageLoading } from '@/components/PageShell'
import TutorChat from '@/components/syllabi/TutorChat'
import SyllabiTools from '@/components/syllabi/SyllabiTools'
import DraftStudio from '@/components/syllabi/DraftStudio'
import { hasSyllabi } from '@/lib/access'

export default function SyllabiPage() {
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [tab, setTab] = useState('ask')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      const p = await getProfile(supabase, user.id, { onFresh: setProfile })
      if (!p) {
        router.push('/onboarding')
        return
      }
      setRows((await getSyllabus(supabase, p.subjects || [])) || [])
      setProfile(p)
    }
    load()
  }, [router, supabase])

  // Topics in syllabus order, for the topic picker.
  const topicsBySubject = useMemo(() => {
    const out = {}
    for (const r of [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      if (!out[r.subject]) out[r.subject] = []
      if (!out[r.subject].includes(r.topic)) out[r.subject].push(r.topic)
    }
    return out
  }, [rows])

  if (!profile) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Syllabi" />
      </DashboardLayout>
    )
  }

  const subjects = profile.subjects || []

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title="Syllabi"
          subtitle="Your tutor for every subject"
          action={
            hasSyllabi(profile) && (
              <div className="flex rounded-[10px] p-0.5" style={{ background: 'var(--surface-sunken)' }}>
                {[
                  ['ask', 'Ask'],
                  ['draft', 'Draft feedback'],
                  ['tools', 'Ideas'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors"
                    style={tab === key ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.12)' } : { color: 'var(--text-muted)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )
          }
        />

        {!hasSyllabi(profile) ? (
          <LockedPanel
            plan="Premium"
            title="A tutor for every subject"
            blurb="Ask Syllabi to explain a topic, set you a practice question and mark your answer, or read your IA draft against the criteria."
          />
        ) : tab === 'ask' ? (
          <TutorChat subjects={subjects} topicsFor={(s) => topicsBySubject[s] || []} />
        ) : tab === 'draft' ? (
          <DraftStudio subjects={subjects} />
        ) : (
          <SyllabiTools subjects={subjects} />
        )}
      </Page>
    </DashboardLayout>
  )
}
