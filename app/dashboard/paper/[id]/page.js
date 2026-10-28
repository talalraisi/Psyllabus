'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import { isSubjectLocked } from '@/lib/access'
import { getSlugForSubject } from '@/lib/subject-map'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageLoading, EmptyState } from '@/components/PageShell'
import PaperSitting from '@/components/papers/PaperSitting'

/**
 * A predicted paper: loading it, checking the student may sit it, and
 * keeping their attempt. An unfinished attempt from the last day is picked
 * up where it was left, so closing the tab mid-paper loses nothing.
 */
function PaperPage() {
  const { id } = useParams()
  const params = useSearchParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)
  const [paper, setPaper] = useState(null)
  const [attempt, setAttempt] = useState(undefined)
  const [missing, setMissing] = useState(false)
  const attemptId = useRef(null)
  const userId = useRef(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      const user = await getCurrentUser(supabase)
      if (!user) return router.push('/login')
      const p = await getProfile(supabase, user.id)
      if (!p) return router.push('/onboarding')
      const [{ data: row }, { data: last }] = await Promise.all([
        supabase.from('exam_papers').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('paper_attempts')
          .select('*')
          .eq('paper_id', id)
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (!live) return
      if (!row) return setMissing(true)
      if (isSubjectLocked(row.subject, p)) return router.push('/dashboard/profile#unlock')
      userId.current = user.id
      setProfile(p)
      setPaper(row)
      // Unfinished and recent: carry on. Otherwise a fresh sitting.
      const resumable = last && !last.submitted_at && Date.now() - new Date(last.started_at).getTime() < 86400000
      if (resumable) attemptId.current = last.id
      setAttempt(resumable ? last : null)
    })()
    return () => {
      live = false
    }
  }, [id, router, supabase])

  const save = useCallback(
    async (patch) => {
      if (patch.start) {
        const mode = ['exam', 'stopwatch', 'practice'].includes(patch.mode) ? patch.mode : 'exam'
        const { data } = await supabase.from('paper_attempts').insert({ user_id: userId.current, paper_id: id, total: paper?.marks, mode }).select('id').single()
        attemptId.current = data?.id || null
        return
      }
      if (!attemptId.current) return
      const row = {}
      if (patch.answers) row.answers = patch.answers
      if (patch.chosen) row.chosen = patch.chosen
      if (patch.marks) row.marks = patch.marks
      if (patch.score != null) row.score = patch.score
      if (patch.total != null) row.total = patch.total
      if (patch.submitted) row.submitted_at = new Date().toISOString()
      if (patch.seconds_used != null) row.seconds_used = patch.seconds_used
      await supabase.from('paper_attempts').update(row).eq('id', attemptId.current)
    },
    [supabase, id, paper]
  )

  if (missing) {
    return (
      <DashboardLayout profile={profile}>
        <Page>
          <EmptyState title="This paper is not available" description="It may still be being checked." />
        </Page>
      </DashboardLayout>
    )
  }
  if (!paper || attempt === undefined) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Paper" variant="paper" />
      </DashboardLayout>
    )
  }

  // Back to wherever the paper was opened from: a subject's page (a slug),
  // or the Exam papers page (a path).
  const back = params.get('back') || getSlugForSubject(paper.subject)
  const fromPapers = back.startsWith('/dashboard/')
  return (
    <DashboardLayout profile={profile}>
      <Page>
        <PaperSitting paper={paper} initial={attempt} onSave={save} backHref={fromPapers ? back : `/dashboard/syllabus/${back}`} backLabel={fromPapers ? 'Exam papers' : paper.subject} />
      </Page>
    </DashboardLayout>
  )
}

export default function PaperRoute() {
  return (
    <Suspense fallback={null}>
      <PaperPage />
    </Suspense>
  )
}
