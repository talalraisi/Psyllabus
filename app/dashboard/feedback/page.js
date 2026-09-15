'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, EmptyState, PageLoading, StatRow } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'

/**
 * Everything the beta said, in one place.
 *
 * Collecting feedback into a table nobody opens is the same as not collecting
 * it. This is the other half: every report, newest first, with who sent it and
 * which page they were on.
 *
 * Admin only, and the check that matters is in the database — all_feedback()
 * refuses anybody whose profile is not flagged. The redirect here is courtesy,
 * not security.
 */

const KIND_LABEL = {
  problem: 'Something broke',
  confusing: 'Confusing',
  idea: 'An idea',
  other: 'Something else',
}

const KIND_TONE = {
  problem: 'var(--status-weak)',
  confusing: 'var(--status-developing)',
  idea: 'var(--brand)',
  other: 'var(--text-faint)',
}

function ago(when) {
  const mins = Math.round((Date.now() - new Date(when).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function FeedbackPage() {
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])

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

      const { data, error } = await supabase.rpc('all_feedback')
      if (cancelled) return
      if (error) setDenied(true)
      else setItems(data || [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Feedback" width="default" rows={5} />
      </DashboardLayout>
    )
  }

  if (denied) {
    return (
      <DashboardLayout profile={profile}>
        <Page width="default">
          <PageHeader title="Feedback" />
          <EmptyState
            title="Not your page"
            description="Only an admin account can read what everyone has sent."
          />
        </Page>
      </DashboardLayout>
    )
  }

  const unhandled = items.filter((i) => !i.handled)
  const byKind = (k) => items.filter((i) => i.kind === k).length

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          eyebrow="Beta"
          title="Feedback"
          subtitle={`${items.length} message${items.length === 1 ? '' : 's'} from the people using it`}
        />

        {items.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            description="Every signed-in page has a Feedback button in the corner. Whatever anybody sends lands here, with the page they were on."
          />
        ) : (
          <>
            <StatRow
              className="mb-12"
              stats={[
                { label: 'unread', value: unhandled.length, tone: 'var(--brand)' },
                { label: 'broke', value: byKind('problem'), tone: 'var(--status-weak)' },
                { label: 'confusing', value: byKind('confusing'), tone: 'var(--status-developing)' },
                { label: 'ideas', value: byKind('idea') },
              ]}
            />

            <ul className="flex flex-col">
              {items.map((f) => (
                <li
                  key={f.id}
                  className="border-b py-5 last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: KIND_TONE[f.kind] || KIND_TONE.other }}
                    >
                      {KIND_LABEL[f.kind] || f.kind}
                    </span>
                    <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      {f.email || 'account since deleted'}
                    </span>
                    <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                      {ago(f.created_at)}
                    </span>
                    {f.path && (
                      <code className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                        {f.path}
                      </code>
                    )}
                    {f.viewport && (
                      <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                        {f.viewport}
                      </span>
                    )}
                  </div>
                  <p
                    className="whitespace-pre-wrap text-[14px] leading-relaxed"
                    style={{ color: 'var(--text-body)' }}
                  >
                    {f.message}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Page>
    </DashboardLayout>
  )
}
