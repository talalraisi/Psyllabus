'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getSyllabus } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, EmptyState, PageLoading, SkeletonLine } from '@/components/PageShell'
import { IconClock, IconCheck } from '@/components/Icons'
import { sortTopics, progressKey } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { accessibleSubjects, isPremium } from '@/lib/access'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'

const LENGTHS = [10, 20, 30, 45]

const FOCUS_MODES = [
  {
    key: 'weak',
    label: 'Target my weak spots',
    hint: 'Draws from subtopics you got wrong, plus anything decaying.',
    statuses: ['in_progress', 'confident', 'decaying'],
  },
  {
    key: 'untested',
    label: 'Cover new ground',
    hint: 'Only subtopics you have never been tested on.',
    statuses: ['not_started'],
  },
  {
    key: 'all',
    label: 'Everything',
    hint: 'A full mixed paper across the topics you pick.',
    statuses: null,
  },
]

const DIFFICULTIES = [
  { key: 'mixed', label: 'Mixed', range: null },
  { key: 'easy', label: 'Easier', range: [0, 0.4] },
  { key: 'medium', label: 'Medium', range: [0.35, 0.7] },
  { key: 'hard', label: 'Harder', range: [0.6, 1] },
]

export default function TestBuilderPage() {
  const [profile, setProfile] = useState(null)
  const [subject, setSubject] = useState('')
  const [topics, setTopics] = useState([])
  const [pool, setPool] = useState([])
  const [statusBySubtopic, setStatusBySubtopic] = useState({})
  const [selected, setSelected] = useState([])
  const [length, setLength] = useState(20)
  const [timed, setTimed] = useState(true)
  const [focusMode, setFocusMode] = useState('all')
  const [difficulty, setDifficulty] = useState('mixed')
  const [loading, setLoading] = useState(true)
  const [loadingPool, setLoadingPool] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (!profileData) {
        router.push('/onboarding')
        return
      }
      setProfile(profileData)
      // The core is coursework, not examinable content, so it is not testable here.
      const testable = accessibleSubjects(profileData).filter(
        (x) => !IB_CORE_SUBJECTS.includes(x)
      )
      setSubject(testable[0] || '')
      setLoading(false)
    }
    load()
  }, [router, supabase])

  useEffect(() => {
    if (!subject || !profile) return
    let cancelled = false

    async function loadPool() {
      setLoadingPool(true)
      const [syllabus, { data: questions }, { data: progressRows }] = await Promise.all([
        getSyllabus(supabase, [subject]),
        supabase
          .from('questions')
          .select('id, topic, subtopic, difficulty, marks, time_budget_seconds')
          .eq('subject', subject)
          .eq('verified', true),
        supabase.from('progress').select('*').eq('user_id', profile.id).eq('subject', subject),
      ])
      if (cancelled) return

      const effective = buildEffectiveProgressMap(progressRows)
      const statuses = {}
      for (const row of syllabus || []) {
        statuses[row.subtopic] = effective[progressKey(subject, row.subtopic)] || 'not_started'
      }

      const unique = [...new Set((syllabus || []).map((r) => r.topic))]
      const ordered = sortTopics(unique.map((t) => [t, null])).map(([t]) => t)

      setTopics(ordered)
      setPool(questions || [])
      setStatusBySubtopic(statuses)
      setSelected(ordered)
      setLoadingPool(false)
    }

    loadPool()
    return () => {
      cancelled = true
    }
  }, [subject, profile, supabase])

  /** Questions matching every filter, so the count shown is always truthful. */
  const eligible = useMemo(() => {
    const mode = FOCUS_MODES.find((m) => m.key === focusMode)
    const diff = DIFFICULTIES.find((d) => d.key === difficulty)

    return pool.filter((q) => {
      if (!selected.includes(q.topic)) return false

      if (mode?.statuses) {
        const status = statusBySubtopic[q.subtopic] || 'not_started'
        if (!mode.statuses.includes(status)) return false
      }

      if (diff?.range) {
        const d = typeof q.difficulty === 'number' ? q.difficulty : 0.5
        if (d < diff.range[0] || d > diff.range[1]) return false
      }

      return true
    })
  }, [pool, selected, focusMode, difficulty, statusBySubtopic])

  const perTopicCounts = useMemo(() => {
    const counts = {}
    for (const q of pool) counts[q.topic] = (counts[q.topic] || 0) + 1
    return counts
  }, [pool])

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Build a Test" width="default" rows={4} />
      </DashboardLayout>
    )
  }

  const usable = accessibleSubjects(profile).filter((s) => !IB_CORE_SUBJECTS.includes(s))
  const actualLength = Math.min(length, eligible.length)
  const canStart = actualLength > 0

  // Real paper metrics, taken from the questions that would actually be drawn.
  const sample = eligible.slice(0, actualLength)
  const totalMarks = sample.reduce((s, q) => s + (q.marks || 1), 0)
  const totalSeconds = sample.reduce((s, q) => s + (q.time_budget_seconds || 90), 0)
  const estMinutes = Math.max(1, Math.round(totalSeconds / 60))

  const toggleTopic = (topic) =>
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )

  const startTest = () => {
    const params = new URLSearchParams({
      subject,
      mode: 'custom',
      count: String(actualLength),
      topics: selected.join('~~'),
      back: '/dashboard/test',
    })
    if (timed) params.set('timed', '1')
    if (focusMode !== 'all') params.set('focus', focusMode)
    if (difficulty !== 'mixed') params.set('difficulty', difficulty)
    router.push(`/dashboard/quiz?${params.toString()}`)
  }

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Build a Test"
          subtitle="Compose a paper from any mix of topics, then sit it under exam conditions."
        />

        {/* Subject */}
        <div className="surface mb-3 p-5">
          <label htmlFor="subject" className="t-small mb-2 block font-medium text-[var(--text)]">
            Subject
          </label>
          <select
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="field"
          >
            {usable.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {!isPremium(profile) && (profile.subjects || []).length > usable.length && (
            <p className="t-caption mt-2">
              Free plan covers one subject.{' '}
              <Link href="/dashboard/profile#unlock" className="text-[var(--brand)] hover:underline">
                Unlock the rest
              </Link>
            </p>
          )}
        </div>

        {/* What to draw from */}
        <div className="surface mb-3 p-5">
          <p className="t-small mb-3 font-medium text-[var(--text)]">What should this test cover?</p>
          <div className="flex flex-col gap-2">
            {FOCUS_MODES.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setFocusMode(mode.key)}
                aria-pressed={focusMode === mode.key}
                className={`flex items-start gap-3 rounded-[var(--r-md)] border p-3 text-left transition-colors duration-150 ${
                  focusMode === mode.key
                    ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
                    : 'border-[var(--border-strong)] hover:border-[var(--border-hover)]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    focusMode === mode.key
                      ? 'border-[var(--brand)] bg-[var(--brand)]'
                      : 'border-[var(--border-hover)]'
                  }`}
                >
                  {focusMode === mode.key && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[var(--text)]">{mode.label}</span>
                  <span className="t-caption">{mode.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Topics */}
        <div className="surface mb-3 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="t-small font-medium text-[var(--text)]">Topics</p>
            <button
              onClick={() => setSelected(selected.length === topics.length ? [] : topics)}
              className="text-xs font-medium text-[var(--brand)] hover:underline"
            >
              {selected.length === topics.length ? 'Clear all' : 'Select all'}
            </button>
          </div>

          {loadingPool ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <SkeletonLine key={i} height={36} />
              ))}
            </div>
          ) : topics.length === 0 ? (
            <p className="t-small">No syllabus loaded for this subject yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topics.map((topic) => {
                const n = perTopicCounts[topic] || 0
                const isSelected = selected.includes(topic)
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-3 rounded-[var(--r-md)] border px-3 py-2 text-left transition-colors duration-150 ${
                      isSelected
                        ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
                        : 'border-[var(--border-strong)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--r-sm)] border ${
                        isSelected
                          ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                          : 'border-[var(--border-hover)]'
                      }`}
                    >
                      {isSelected && <IconCheck width={11} height={11} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-body)]">
                      {topic}
                    </span>
                    <span className="t-caption shrink-0">
                      {n > 0 ? `${n} available` : 'none yet'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Difficulty and length */}
        <div className="surface mb-3 p-5">
          <p className="t-small mb-3 font-medium text-[var(--text)]">Difficulty</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                aria-pressed={difficulty === d.key}
                className={`control-sm rounded-[var(--r-md)] border px-4 text-sm font-medium transition-colors duration-150 ${
                  difficulty === d.key
                    ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                    : 'border-[var(--border-strong)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <p className="t-small mb-3 font-medium text-[var(--text)]">Length</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {LENGTHS.map((n) => (
              <button
                key={n}
                onClick={() => setLength(n)}
                aria-pressed={length === n}
                className={`control-md rounded-[var(--r-md)] border px-4 text-sm font-medium transition-colors duration-150 ${
                  length === n
                    ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                    : 'border-[var(--border-strong)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                }`}
              >
                {n} questions
              </button>
            ))}
          </div>

          <button
            onClick={() => setTimed(!timed)}
            role="switch"
            aria-checked={timed}
            className="flex items-center gap-3"
          >
            <span
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ${
                timed ? 'bg-[var(--brand)]' : 'bg-[var(--border-strong)]'
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-150 ${
                  timed ? 'left-5' : 'left-1'
                }`}
              />
            </span>
            <span className="text-sm text-[var(--text-body)]">
              Exam conditions: countdown and live marks-per-minute pacing
            </span>
          </button>
        </div>

        {/* Summary */}
        <div className="surface p-5">
          {canStart ? (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[
                  ['Questions', actualLength],
                  ['Marks', totalMarks],
                  [timed ? 'Time limit' : 'Est. time', `${estMinutes}m`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3"
                  >
                    <p className="text-lg font-bold tabular-nums text-[var(--text)]">{value}</p>
                    <p className="t-caption">{label}</p>
                  </div>
                ))}
              </div>

              {actualLength < length && (
                <p className="t-caption mb-4">
                  Only {eligible.length} question{eligible.length === 1 ? '' : 's'} match these
                  filters, so the paper will be {actualLength} long. Widen the topics or
                  difficulty for more.
                </p>
              )}

              <button onClick={startTest} className="btn btn-solid control-lg w-full">
                {timed && <IconClock width={18} height={18} />}
                Start {timed ? 'timed test' : 'test'}
              </button>
            </>
          ) : (
            <EmptyState
              title="No questions match these settings"
              description={
                selected.length === 0
                  ? 'Select at least one topic.'
                  : 'Try a different focus, a wider difficulty range, or more topics.'
              }
            />
          )}
        </div>
      </Page>
    </DashboardLayout>
  )
}
