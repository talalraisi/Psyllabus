'use client'

/**
 * The subject map, with the screen to itself.
 *
 * Reads the subject's real syllabus and the student's own progress, builds
 * the tree once (lib/subject-graph.js) and hands it to the map
 * (components/map). With no ?subject= it opens on you, every subject circling
 * you (YouMap); ?subject= opens that subject and ?at= the level or subtopic,
 * so any part of the map can be linked to.
 */

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import SubjectMap from '@/components/map/SubjectMap'
import YouMap from '@/components/map/YouMap'
import LockedPanel from '@/components/LockedPanel'
import { Page, PageHeader, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { progressKey, mergeSyllabusWithProgress } from '@/lib/progress'
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
  // Where in the subject to land. The map keeps the address up to date
  // itself afterwards; it is keyed by subject, so only the value it opens
  // with counts.
  const initialAt = params.get('at')

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
  // No subject asked for: the overview of you, every subject round you.
  const subject = subjects.includes(wanted) ? wanted : ''

  const graphs = useMemo(() => {
    const details = buildProgressDetailMap(progress)
    const effective = buildEffectiveProgressMap(progress)
    return subjects
      .map((s) => ({ subject: s, graph: buildGraph({ subject: s, rows: rows.filter((r) => r.subject === s), details, effective, key: progressKey }) }))
      .filter((g) => g.graph.nodes.get(g.graph.rootId).childIds.length > 0)
  }, [subjects, rows, progress])
  const graph = subject ? graphs.find((g) => g.subject === subject)?.graph || null : null

  // Every subtopic with its status, for the counts and the squares under the orbit.
  const heatmap = useMemo(() => (subject ? [] : mergeSyllabusWithProgress(rows, buildEffectiveProgressMap(progress))), [subject, rows, progress])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title={wanted ? 'Subject map' : 'Progress'} variant="map" />
      </DashboardLayout>
    )
  }

  const allowed = canUse('subjectMap', profile)
  const empty = subject ? !graph : graphs.length === 0

  if (!allowed || empty) {
    return (
      <DashboardLayout profile={profile}>
        <Page width="wide">
          <PageHeader title={subject ? 'Subject map' : 'Progress'} subtitle="Every topic, unit and subtopic, and where you stand on each." />
          {!allowed ? (
            <LockedPanel
              plan="Premium"
              title="Your whole course as one map"
              blurb="Each subject as a map you can walk into: topics, then units, then the subtopics themselves, each showing what you have proved. Select anything to see where you stand and practise it."
            />
          ) : (
            <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {subjects.length ? `Nothing is mapped for ${subject || 'your subjects'} yet.` : 'Pick your subjects first and the map will have something to draw.'}{' '}
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
      {graph ? (
        <div className="h-[calc(100dvh-56px)] md:h-dvh">
          <SubjectMap
            key={subject}
            graph={graph}
            subjects={graphs.map((g) => g.subject)}
            syllabi={hasSyllabi(profile)}
            initialAt={initialAt}
            onSubject={(s) => router.replace(`/dashboard/map?subject=${encodeURIComponent(s)}`, { scroll: false })}
            onOverview={() => router.push('/dashboard/map', { scroll: false })}
          />
        </div>
      ) : (
        <YouMap
          graphs={graphs}
          items={heatmap}
          name={profile.full_name || ''}
          onOpen={(s, at) => router.push(`/dashboard/map?subject=${encodeURIComponent(s)}${at ? `&at=${encodeURIComponent(at)}` : ''}`)}
        />
      )}
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
