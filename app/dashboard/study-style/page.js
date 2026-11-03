'use client'

/**
 * How you study best: nine questions, then your study type, the methods it
 * is made of, and a plan set up to match (lib/study-style.js,
 * components/StudyStyle.js).
 *
 * The answers are kept on the profile so the result is here next time. The
 * plan only changes when the student says so.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, invalidateProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageLoading } from '@/components/PageShell'
import StudyStyle from '@/components/StudyStyle'
import { resultOf, applyTo } from '@/lib/study-style'

export default function StudyStylePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      const user = await getCurrentUser(supabase)
      if (!user) return router.push('/login')
      const p = await getProfile(supabase, user.id)
      if (!p) return router.push('/onboarding')
      if (live) setProfile(p)
    })()
    return () => {
      live = false
    }
  }, [router, supabase])

  if (!profile) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="How you study" rows={3} />
      </DashboardLayout>
    )
  }

  // After the loading return: it reads profile.id, and the compiler works
  // out what it depends on as soon as it is defined.
  // Read fresh each time: the plan page may have changed settings meanwhile.
  const save = async (change) => {
    const { data } = await supabase.from('profiles').select('plan_settings').eq('id', profile.id).maybeSingle()
    const plan_settings = change(data?.plan_settings || profile.plan_settings || {})
    const { error } = await supabase.from('profiles').update({ plan_settings }).eq('id', profile.id)
    if (error) return false
    invalidateProfile(profile.id)
    setProfile((p) => ({ ...p, plan_settings }))
    return true
  }

  const saved = profile.plan_settings?.studyStyle
  return (
    <DashboardLayout profile={profile}>
      <Page>
        <StudyStyle
          initialAnswers={saved?.answers || null}
          initialApplied={Boolean(saved?.applied)}
          onResult={(answers) => save((ps) => ({ ...ps, studyStyle: { answers, type: resultOf(answers).type, at: new Date().toISOString() } }))}
          onApply={(answers) =>
            save((ps) => {
              const next = applyTo(ps, answers)
              next.studyStyle.applied = true
              return next
            })
          }
        />
      </Page>
    </DashboardLayout>
  )
}
