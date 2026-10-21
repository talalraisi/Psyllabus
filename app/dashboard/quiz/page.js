'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import QuizRunner from '@/components/QuizRunner'
import { Page } from '@/components/PageShell'
import { IconArrowLeft } from '@/components/Icons'

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
  // A hundred at most, however the length was asked for.
  const count = Math.min(100, parseInt(searchParams.get('count') || '0', 10)) || undefined
  const topicsParam = searchParams.get('topics')
  const topics = topicsParam ? topicsParam.split('~~') : undefined
  const subjectsParam = searchParams.get('subjects')
  const subjects = subjectsParam ? subjectsParam.split('~~') : undefined
  const timed = searchParams.get('timed') === '1' && searchParams.get('sit') !== 'test' && searchParams.get('sit') !== 'practice'
  const focus = searchParams.get('focus') || null
  const difficulty = searchParams.get('difficulty') || null
  const level = searchParams.get('level') || null
  const paper = searchParams.get('paper') || null
  const qtype = searchParams.get('qtype') || null
  const order = searchParams.get('order') || null
  // The builder sets these; nothing was reading them, so picking subtopics,
  // asking to be marked as you go, turning hints off and setting your own time
  // limit all silently did nothing.
  const subtopicsParam = searchParams.get('subtopics')
  const subtopics = subtopicsParam ? subtopicsParam.split('~~') : undefined
  /**
   * How it is sat: exam (countdown, marked at the end, no hints), test
   * (stopwatch, marked at the end, timings on the results) or practice (no
   * clock, marked as you go). Older links say it with review and timed.
   */
  const sitParam = searchParams.get('sit')
  const sit = ['exam', 'test', 'practice'].includes(sitParam)
    ? sitParam
    : searchParams.get('review') === 'practice'
      ? 'practice'
      : searchParams.get('timed') === '1'
        ? 'exam'
        : null
  const review = sit === 'practice' ? 'practice' : sit ? 'exam' : searchParams.get('review') || 'exam'
  const hintsAllowed = sit ? sit === 'practice' : searchParams.get('hints') !== '0'
  const minutes = parseInt(searchParams.get('minutes') || '0', 10) || null

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
      <DashboardLayout profile={null}>
        <Page width="narrow">
          <span className="sr-only" role="status" aria-live="polite">
            Loading quiz
          </span>
        </Page>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout profile={profile}>
      <Page width="narrow">
        <button
          onClick={() => router.push(backHref)}
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors duration-150 hover:text-[var(--text)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <IconArrowLeft width={13} height={13} />
          Back
        </button>
        <QuizRunner
          subject={subject}
          topic={topic}
          subtopic={subtopic}
          mode={mode}
          count={count}
          topics={topics}
          subjects={subjects}
          timed={timed}
          focus={focus}
          difficulty={difficulty}
          level={level}
          paper={paper}
          qtype={qtype}
          order={order}
          subtopics={subtopics}
          review={review}
          sit={sit}
          hintsAllowed={hintsAllowed}
          minutes={minutes}
          backHref={backHref}
        />
      </Page>
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
