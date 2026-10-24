'use client'

/**
 * Analytics: loads the student's timer runs, quizzes and levels, and
 * components/analytics/AnalyticsView.js lays them out.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import AnalyticsView from '@/components/analytics/AnalyticsView'

export default function AnalyticsPage() {
  const [profile, setProfile] = useState(null)
  const [data, setData] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (data) return
    startLoading()
    return () => stopLoading()
  }, [data])

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
      // Two years back: a year on screen and the year before it to compare.
      const since = new Date()
      since.setFullYear(since.getFullYear() - 2)
      const [attempts, sessions, progress] = await Promise.all([
        supabase.from('quiz_attempts').select('completed_at, elapsed_seconds, subject, topic, subtopic, score, total_questions').eq('user_id', user.id).gte('completed_at', since.toISOString()),
        supabase.from('study_sessions').select('started_at, ended_at, subject, subtopic').eq('user_id', user.id).gte('started_at', since.toISOString()),
        supabase.from('progress').select('subject, subtopic, status').eq('user_id', user.id),
      ])
      setProfile(p)
      setData({ attempts: attempts.data || [], sessions: sessions.data || [], progress: progress.data || [], now: Date.now() })
    }
    load()
  }, [router, supabase])

  if (!data || !profile) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading
          title="Analytics"
          subtitle="Where your study time goes, what you have covered, and how it is going."
          width="wide"
          variant="analytics"
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <AnalyticsView attempts={data.attempts} sessions={data.sessions} progress={data.progress} profile={profile} now={data.now} />
    </DashboardLayout>
  )
}
