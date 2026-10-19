'use client'

/**
 * Syllabi: ask it anything, get a draft marked, or get ideas.
 *
 * Ask and Ideas live here; the draft studio has the screen to itself
 * (/dashboard/syllabi/draft). An idea can be picked up and talked through,
 * which opens Ask with the question already written.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import LockedPanel from '@/components/LockedPanel'
import SyllabiMark from '@/components/SyllabiMark'
import { Page, PageLoading } from '@/components/PageShell'
import TutorChat from '@/components/syllabi/TutorChat'
import IdeasStudio from '@/components/syllabi/IdeasStudio'
import { hasSyllabi } from '@/lib/access'

/**
 * Ask fills the screen so the box sits at the bottom of it; Ideas scrolls
 * like any page. The bottom room on narrower screens is for the floating
 * feedback button. Defined out here so the chat is not remounted on render.
 */
function Shell({ full, children }) {
  return full ? (
    <div className="app-enter mx-auto flex h-[calc(100dvh-56px)] w-full max-w-6xl flex-col px-4 pb-[76px] pt-4 md:h-dvh md:px-10 md:pt-6 lg:pb-5">{children}</div>
  ) : (
    <Page width="wide">{children}</Page>
  )
}

export default function SyllabiPage() {
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [tab, setTab] = useState('ask')
  const [seed, setSeed] = useState({ n: 0, subject: '', text: '' })
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
  const allowed = hasSyllabi(profile)
  const tabStyle = (on) =>
    on ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.12)' } : { color: 'var(--text-muted)' }

  return (
    <DashboardLayout profile={profile}>
      <Shell full={allowed && tab === 'ask'}>
        <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-0.025em]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
              <SyllabiMark size={15} />
            </span>
            Syllabi
          </h1>
          {allowed && (
            <nav className="flex rounded-full p-1" style={{ background: 'var(--surface-sunken)' }} aria-label="Syllabi tools">
              <button type="button" onClick={() => setTab('ask')} aria-pressed={tab === 'ask'} className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors" style={tabStyle(tab === 'ask')}>
                Ask
              </button>
              <Link href="/dashboard/syllabi/draft" className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors hover:text-[var(--text)]" style={tabStyle(false)}>
                Draft feedback
              </Link>
              <button type="button" onClick={() => setTab('ideas')} aria-pressed={tab === 'ideas'} className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors" style={tabStyle(tab === 'ideas')}>
                Ideas
              </button>
            </nav>
          )}
        </div>

        {!allowed ? (
          <LockedPanel
            plan="Premium"
            title="A tutor for every subject"
            blurb="Ask Syllabi to explain a topic, read a photo of a question, set you practice and mark your answer, or mark your IA draft against the criteria."
          />
        ) : tab === 'ask' ? (
          <TutorChat
            key={seed.n}
            subjects={subjects}
            topicsFor={(s) => topicsBySubject[s] || []}
            initialSubject={seed.subject}
            initialInput={seed.text}
          />
        ) : (
          <IdeasStudio
            subjects={subjects}
            userId={profile.id}
            onTalk={({ subject, text }) => {
              setSeed((s) => ({ n: s.n + 1, subject, text }))
              setTab('ask')
            }}
          />
        )}
      </Shell>
    </DashboardLayout>
  )
}
