'use client'

/**
 * The subject map, with the screen to itself.
 *
 * Reads the subject's real syllabus and the student's own progress, builds
 * the tree once (lib/subject-graph.js) and hands it to the map
 * (components/map). ?subject= picks the subject and ?at= the level or
 * subtopic, so any part of the map can be linked to.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import SubjectMap from '@/components/map/SubjectMap'
import LockedPanel from '@/components/LockedPanel'
import { Page, PageHeader, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { progressKey } from '@/lib/progress'
import { buildEffectiveProgressMap, buildProgressDetailMap } from '@/lib/decay'
import { buildGraph } from '@/lib/subject-graph'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { canUse, hasSyllabi } from '@/lib/access'

function SubjectMapPage() {
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const wanted = params.get('subject') || ''
  // Read once: afterwards the map keeps the address up to date itself.
  const [initialAt] = useState(() => params.get('at'))

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
        supabase.from('progress').select('subject, subtopic, status, mastery_points, updated_at, last_correct_at').eq('user_id', user.id),
      ])
      setRows(syllabusRows || [])
      setProgress(progressRows || [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const subjects = useMemo(() => (profile?.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s)), [profile])
  const subject = subjects.includes(wanted) ? wanted : subjects[0] || ''

  const graph = useMemo(() => {
    if (!subject) return null
    return buildGraph({
      subject,
      rows: rows.filter((r) => r.subject === subject),
      details: buildProgressDetailMap(progress),
      effective: buildEffectiveProgressMap(progress),
      key: progressKey,
    })
  }, [subject, rows, progress])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Subject map" variant="map" />
      </DashboardLayout>
    )
  }

  const allowed = canUse('subjectMap', profile)
  const empty = !graph || graph.nodes.get(graph.rootId).childIds.length === 0

  if (!allowed || empty) {
    return (
      <DashboardLayout profile={profile}>
        <Page width="wide">
          <PageHeader title="Subject map" subtitle="Every topic, unit and subtopic, and where you stand on each." />
          {!allowed ? (
            <LockedPanel
              plan="Premium"
              title="Your whole course as one map"
              blurb="Each subject as a map you can walk into: topics, then units, then the subtopics themselves, each showing what you have proved. Select anything to see where you stand and practise it."
            />
          ) : (
            <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {subjects.length ? `Nothing is mapped for ${subject} yet.` : 'Pick your subjects first and the map will have something to draw.'}{' '}
              <Link href="/dashboard/subjects" className="font-medium underline underline-offset-2" style={{ color: 'var(--text)' }}>
                My subjects
              </Link>
            </p>
          )}
        </Page>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <div className="h-[calc(100dvh-56px)] md:h-dvh">
        <SubjectMap
          key={subject}
          graph={graph}
          subjects={subjects}
          syllabi={hasSyllabi(profile)}
          initialAt={subject === wanted ? initialAt : null}
          onSubject={(s) => router.replace(`/dashboard/map?subject=${encodeURIComponent(s)}`, { scroll: false })}
        />
      </div>
    </DashboardLayout>
  )
}

export default function Page_() {
  return (
    <Suspense fallback={null}>
      <SubjectMapPage />
    </Suspense>
  )
}
