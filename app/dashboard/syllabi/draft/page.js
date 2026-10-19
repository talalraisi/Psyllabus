'use client'

/**
 * The draft studio, with the screen to itself: a page to write on and the
 * marking beside it (components/syllabi/DraftStudio.js). Premium, like the
 * route behind it, which checks again.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import LockedPanel from '@/components/LockedPanel'
import { Page, PageLoading } from '@/components/PageShell'
import DraftStudio from '@/components/syllabi/DraftStudio'
import { hasSyllabi } from '@/lib/access'

export default function DraftStudioPage() {
  const [profile, setProfile] = useState(null)
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
      setProfile(p)
    }
    load()
  }, [router, supabase])

  if (!profile) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Draft feedback" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      {hasSyllabi(profile) ? (
        <DraftStudio subjects={profile.subjects || []} />
      ) : (
        <Page>
          <LockedPanel
            plan="Premium"
            title="Your draft, marked"
            blurb="Paste an IA, EE or TOK essay and see it marked against the criteria, with a likely grade and comments pinned to your own sentences."
          />
        </Page>
      )}
    </DashboardLayout>
  )
}
