'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'

function relativeDue(nextReviewAt, now = Date.now()) {
  const diff = new Date(nextReviewAt).getTime() - now
  if (diff <= 0) return 'Due now'
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  return days === 1 ? 'Due tomorrow' : `Due in ${days} days`
}

function ListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl p-5 border border-[#f0f0f0] space-y-2">
          <div className="h-4 w-1/3 bg-[#f3f4f6] rounded" />
          <div className="h-4 w-2/3 bg-[#f3f4f6] rounded" />
        </div>
      ))}
    </div>
  )
}

export default function MistakeBankPage() {
  const [profile, setProfile] = useState(null)
  const [mistakes, setMistakes] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser(supabase)
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
      setProfile(profileData)

      const { data: rows } = await supabase
        .from('mistakes')
        .select('*, questions(stem, subject, topic, subtopic)')
        .eq('user_id', user.id)
        .order('next_review_at', { ascending: true })

      setMistakes((rows || []).filter((r) => r.questions))
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] px-12 py-10">
        <ListSkeleton />
      </div>
    )
  }

  const now = Date.now()
  const due = mistakes.filter((m) => new Date(m.next_review_at).getTime() <= now)

  const bySubject = mistakes.reduce((acc, m) => {
    const subject = m.questions.subject || 'Other'
    ;(acc[subject] ||= []).push(m)
    return acc
  }, {})

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="t-page-title mb-1">Mistake Bank</h1>
          <p className="text-sm text-[#6b7280]">
            Every wrong answer becomes a spaced-repetition review, so you drill your own
            failures instead of generic flashcards
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-8 max-w-md">
          <div className="surface p-5">
            <p className="t-stat text-[#d97706]">{due.length}</p>
            <p className="text-sm text-[#6b7280] mt-1">Due for review</p>
          </div>
          <div className="surface p-5">
            <p className="t-stat text-[#1a2e1e]">{mistakes.length}</p>
            <p className="text-sm text-[#6b7280] mt-1">Total logged</p>
          </div>
        </div>

        {due.length > 0 ? (
          <Link
            href="/dashboard/quiz?mode=mistakes&back=/dashboard/mistakes"
            className="inline-block mb-10 px-6 btn btn-solid control-md"
          >
            Review {due.length} due mistake{due.length !== 1 ? 's' : ''}
          </Link>
        ) : mistakes.length > 0 ? (
          <p className="mb-10 text-sm text-[#6b7280]">
            Nothing due right now. Your next review unlocks automatically.
          </p>
        ) : null}

        {mistakes.length === 0 ? (
          <div className="surface p-10 text-center">
            <h2 className="text-base font-semibold text-[#1a2e1e]">No mistakes logged yet</h2>
            <p className="text-sm text-[#6b7280] mt-2">
              Take a quiz from any syllabus subtopic and wrong answers land here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(bySubject).map(([subject, items]) => (
              <section key={subject}>
                <h2 className="t-overline mb-3">
                  {subject}
                </h2>
                <div className="surface divide-y divide-[#f3f4f6]">
                  {items.map((m) => {
                    const isDue = new Date(m.next_review_at).getTime() <= now
                    return (
                      <div key={m.id} className="px-5 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#9ca3af]">{m.questions.subtopic}</p>
                          <p className="text-sm text-[#374151] truncate">{m.questions.stem}</p>
                        </div>
                        <span className="shrink-0 text-xs text-[#9ca3af]">
                          {m.review_count > 0
                            ? `${m.review_count} correct review${m.review_count !== 1 ? 's' : ''}`
                            : 'Not yet recovered'}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full ${
                            isDue
                              ? 'bg-[#fef3c7] text-[#d97706]'
                              : 'bg-[#f3f4f6] text-[#6b7280]'
                          }`}
                        >
                          {relativeDue(m.next_review_at, now)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
