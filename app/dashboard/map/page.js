'use client'

/**
 * The map, with the screen to itself.
 *
 * It began as a panel that unfolded inside the progress list, which is the
 * wrong shape for it twice over: a square diagram in a column is small, and
 * a diagram you walk down into wants the back button to mean something. Here
 * it gets the height of the window and a subject to switch between, and the
 * row on the progress page is a link rather than a fold-out.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import SubjectWeb from '@/components/SubjectWeb'
import LockedPanel from '@/components/LockedPanel'
import { Page, PageHeader } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { mergeSyllabusWithProgress } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { canUse } from '@/lib/access'

function SubjectMap() {
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')

  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const wanted = params.get('subject') || ''

  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })
      if (!profileData) {
        router.push('/onboarding')
        return
      }
      setProfile(profileData)

      // The core has no subtopics to quiz, so it has no map. It has its page.
      const subjects = (profileData.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s))
      const [syllabusRows, { data: progressRows }] = await Promise.all([
        getSyllabus(supabase, subjects),
        supabase.from('progress').select('*').eq('user_id', user.id),
      ])
      const merged = mergeSyllabusWithProgress(
        syllabusRows || [],
        buildEffectiveProgressMap(progressRows)
      )
      setItems(merged)
      // The link said which subject; if it said nothing, or said one that is
      // not theirs, open the first one they actually have.
      const open = subjects.includes(wanted) ? wanted : subjects[0] || ''
      setSubject(open)
      setLoading(false)
    }
    load()
  }, [router, supabase, wanted])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-muted)]">Loading your map…</p>
      </div>
    )
  }

  const subjects = (profile.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s))
  const rows = items.filter((i) => i.subject === subject)
  const allowed = canUse('subjectMap', profile)

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title="Subject map"
          subtitle="Your course as a web: themes, then units, then the subtopics themselves."
        />

        <Link
          href="/dashboard/progress"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: 'var(--brand)' }}
        >
          <span aria-hidden="true">&larr;</span>
          Back to progress
        </Link>

        {!allowed ? (
          <LockedPanel
            plan="Premium"
            title="Your whole course as one picture"
            blurb="Your course as a web you can walk into: themes, then units, then the subtopics themselves, each wearing a ring of what you have proved. Click a subtopic and you are in a quiz on it."
          />
        ) : subjects.length === 0 ? (
          <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
            Pick your subjects first and the map will have something to draw.
          </p>
        ) : (
          <>
            {/* Switching subject here rather than going back for it. */}
            {subjects.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={
                      s === subject ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {rows.length === 0 ? (
              <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
                Nothing mapped for {subject} yet.
              </p>
            ) : (
              <SubjectWeb
                key={subject}
                subject={subject}
                rows={rows}
                fill
                onPickSubtopic={(row) => {
                  // Encoded whole, because this one carries a query of its
                  // own and would otherwise come back as half a URL.
                  const back = encodeURIComponent(
                    `/dashboard/map?subject=${encodeURIComponent(row.subject)}`
                  )
                  router.push(
                    `/dashboard/quiz?subject=${encodeURIComponent(row.subject)}&topic=${encodeURIComponent(row.topic)}&subtopic=${encodeURIComponent(row.subtopic)}&count=5&review=practice&back=${back}`
                  )
                }}
              />
            )}
          </>
        )}
      </Page>
    </DashboardLayout>
  )
}

export default function SubjectMapPage() {
  return (
    <Suspense fallback={null}>
      <SubjectMap />
    </Suspense>
  )
}
