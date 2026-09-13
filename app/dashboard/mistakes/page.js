'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { displaySubtopic } from '@/lib/progress'
import { Page, PageHeader, EmptyState, PageLoading } from '@/components/PageShell'

function relativeDue(nextReviewAt, now = Date.now()) {
  const diff = new Date(nextReviewAt).getTime() - now
  if (diff <= 0) return 'Due now'
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  return days === 1 ? 'Tomorrow' : days <= 7 ? `In ${days} days` : `In ${Math.round(days / 7)} weeks`
}

export default function MistakeBankPage() {
  const [profile, setProfile] = useState(null)
  const [picked, setPicked] = useState([])
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
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  if (loading || !profile) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Mistake Bank" width="default" rows={4} variant="mistakes" />
      </DashboardLayout>
    )
  }

  const now = Date.now()
  const due = mistakes.filter((m) => new Date(m.next_review_at).getTime() <= now)

  const bySubject = mistakes.reduce((acc, m) => {
    const subject = m.questions.subject || 'Other'
    ;(acc[subject] ||= []).push(m)
    return acc
  }, {})

  const subjects = Object.keys(bySubject).sort()
  // Nothing picked means everything, which is the state you want on arrival:
  // the page should not make you choose before it shows you anything.
  const scope = picked.length ? picked : subjects
  const inScope = mistakes.filter((m) => scope.includes(m.questions.subject || 'Other'))
  const dueInScope = inScope.filter((m) => new Date(m.next_review_at).getTime() <= now)

  const toggle = (subject) =>
    setPicked((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    )

  const reviewHref =
    picked.length && picked.length < subjects.length
      ? `/dashboard/quiz?mode=mistakes&subjects=${encodeURIComponent(picked.join('~~'))}&back=/dashboard/mistakes`
      : '/dashboard/quiz?mode=mistakes&back=/dashboard/mistakes'

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Mistake Bank"
          subtitle="Every wrong answer comes back on a schedule until you have it three times running"
          action={
            dueInScope.length > 0 ? (
              <Link href={reviewHref} className="btn btn-solid control-md">
                Review {dueInScope.length}
              </Link>
            ) : null
          }
        />

        {mistakes.length === 0 ? (
          <EmptyState
            title="No mistakes logged yet"
            description="Take a quiz from any syllabus subtopic and wrong answers land here automatically, on a schedule that brings each one back until you have it three times running."
          />
        ) : (
          <>
            {/* Pick the subjects to work on. The review button follows the
                picker, so "only Physics tonight" is one tap rather than a
                different page. */}
            {subjects.length > 1 && (
              <div className="mb-10 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPicked([])}
                  aria-pressed={picked.length === 0}
                  className={`control-sm rounded-full border px-4 text-[13px] font-medium transition-colors duration-150 ${
                    picked.length === 0
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                      : 'border-[var(--border-strong)] text-[var(--text-body)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  All subjects
                </button>
                {subjects.map((subject) => {
                  const dueHere = bySubject[subject].filter(
                    (m) => new Date(m.next_review_at).getTime() <= now
                  ).length
                  const on = picked.includes(subject)
                  return (
                    <button
                      key={subject}
                      onClick={() => toggle(subject)}
                      aria-pressed={on}
                      className={`control-sm rounded-full border px-4 text-[13px] font-medium transition-colors duration-150 ${
                        on
                          ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                          : 'border-[var(--border-strong)] text-[var(--text-body)] hover:border-[var(--border-hover)]'
                      }`}
                    >
                      {subject}
                      <span className="ml-2 tabular-nums opacity-60">
                        {dueHere > 0 ? `${dueHere} due` : bySubject[subject].length}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* The three numbers used to take a screen on their own. Same
                figures, one line, above the thing you came here to do. */}
            <p
              className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px] tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>
                <strong
                  className="font-semibold"
                  style={{ color: dueInScope.length ? 'var(--status-fading)' : 'var(--text)' }}
                >
                  {dueInScope.length}
                </strong>{' '}
                due now
              </span>
              <span>
                <strong className="font-semibold" style={{ color: 'var(--text)' }}>
                  {inScope.length}
                </strong>{' '}
                in the bank
              </span>
              <span>
                <strong className="font-semibold" style={{ color: 'var(--status-proficient)' }}>
                  {inScope.filter((m) => m.review_count > 0).length}
                </strong>{' '}
                on their way out
              </span>
            </p>

            {dueInScope.length === 0 && (
              <p className="mb-8 text-[14px]" style={{ color: 'var(--text-faint)' }}>
                Nothing due here right now. The next one unlocks on its own.
              </p>
            )}

            <ul className="flex flex-col">
              {inScope.map((m) => {
                const isDue = new Date(m.next_review_at).getTime() <= now
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-4 border-b py-3.5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        background: isDue ? 'var(--status-fading)' : 'var(--border-strong)',
                      }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                        {m.questions.subject} · {displaySubtopic(m.questions.subtopic)}
                      </p>
                      <p className="mt-0.5 truncate text-[14px]" style={{ color: 'var(--text-body)' }}>
                        {m.questions.stem}
                      </p>
                    </div>
                    <span
                      className="hidden shrink-0 text-[12px] tabular-nums sm:block"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {m.review_count > 0 ? `${m.review_count}/3 recovered` : 'not yet'}
                    </span>
                    <span
                      className="w-[74px] shrink-0 text-right text-[12.5px] font-medium tabular-nums"
                      style={{ color: isDue ? 'var(--status-fading)' : 'var(--text-muted)' }}
                    >
                      {relativeDue(m.next_review_at, now)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Page>
    </DashboardLayout>
  )
}
