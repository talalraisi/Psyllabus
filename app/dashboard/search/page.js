'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading, EmptyState } from '@/components/PageShell'
import ResourceHubDrawer from '@/components/ResourceHubDrawer'
import { getSlugForSubject } from '@/lib/subject-map'
import {
  progressKey,
  displaySubtopic,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { accessibleSubjects } from '@/lib/access'

/**
 * Look something up.
 *
 * The syllabus holds 5,914 subtopics and there was no way to find anything in
 * it. That made the whole map useful only to someone already scrolling the
 * right subject page, and it made the app feel like it did nothing until you
 * started answering questions.
 *
 * This needs no quiz data at all, which is the point: it is something the
 * product can do on the first day, for a student who just wants to know where
 * a thing sits in their course and what to read about it.
 */
function SearchPage() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState(null)
  const [progress, setProgress] = useState({})
  const [query, setQuery] = useState(params.get('q') || '')
  const [scope, setScope] = useState('mine')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [drawerItem, setDrawerItem] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })
      if (cancelled) return
      if (!profileData) {
        router.push('/onboarding')
        return
      }
      setProfile(profileData)

      const { data: rows } = await supabase.from('progress').select('*').eq('user_id', user.id)
      if (!cancelled) {
        setProgress(buildEffectiveProgressMap(rows))
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const run = useCallback(
    async (term, searchScope, currentProfile) => {
      const q = term.trim()
      if (q.length < 2) {
        setResults(null)
        return
      }
      setSearching(true)

      let request = supabase
        .from('syllabus_content')
        .select('id, curriculum, subject, topic, subtopic, hl_only')
        .or(`subtopic.ilike.%${q}%,topic.ilike.%${q}%`)
        .limit(80)

      // Default to what the student actually studies. Searching all three
      // curricula is useful for seeing how a concept is examined elsewhere,
      // but it is not what most searches want.
      if (searchScope === 'mine') {
        const mine = accessibleSubjects(currentProfile)
        if (mine.length) request = request.in('subject', mine)
      } else if (searchScope === 'curriculum') {
        request = request.eq('curriculum', currentProfile?.curriculum || 'IB')
      }

      const { data } = await request
      setResults(data || [])
      setSearching(false)
    },
    [supabase]
  )

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!profile) return
    const id = setTimeout(() => run(query, scope, profile), 220)
    return () => clearTimeout(id)
  }, [query, scope, profile, run])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Search" width="default" rows={4} />
      </DashboardLayout>
    )
  }

  const mine = new Set(accessibleSubjects(profile))
  const grouped = (results || []).reduce((acc, r) => {
    const key = `${r.curriculum}|||${r.subject}`
    ;(acc[key] ||= []).push(r)
    return acc
  }, {})

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Search"
          subtitle="Find any topic across your syllabus. No quiz needed."
        />

        <div className="surface mb-6 p-5">
          <label className="t-overline" htmlFor="q">
            What are you looking for
          </label>
          <input
            id="q"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="integration by parts, enzymes, price elasticity…"
            className="input mt-1"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ['mine', 'My subjects'],
              ['curriculum', `All of ${profile.curriculum}`],
              ['all', 'Every curriculum'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setScope(key)}
                aria-pressed={scope === key}
                className={`control-sm rounded-[var(--r-md)] border px-3 text-xs font-medium transition-colors duration-150 ${
                  scope === key
                    ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand)]'
                    : 'border-[var(--border-strong)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {scope === 'all' && (
            <p className="t-caption mt-3">
              Searching IB, A-Level and AP at once. Useful for seeing how the same idea is
              examined on a different course.
            </p>
          )}
        </div>

        {query.trim().length < 2 ? (
          <EmptyState
            title="Type at least two letters"
            description="Search covers every topic and subtopic in the syllabus, whether or not you have been tested on it."
          />
        ) : searching && results === null ? (
          <p className="t-small">Searching…</p>
        ) : results?.length === 0 ? (
          <EmptyState
            title={`Nothing matching “${query.trim()}”`}
            description={
              scope === 'mine'
                ? 'Try widening the search to your whole curriculum, or every curriculum.'
                : 'Try a shorter phrase, or a single distinctive word.'
            }
          />
        ) : (
          <>
            <p className="t-small mb-4">
              {results.length} result{results.length === 1 ? '' : 's'}
              {results.length === 80 ? ' (showing the first 80)' : ''}
            </p>

            <div className="flex flex-col gap-8">
              {Object.entries(grouped).map(([key, rows]) => {
                const [curriculum, subject] = key.split('|||')
                const studied = mine.has(subject)
                return (
                  <section key={key}>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="t-overline">
                        {subject}
                        {!studied && (
                          <span className="ml-2 normal-case tracking-normal text-[var(--text-faint)]">
                            {curriculum}, not one of yours
                          </span>
                        )}
                      </h2>
                      {studied && (
                        <Link
                          href={`/dashboard/syllabus/${getSlugForSubject(subject)}`}
                          className="text-sm font-medium text-[var(--brand)] hover:underline"
                        >
                          Open subject
                        </Link>
                      )}
                    </div>

                    <ul className="surface">
                      {rows.map((r, i) => {
                        const status = progress[progressKey(r.subject, r.subtopic)] || 'not_started'
                        return (
                          <li
                            key={r.id}
                            className={i > 0 ? 'border-t border-[var(--border)]' : undefined}
                          >
                            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                              <div className="min-w-[12rem] flex-1">
                                <p className="t-caption truncate">{r.topic}</p>
                                <p className="text-sm text-[var(--text)]">
                                  {displaySubtopic(r.subtopic)}
                                </p>
                              </div>

                              {studied && (
                                <span
                                  className={`flex shrink-0 items-center gap-2 text-xs font-medium ${STATUS_TEXT_COLORS[status]}`}
                                >
                                  <span
                                    className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`}
                                    aria-hidden="true"
                                  />
                                  {STATUS_LABELS[status]}
                                </span>
                              )}

                              <button
                                onClick={() => setDrawerItem(r)}
                                className="btn btn-quiet control-sm shrink-0 text-xs"
                              >
                                Resources
                              </button>

                              {studied && (
                                <Link
                                  href={`/dashboard/quiz?subject=${encodeURIComponent(r.subject)}&topic=${encodeURIComponent(r.topic)}&subtopic=${encodeURIComponent(r.subtopic)}&back=/dashboard/search`}
                                  className="btn btn-outline control-sm shrink-0 text-xs"
                                >
                                  Practise
                                </Link>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          </>
        )}

        <ResourceHubDrawer
          open={!!drawerItem}
          onClose={() => setDrawerItem(null)}
          subject={drawerItem?.subject}
          topic={drawerItem?.topic}
          subtopic={drawerItem?.subtopic}
          hlOnly={drawerItem?.hl_only}
          quizHref={
            drawerItem && mine.has(drawerItem.subject)
              ? `/dashboard/quiz?subject=${encodeURIComponent(drawerItem.subject)}&topic=${encodeURIComponent(drawerItem.topic)}&subtopic=${encodeURIComponent(drawerItem.subtopic)}&back=/dashboard/search`
              : null
          }
        />
      </Page>
    </DashboardLayout>
  )
}

export default function Search() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  )
}
