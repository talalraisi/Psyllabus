'use client'

/**
 * Exam papers: every predicted paper for every subject the student takes,
 * in one place.
 *
 * They used to be reachable only from a subject's page, behind a button
 * called "Test", which nobody read as "papers". Here each subject lists its
 * papers in the real IB order (Paper 1, Paper 2 …), with the timing and
 * marks of the real thing, both versions, and where the student got to:
 * not started, carried on from where they stopped, or their score.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import { isSubjectLocked } from '@/lib/access'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading, EmptyState } from '@/components/PageShell'
import { papersForYear } from '@/components/PaperPicker'

const BACK = encodeURIComponent('/dashboard/papers')

/** "1h 15m", "45 min". */
const duration = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`)

export default function PapersPage() {
  const [profile, setProfile] = useState(null)
  const [papers, setPapers] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) return router.push('/login')
      const p = await getProfile(supabase, user.id, { onFresh: setProfile })
      if (!p) return router.push('/onboarding')
      setProfile(p)
      const subjects = (p.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s))
      const [{ data: rows }, { data: tries }] = await Promise.all([
        subjects.length
          ? supabase.from('exam_papers').select('id, subject, paper, version, exam_from, name, minutes, marks').in('subject', subjects).order('paper').order('version')
          : Promise.resolve({ data: [] }),
        supabase.from('paper_attempts').select('paper_id, score, total, submitted_at, started_at').eq('user_id', user.id).order('started_at', { ascending: false }),
      ])
      setPapers(rows || [])
      setAttempts(tries || [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const subjects = useMemo(() => (profile?.subjects || []).filter((s) => !IB_CORE_SUBJECTS.includes(s)), [profile])

  /* Per subject: its papers for the student's exam year, then Paper 1, 2 … with their versions. */
  const bySubject = useMemo(() => {
    const year = Number(profile?.grad_year) || null
    return subjects.map((subject) => {
      const mine = papersForYear(
        papers.filter((p) => p.subject === subject),
        year
      )
      const groups = new Map()
      for (const p of mine) {
        if (!groups.has(p.paper)) groups.set(p.paper, { paper: p.paper, name: p.name, minutes: p.minutes, marks: p.marks, versions: [] })
        groups.get(p.paper).versions.push(p)
      }
      return { subject, groups: [...groups.values()], locked: profile ? isSubjectLocked(subject, profile) : false }
    })
  }, [papers, subjects, profile])

  /** The latest attempt at a paper: its score, or that it is under way. */
  const latest = useMemo(() => {
    const m = new Map()
    for (const a of attempts) if (!m.has(a.paper_id)) m.set(a.paper_id, a)
    return m
  }, [attempts])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Exam papers" variant="list" rows={5} />
      </DashboardLayout>
    )
  }

  const any = bySubject.some((s) => s.groups.length)

  return (
    <DashboardLayout profile={profile}>
      <Page>
        <PageHeader title="Exam papers" subtitle="Predicted papers in the real IB format, timed like the exam and marked like it. Two versions of each." />

        {!any ? (
          <EmptyState title="No papers yet" description="Papers for your subjects are on their way." />
        ) : (
          <div className="flex flex-col gap-8">
            {bySubject
              .filter((s) => s.groups.length)
              .map((s) => (
                <section key={s.subject}>
                  <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">{s.subject}</h2>
                  <ul className="overflow-hidden rounded-[16px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                    {s.groups.map((g, i) => (
                      <li key={g.paper} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${i ? 'border-t' : ''}`} style={{ borderColor: 'var(--border)' }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold">{g.name || `Paper ${g.paper}`}</p>
                          <p className="mt-0.5 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                            {g.minutes ? duration(g.minutes) : ''}
                            {g.minutes && g.marks ? ' · ' : ''}
                            {g.marks ? `${g.marks} marks` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {g.versions.map((v) => {
                            const a = latest.get(v.id)
                            const state = !a ? null : a.submitted_at ? (a.score != null && a.total ? `${a.score}/${a.total}` : 'Done') : 'In progress'
                            return s.locked ? (
                              <Link key={v.id} href="/dashboard/profile#unlock" className="btn btn-quiet control-sm" style={{ color: 'var(--text-faint)' }}>
                                Version {v.version} · Locked
                              </Link>
                            ) : (
                              <Link key={v.id} href={`/dashboard/paper/${v.id}?back=${BACK}`} className={a?.submitted_at ? 'btn btn-quiet control-sm' : 'btn btn-outline control-sm'}>
                                Version {v.version}
                                {state && (
                                  <span className="ml-1.5 text-[11.5px] font-medium tabular-nums" style={{ color: a.submitted_at ? 'var(--brand)' : 'var(--text-muted)' }}>
                                    {state}
                                  </span>
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </Page>
    </DashboardLayout>
  )
}
