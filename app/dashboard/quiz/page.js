'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import QuizRunner from '@/components/QuizRunner'

function QuizPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const subject = searchParams.get('subject') || ''
  const topic = searchParams.get('topic') || ''
  const subtopic = searchParams.get('subtopic') || ''
  const mode = searchParams.get('mode') || 'subtopic'
  const backHref = searchParams.get('back') || '/dashboard'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (!profileData) {
        router.push('/onboarding')
        return
      }
      if (mode !== 'mistakes' && !profileData.subjects?.includes(subject)) {
        router.push('/dashboard')
        return
      }
      setProfile(profileData)
      setLoading(false)
    }
    load()
  }, [router, supabase, subject, mode])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading quiz…</p>
      </div>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-2xl mx-auto">
        <button
          onClick={() => router.push(backHref)}
          className="text-sm font-medium text-[#2D6A4F] mb-6 hover:underline"
        >
          ← Back
        </button>
        <QuizRunner
          subject={subject}
          topic={topic}
          subtopic={subtopic}
          mode={mode}
          backHref={backHref}
        />
      </div>
    </DashboardLayout>
  )
}

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizPageInner />
    </Suspense>
  )
}
