'use client'
import { useRouter, useParams } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'
import SyllabusViewer from '@/components/SyllabusViewer'
import {
  resolveOnboardingNameFromSlug,
  getDbSubjectName,
} from '@/lib/subject-map'

export default function SyllabusPage() {
  const { slug } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const onboardingName = resolveOnboardingNameFromSlug(slug)
  const dbName = onboardingName ? getDbSubjectName(onboardingName) : null

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login')
    })
  }, [])

  if (!onboardingName || !dbName) {
    return (
      <main className="page px-6 py-8">
        <div className="container-narrow">
          <AppHeader backHref="/dashboard" backLabel="Dashboard" />
          <div className="card card-pad text-center">
            <p className="text-text-muted text-sm">Subject not found.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page px-6 py-8">
      <div className="container-narrow">
        <AppHeader backHref="/dashboard" backLabel="Dashboard" />
        <SyllabusViewer subjectName={dbName} />
      </div>
    </main>
  )
}
