'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { displaySubtopic } from '@/lib/progress'
import { Page, PageHeader, Section, StatRow, EmptyState, PageLoading } from '@/components/PageShell'
import { IconChevronRight } from '@/components/Icons'

function relativeDue(nextReviewAt, now = Date.now()) {
  const diff = new Date(nextReviewAt).getTime() - now
  if (diff <= 0) return 'Due now'
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  return days === 1 ? 'Due tomorrow' : `Due in ${days} days`
}

export default function MistakeBankPage() {
  const [profile, setProfile] = useState(null)
  const [expanded, setExpanded] = useState({})
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

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Mistake Bank"
          subtitle="Every wrong answer becomes a spaced review, so you drill your own failures rather than generic cards"
          action={
            due.length > 0 ? (
              <Link
                href="/dashboard/quiz?mode=mistakes&back=/dashboard/mistakes"
                className="btn btn-solid control-md"
              >
                Review {due.length} due
              </Link>
            ) : null
          }
        />

        <StatRow
          className="mb-12"
          stats={[
            { label: 'due for review', value: due.length, tone: due.length ? 'var(--status-fading)' : 'var(--text)' },
            { label: 'logged in total', value: mistakes.length },
            {
              label: 'cleared so far',
              value: mistakes.filter((m) => m.review_count >= 3).length,
              tone: 'var(--status-proficient)',
            },
          ]}
        />

        {mistakes.length === 0 ? (
          <EmptyState
            title="No mistakes logged yet"
            description="Take a quiz from any syllabus subtopic and wrong answers land here automatically, on a schedule that brings each one back until you have it three times running."
          />
        ) : (
          <>
            {due.length === 0 && (
              <p className="mb-10 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                Nothing due right now. Your next review unlocks on its own.
              </p>
            )}

            {Object.entries(bySubject).map(([subject, items]) => {
              const dueHere = items.filter(
                (m) => new Date(m.next_review_at).getTime() <= now
              ).length
              const open = !!expanded[subject]

              return (
                <Section
                  key={subject}
                  title={
                    <button
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [subject]: !prev[subject] }))
                      }
                      aria-expanded={open}
                      className="flex items-center gap-2 text-left"
                    >
                      <IconChevronRight
                        width={13}
                        height={13}
                        className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--text-faint)' }}
                      />
                      <span className="text-[15px] font-semibold tracking-[-0.012em]">{subject}</span>
                    </button>
                  }
                  action={
                    <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                      {items.length} logged
                      {dueHere > 0 && (
                        <span style={{ color: 'var(--status-fading)' }}> · {dueHere} due</span>
                      )}
                    </span>
                  }
                >
                  {open && (
                    <ul className="flex flex-col">
                      {items.map((m) => {
                        const isDue = new Date(m.next_review_at).getTime() <= now
                        return (
                          <li
                            key={m.id}
                            className="flex items-center gap-4 border-b py-3.5 last:border-b-0"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                                {displaySubtopic(m.questions.subtopic)}
                              </p>
                              <p className="mt-1 truncate text-[14px]" style={{ color: 'var(--text-body)' }}>
                                {m.questions.stem}
                              </p>
                            </div>
                            <span
                              className="hidden shrink-0 text-[12.5px] sm:block"
                              style={{ color: 'var(--text-faint)' }}
                            >
                              {m.review_count > 0
                                ? `${m.review_count} correct review${m.review_count !== 1 ? 's' : ''}`
                                : 'Not yet recovered'}
                            </span>
                            <span
                              className="shrink-0 text-[12.5px] font-medium tabular-nums"
                              style={{
                                color: isDue ? 'var(--status-fading)' : 'var(--text-muted)',
                              }}
                            >
                              {relativeDue(m.next_review_at, now)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Section>
              )
            })}
          </>
        )}
      </Page>
    </DashboardLayout>
  )
}
