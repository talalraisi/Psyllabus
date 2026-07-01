'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '@/components/AppHeader'
import {
  getSlugForSubject,
  hasSyllabusData,
} from '@/lib/subject-map'

function StudyToday({ supabase }) {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: progress } = await supabase
        .from('user_topic_progress')
        .select('confidence, topics(title, topic_type)')
        .eq('user_id', user.id)
        .lte('confidence', 3)
        .order('confidence')

      const weak = (progress || [])
        .filter((p) => p.topics?.topic_type === 'subtopic')
        .slice(0, 3)

      setItems(weak)
      setLoaded(true)
    }
    load()
  }, [supabase])

  if (!loaded) return null

  return (
    <div className="mt-6 pt-6 divider">
      <p className="section-label mb-3">Study today</p>
      {items.length === 0 ? (
        <p className="text-text-muted text-sm">
          Rate topics on your syllabus to get a daily plan.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-text-faint text-sm font-bold w-4">{i + 1}.</span>
              <span className="text-sm text-text flex-1">{item.topics.title}</span>
              <span className="text-xs font-medium text-weak">weak</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        router.push('/onboarding')
        return
      }

      setProfile(data)
      setLoading(false)
    }
    loadProfile()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="page page-center">
        <p className="text-text-muted text-sm">Loading your dashboard…</p>
      </main>
    )
  }

  const firstName = profile.full_name?.split(' ')[0]

  return (
    <main className="page px-6 py-8">
      <div className="container-narrow">
        <AppHeader
          rightAction={
            <div className="flex items-center gap-3">
              <Link href="/dashboard/profile" className="link text-sm">
                Profile
              </Link>
              <button onClick={handleLogout} className="btn-ghost">
                Sign out
              </button>
            </div>
          }
        />

        <div className="card card-pad mb-6">
          <h1 className="text-2xl font-bold text-text mb-1">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-text-muted text-sm">
            {profile.curriculum} · Class of {profile.grad_year}
          </p>
          <StudyToday supabase={supabase} />
        </div>

        <div className="card card-pad">
          <h2 className="font-bold text-lg text-text mb-6">Your subjects</h2>

          {profile.subjects?.length > 0 ? (
            <div className="space-y-3">
              {profile.subjects.map((subject) => {
                const slug = getSlugForSubject(subject)
                const available = hasSyllabusData(subject)
                return (
                  <div
                    key={subject}
                    className="flex items-center justify-between gap-4 p-4 rounded-[var(--radius-sm)] border border-border bg-bg-subtle"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{subject}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        Target: {profile.target_grades?.[subject] || '—'}
                      </p>
                    </div>
                    {available ? (
                      <Link
                        href={`/dashboard/syllabus/${slug}`}
                        className="btn-primary text-xs px-4 py-2 flex-shrink-0"
                      >
                        Open syllabus
                      </Link>
                    ) : (
                      <span className="text-xs text-text-faint flex-shrink-0">Coming soon</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-text-muted text-sm">No subjects found.</p>
          )}
        </div>
      </div>
    </main>
  )
}
