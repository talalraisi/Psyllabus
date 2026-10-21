'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { RedemptionView } from '@/components/Redemption'

/** Redemption: loads the bank, and components/Redemption.js lays it out. */
export default function MistakeBankPage() {
  const [profile, setProfile] = useState(null)
  const [mistakes, setMistakes] = useState([])
  /**
   * The clock, read once when the data arrives rather than on every render,
   * so "due" means due as of the moment this page loaded and the server and
   * browser never disagree about it.
   */
  const [loadedAt, setLoadedAt] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
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

      const { data: rows } = await supabase
        .from('mistakes')
        .select('*, questions(stem, subject, topic, subtopic)')
        .eq('user_id', user.id)
        .order('next_review_at', { ascending: true })

      setMistakes((rows || []).filter((r) => r.questions))
      setLoadedAt(Date.now())
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading || !profile) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Redemption" width="default" rows={4} variant="redemption" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <RedemptionView mistakes={mistakes} now={loadedAt ?? 0} />
    </DashboardLayout>
  )
}
