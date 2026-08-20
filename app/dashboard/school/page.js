'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, EmptyState, PageLoading } from '@/components/PageShell'
import { isStaff } from '@/lib/access'
import { progressKey, STATUS_COLORS, STATUS_LABELS } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'

/**
 * Cohort view for school staff. Reads only the staff member's own school,
 * enforced by row level security rather than by this query.
 */
export default function SchoolPage() {
  const [profile, setProfile] = useState(null)
  const [school, setSchool] = useState(null)
  const [students, setStudents] = useState([])
  const [weakest, setWeakest] = useState([])
  const [totals, setTotals] = useState({ students: 0, tracked: 0, mastered: 0, needsWork: 0 })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }

      const { data: me } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!me) {
        router.push('/onboarding')
        return
      }
      setProfile(me)

      if (!isStaff(me) || !me.school_id) {
        setLoading(false)
        return
      }

      const [{ data: schoolRow }, { data: cohort }, { data: progressRows }] = await Promise.all([
        supabase.from('schools').select('*').eq('id', me.school_id).single(),
        supabase.from('profiles').select('*').eq('school_id', me.school_id),
        supabase.from('progress').select('*'), // RLS scopes this to the school
      ])

      setSchool(schoolRow || null)

      const studentRows = (cohort || []).filter((p) => p.role === 'student')
      const byUser = new Map(studentRows.map((s) => [s.id, s]))

      // Effective status per row, so decay counts as needing work.
      const effective = buildEffectiveProgressMap(progressRows)

      let mastered = 0
      let needsWork = 0
      const perStudent = new Map()
      const subtopicTrouble = new Map()

      for (const row of progressRows || []) {
        if (!byUser.has(row.user_id)) continue
        const status = effective[progressKey(row.subject, row.subtopic)] || row.status

        const s = perStudent.get(row.user_id) || { mastered: 0, total: 0 }
        s.total++
        if (status === 'mastered') {
          s.mastered++
          mastered++
        } else {
          needsWork++
          const key = `${row.subject}|||${row.subtopic}`
          const t = subtopicTrouble.get(key) || {
            subject: row.subject,
            subtopic: row.subtopic,
            count: 0,
            worst: status,
          }
          t.count++
          if (status === 'in_progress') t.worst = 'in_progress'
          subtopicTrouble.set(key, t)
        }
        perStudent.set(row.user_id, s)
      }

      setStudents(
        studentRows
          .map((s) => {
            const stat = perStudent.get(s.id) || { mastered: 0, total: 0 }
            return {
              id: s.id,
              name: s.full_name || 'Unnamed student',
              gradYear: s.grad_year,
              subjects: (s.subjects || []).length,
              tracked: stat.total,
              mastered: stat.mastered,
              pct: stat.total ? Math.round((stat.mastered / stat.total) * 100) : 0,
            }
          })
          .sort((a, b) => a.pct - b.pct)
      )

      setWeakest(
        [...subtopicTrouble.values()].sort((a, b) => b.count - a.count).slice(0, 8)
      )

      setTotals({
        students: studentRows.length,
        tracked: (progressRows || []).filter((r) => byUser.has(r.user_id)).length,
        mastered,
        needsWork,
      })
      setLoading(false)
    }
    load()
  }, [router, supabase])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="School" width="wide" stats rows={5} />
      </DashboardLayout>
    )
  }

  if (!isStaff(profile) || !profile.school_id) {
    return (
      <DashboardLayout profile={profile}>
        <Page width="default">
          <PageHeader title="School" subtitle="Cohort insights for teachers and coordinators" />
          <EmptyState
            title="Staff access only"
            description="This dashboard is available to teachers and coordinators linked to a school. If you should have access, ask your school administrator to grant it."
          />
        </Page>
      </DashboardLayout>
    )
  }

  const cohortPct = totals.tracked ? Math.round((totals.mastered / totals.tracked) * 100) : 0

  const stats = [
    { label: 'Students', value: totals.students, color: 'text-[var(--text)]' },
    { label: 'Subtopics tracked', value: totals.tracked, color: 'text-[var(--text)]' },
    { label: 'Mastered', value: totals.mastered, color: 'text-[var(--status-mastered)]' },
    { label: 'Needs work', value: totals.needsWork, color: 'text-[var(--status-decaying)]' },
  ]

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          title={school?.name || 'School'}
          subtitle={`${totals.students} student${totals.students === 1 ? '' : 's'} · join code ${school?.join_code} · ${cohortPct}% of tracked subtopics mastered`}
        />

        <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="surface p-5">
              <p className={`t-stat ${color}`}>{value}</p>
              <p className="t-small mt-1">{label}</p>
            </div>
          ))}
        </div>

        <Section title="Where the cohort is struggling">
          {weakest.length === 0 ? (
            <EmptyState
              title="No quiz data yet"
              description="Once students take quizzes, the subtopics the cohort finds hardest will rank here."
            />
          ) : (
            <ul className="surface">
              {weakest.map((row, i) => (
                <li
                  key={`${row.subject}-${row.subtopic}`}
                  className={i > 0 ? 'border-t border-[var(--border)]' : undefined}
                >
                  <div className="flex items-center gap-3 px-5 py-4">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[row.worst] || STATUS_COLORS.in_progress}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="t-caption truncate">{row.subject}</p>
                      <p className="truncate text-sm text-[var(--text-body)]">{row.subtopic}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text)]">
                      {row.count}
                    </span>
                    <span className="hidden shrink-0 text-xs text-[var(--text-faint)] sm:block">
                      student{row.count === 1 ? '' : 's'} not yet mastering
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Students">
          {students.length === 0 ? (
            <EmptyState
              title="No students have joined yet"
              description={`Share the join code ${school?.join_code} with your students. They enter it on their profile page to link their account to the school.`}
            />
          ) : (
            <ul className="surface">
              {students.map((s, i) => (
                <li key={s.id} className={i > 0 ? 'border-t border-[var(--border)]' : undefined}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className="w-40 shrink-0 truncate text-sm font-medium text-[var(--text)]">
                      {s.name}
                    </span>
                    <span className="hidden w-24 shrink-0 text-xs text-[var(--text-faint)] sm:block">
                      {s.subjects} subject{s.subjects === 1 ? '' : 's'}
                    </span>
                    <span
                      className="hidden h-2 flex-1 overflow-hidden rounded-full bg-[#f3f4f6] sm:block"
                      role="progressbar"
                      aria-valuenow={s.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--brand)]"
                        style={{ width: `${s.pct}%` }}
                      />
                    </span>
                    <span className="ml-auto w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--brand)] sm:ml-0">
                      {s.pct}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="t-caption">
          Aggregated from quiz results only. Students see their own data; staff see this cohort
          view. Status meanings: {Object.values(STATUS_LABELS).slice(0, 4).join(', ')}.
        </p>
      </Page>
    </DashboardLayout>
  )
}
