'use client'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'
import QuizRunner from '@/components/QuizRunner'

export default function QuizPage() {
  const { topicId } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const quizType = searchParams.get('type') || 'subtopic'
  const backHref = searchParams.get('back') || '/dashboard'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/login')
    })
  }, [router, supabase])

  return (
    <main className="page px-6 py-8">
      <div className="container-narrow">
        <AppHeader backHref={backHref} backLabel="Back" />
        <QuizRunner topicId={topicId} quizType={quizType} backHref={backHref} />
      </div>
    </main>
  )
}
