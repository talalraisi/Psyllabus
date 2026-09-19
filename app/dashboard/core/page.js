'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconCheck } from '@/components/Icons'
import { groupByUnit, sortTopics, groupByTopic } from '@/lib/progress'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'

/**
 * Theory of knowledge, the extended essay, and CAS.
 *
 * Every student takes all three, they decide three of the forty-five points
 * between them, and the app had nowhere to put them: they were filtered out of
 * the subject list because they cannot be quizzed, which left the parts of the
 * Diploma with the hardest deadlines as the parts nobody was tracking.
 *
 * So they get their own page, and it works the way they do — a list of things
 * that have to happen, ticked off by hand, with the exhibition and the essay
 * and the interviews as milestones rather than topics to revise. Nothing here
 * touches the heatmap or the prediction: this is a record of work done, not
 * evidence of knowledge.
 */

const BLURB = {
  'Theory of Knowledge': 'Graded A–E. The exhibition and a 1,600-word essay.',
  'Extended Essay': 'Graded A–E. 4,000 words on a question you choose.',
  'Creativity Activity Service': 'Not graded. Seven learning outcomes and a project.',
}

const ORDER = ['Theory of Knowledge', 'Extended Essay', 'Creativity Activity Service']

export default function CorePage() {
  const [profile, setProfile] = useState(null)
  const [rows, setRows] = useState([])
  const [done, setDone] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [openSubject, setOpenSubject] = useState(ORDER[0])
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
      if (cancelled) return
      if (!user) {
        setLoading(false)
        return
      }
      const [profileData, syllabus, { data: progressRows }] = await Promise.all([
        getProfile(supabase, user.id),
        getSyllabus(supabase, IB_CORE_SUBJECTS),
        supabase.from('core_progress').select('subject, item').eq('user_id', user.id),
      ])
      if (cancelled) return
      setProfile(profileData)
      setRows(syllabus || [])
      setDone(new Set((progressRows || []).map((r) => `${r.subject}||${r.item}`)))
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const toggle = useCallback(
    async (subject, item) => {
      const key = `${subject}||${item}`
      const wasDone = done.has(key)
      setDone((prev) => {
        const next = new Set(prev)
        if (wasDone) next.delete(key)
        else next.add(key)
        return next
      })

      const user = await getCurrentUser(supabase)
      if (!user) return
      const { error } = wasDone
        ? await supabase
            .from('core_progress')
            .delete()
            .eq('user_id', user.id)
            .eq('subject', subject)
            .eq('item', item)
        : await supabase
            .from('core_progress')
            .insert({ user_id: user.id, subject, item })

      // Put it back if the database refused: a tick that lies is worse than a
      // tick that would not go on.
      if (error && error.code !== '23505') {
        setDone((prev) => {
          const next = new Set(prev)
          if (wasDone) next.add(key)
          else next.delete(key)
          return next
        })
      }
    },
    [done, supabase]
  )

  const bySubject = useMemo(() => {
    const out = new Map()
    for (const subject of ORDER) {
      const mine = rows.filter((r) => r.subject === subject)
      const topics = sortTopics(Object.entries(groupByTopic(mine)))
      const total = mine.length
      const complete = mine.filter((r) => done.has(`${subject}||${r.subtopic}`)).length
      out.set(subject, { topics, total, complete })
    }
    return out
  }, [rows, done])

  if (loading) return <PageLoading title="Diploma core" width="default" rows={3} />

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Diploma core"
          subtitle="TOK and the extended essay are worth three points. CAS has to be finished."
        />

        <div className="stagger mb-10 grid gap-3 sm:grid-cols-3">
          {ORDER.map((subject) => {
            const { total, complete } = bySubject.get(subject)
            const pct = total ? Math.round((complete / total) * 100) : 0
            const open = openSubject === subject
            return (
              <button
                key={subject}
                onClick={() => setOpenSubject(subject)}
                aria-pressed={open}
                className="rounded-[12px] border p-4 text-left transition-colors duration-150"
                style={{
                  borderColor: open ? 'var(--brand)' : 'var(--border-strong)',
                  background: open ? 'var(--brand-tint)' : 'var(--surface)',
                }}
              >
                <h2 className="text-[14.5px] font-semibold tracking-[-0.012em]">{subject}</h2>
                <p className="mt-1.5 text-[12.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {BLURB[subject]}
                </p>
                <p className="mt-3 text-[22px] font-semibold leading-none tabular-nums">
                  {pct}
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text-faint)' }}>
                    %
                  </span>
                </p>
                <div
                  className="mt-2 h-1 overflow-hidden rounded-full"
                  style={{ background: 'var(--border-strong)' }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${pct}%`, background: 'var(--brand)' }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {bySubject.get(openSubject).topics.map(([topic, items]) => (
          <section key={topic} className="mb-8">
            <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.012em]">{topic}</h3>
            {groupByUnit(items).map(({ unit, code, items: unitItems }) => (
              <div key={unit || 'all'} className="mb-4">
                {unit && (
                  <p
                    className="mb-1.5 text-[11.5px] font-medium"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {code} {unit}
                  </p>
                )}
                <ul className="flex flex-col">
                  {unitItems.map((item) => {
                    const isDone = done.has(`${openSubject}||${item.subtopic}`)
                    return (
                      <li key={item.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                        <button
                          onClick={() => toggle(openSubject, item.subtopic)}
                          aria-pressed={isDone}
                          className="flex w-full items-center gap-3 py-2.5 text-left"
                        >
                          <span
                            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150"
                            style={{
                              borderColor: isDone ? 'var(--brand)' : 'var(--border-hover)',
                              background: isDone ? 'var(--brand)' : 'transparent',
                              color: '#fff',
                            }}
                          >
                            {isDone && <IconCheck width={11} height={11} />}
                          </span>
                          <span
                            className="flex-1 text-[14px] leading-snug"
                            style={{
                              color: isDone ? 'var(--text-faint)' : 'var(--text-body)',
                              textDecoration: isDone ? 'line-through' : undefined,
                            }}
                          >
                            {item.subtopic}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        ))}

        <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Deadlines live in the{' '}
            <Link href="/dashboard/calendar" className="underline underline-offset-2">
              calendar
            </Link>
            . Nothing ticked here affects your heatmap or predicted grade.
          </p>
        </div>
      </Page>
    </DashboardLayout>
  )
}
