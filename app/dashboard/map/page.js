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
import { accessibleSubjects, canUse, hasSyllabi } from '@/lib/access'

function SubjectMapPage() {
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [progress, setProgress] = useState([])
  // Quizzes, for Progress over time; and the moment the page loaded, so
  // "this week" is read once rather than on every render.
  const [attempts, setAttempts] = useState([])
  const [loadedAt, setLoadedAt] = useState(0)
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
      const subjects = accessibleSubjects(profileData).filter((s) => !IB_CORE_SUBJECTS.includes(s))
      const [syllabusRows, { data: progressRows }, { data: attemptRows }] = await Promise.all([
        getSyllabus(supabase, subjects),
        supabase.from('progress').select('subject, subtopic, status, mastery_points, updated_at, last_correct_at').eq('user_id', user.id),
        supabase.from('quiz_attempts').select('subject, subtopic, created_at, total_questions, score').eq('user_id', user.id).order('created_at').limit(5000),
      ])
      setRows(syllabusRows || [])
      setProgress(progressRows || [])
      setAttempts(attemptRows || [])
      setLoadedAt(Date.now())
      setLoading(false)
    }
    load()
  }, [router, supabase])

  // The subjects this plan opens: a free account maps its own subject, and
  // the rest wait for Basic (counted in the panel, not drawn).
  const subjects = useMemo(() => (profile ? accessibleSubjects(profile) : []).filter((s) => !IB_CORE_SUBJECTS.includes(s)), [profile])
  const lockedCount = (profile?.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s) && !subjects.includes(s)).length
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
  const heatmap = useMemo(() => {
    if (subject) return []
    // When each subtopic was first tested (its first quiz, or failing that
    // its progress row) and when it was last answered right, for the lines
    // over time.
    const firstQuiz = new Map()
    for (const a of attempts) {
      if (!a.subtopic) continue
      const k = progressKey(a.subject, a.subtopic)
      if (!firstQuiz.has(k)) firstQuiz.set(k, new Date(a.created_at).getTime())
    }
    const rowOf = new Map(progress.map((p) => [progressKey(p.subject, p.subtopic), p]))
    const ms = (v) => (v ? new Date(v).getTime() : null)
    return mergeSyllabusWithProgress(rows, buildEffectiveProgressMap(progress)).map((r) => {
      const k = progressKey(r.subject, r.subtopic)
      const p = rowOf.get(k)
      const updated = ms(p?.updated_at)
      const first = firstQuiz.get(k) ?? null
      return { ...r, testedAt: first != null && updated != null ? Math.min(first, updated) : first ?? updated, provedAt: ms(p?.last_correct_at) ?? updated }
    })
  }, [subject, rows, progress, attempts])

  // Today's standing, kept once a day so "proved" can be drawn from real
  // daily figures as they build up (093-progress-snapshots.sql).
  useEffect(() => {
    if (subject || !heatmap.length || !profile?.id) return
    const PROVED = new Set(['proficient', 'mastered'])
    const row = (subjectName, list) => ({ user_id: profile.id, subject: subjectName, total: list.length, tested: list.filter((i) => i.status !== 'not_started').length, proved: list.filter((i) => PROVED.has(i.status)).length })
    const bySubject = new Map()
    for (const i of heatmap) bySubject.set(i.subject, [...(bySubject.get(i.subject) || []), i])
    supabase
      .from('progress_snapshots')
      .upsert([row('', heatmap), ...[...bySubject].map(([s, list]) => row(s, list))], { onConflict: 'user_id,day,subject' })
      .then(({ error }) => error && console.warn('progress snapshot:', error.message))
  }, [subject, heatmap, profile?.id, supabase])

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
          attempts={attempts}
          now={loadedAt}
          name={profile.full_name || ''}
          locked={lockedCount}
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
