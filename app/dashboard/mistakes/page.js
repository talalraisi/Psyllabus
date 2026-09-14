'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { displaySubtopic } from '@/lib/progress'
import { IconChevronRight } from '@/components/Icons'
import { Page, PageHeader, EmptyState, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'

const DAY = 24 * 60 * 60 * 1000

/** Three correct recalls and a question leaves the bank. */
const REVIEWS_TO_CLEAR = 3

/** Which shelf a question sits on, and in what order the shelves read. */
const BUCKETS = [
  { key: 'now', label: 'Due now', hint: 'Waiting for you.' },
  { key: 'tomorrow', label: 'Tomorrow', hint: null },
  { key: 'week', label: 'Later this week', hint: null },
  { key: 'later', label: 'Further out', hint: null },
]

function bucketFor(nextReviewAt, now) {
  const diff = new Date(nextReviewAt).getTime() - now
  if (diff <= 0) return 'now'
  if (diff <= DAY) return 'tomorrow'
  if (diff <= 7 * DAY) return 'week'
  return 'later'
}

function relativeDue(nextReviewAt, now = Date.now()) {
  const diff = new Date(nextReviewAt).getTime() - now
  if (diff <= 0) return 'Due now'
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
  return days === 1 ? 'Tomorrow' : days <= 7 ? `In ${days} days` : `In ${Math.round(days / 7)} weeks`
}

export default function MistakeBankPage() {
  const [profile, setProfile] = useState(null)
  const [picked, setPicked] = useState([])
  // Folded state per shelf. Absent means open, so the page still shows its
  // contents the first time you arrive.
  const [openBuckets, setOpenBuckets] = useState({})
  const [mistakes, setMistakes] = useState([])
  const [loading, setLoading] = useState(true)

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight. A page that has arrived but has no data yet is the
  // part that feels broken.
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
                  className={`${picked.length === 0 ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
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
                      className={`${on ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
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

            <div className="flex flex-col">
              {BUCKETS.map(({ key, label, hint }) => {
                const items = inScope.filter(
                  (m) => bucketFor(m.next_review_at, now) === key
                )
                if (!items.length) return null
                const isOpen = openBuckets[key] !== false // open unless folded

                return (
                  <section
                    key={key}
                    className="border-t last:border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <button
                      onClick={() => setOpenBuckets((prev) => ({ ...prev, [key]: !isOpen }))}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 py-3.5 text-left"
                    >
                      <IconChevronRight
                        width={13}
                        height={13}
                        className={`shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--text-faint)' }}
                      />
                      <span
                        className="text-[13.5px] font-medium"
                        style={{ color: key === 'now' ? 'var(--status-fading)' : 'var(--text)' }}
                      >
                        {label}
                      </span>
                      {hint && (
                        <span className="hidden text-[12px] sm:block" style={{ color: 'var(--text-faint)' }}>
                          {hint}
                        </span>
                      )}
                      <span
                        className="ml-auto shrink-0 text-[12px] tabular-nums"
                        style={{ color: 'var(--text-faint)' }}
                      >
                        {items.length}
                      </span>
                    </button>

                    {isOpen && (
                      <ul className="flex flex-col pb-2 pl-6">
                        {items.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-4 border-t py-3"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                                {m.questions.subject} · {displaySubtopic(m.questions.subtopic)}
                              </p>
                              <p
                                className="mt-0.5 truncate text-[13.5px]"
                                style={{ color: 'var(--text-body)' }}
                              >
                                {m.questions.stem}
                              </p>
                            </div>

                            {/* Three correct reviews clears it, so the count is
                                three marks rather than a fraction to parse. */}
                            <span
                              className="flex shrink-0 items-center gap-1"
                              title={`${m.review_count || 0} of ${REVIEWS_TO_CLEAR} correct reviews`}
                              aria-label={`${m.review_count || 0} of ${REVIEWS_TO_CLEAR} correct reviews`}
                            >
                              {Array.from({ length: REVIEWS_TO_CLEAR }).map((_, i) => (
                                <span
                                  key={i}
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    background:
                                      i < (m.review_count || 0)
                                        ? 'var(--status-proficient)'
                                        : 'var(--border-strong)',
                                  }}
                                />
                              ))}
                            </span>

                            <span
                              className="w-[74px] shrink-0 text-right text-[12.5px] font-medium tabular-nums"
                              style={{
                                color: key === 'now' ? 'var(--status-fading)' : 'var(--text-muted)',
                              }}
                            >
                              {relativeDue(m.next_review_at, now)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          </>
        )}
      </Page>
    </DashboardLayout>
  )
}
