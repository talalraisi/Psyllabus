'use client'

/**
 * Every to-do in one place.
 *
 * The same list as on the home page, the study plan and the calendar
 * (lib/todos.js), with room for all of it: grouped by when it is due,
 * filterable by subject, with what is done kept below.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading } from '@/components/PageShell'
import TodoList from '@/components/TodoList'
import { accessibleSubjects } from '@/lib/access'

export default function TodoPage() {
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
        <PageLoading title="To-do" rows={5} />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <Page width="narrow">
        <PageHeader title="To-do" subtitle="Everything that is not a test: coursework steps, forms, things to print. Dated tasks show on your calendar too." />
        <TodoList title="All to-dos" subjects={accessibleSubjects(profile)} />
      </Page>
    </DashboardLayout>
  )
}
