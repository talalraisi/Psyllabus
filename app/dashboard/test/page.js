'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getSyllabus, getProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading, SkeletonLine } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconClock, IconCheck } from '@/components/Icons'
import { sortTopics, progressKey, HEAT_LEVELS, HEAT_RANGES } from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { accessibleSubjects, isPremium } from '@/lib/access'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'

const LENGTHS = [10, 20, 30, 45]

const QUESTION_TYPES = [
  { key: 'all', label: 'Any kind', hint: 'Multiple choice and written answers mixed.' },
  { key: 'mcq', label: 'Multiple choice', hint: 'Four options, one right. Fast to sit.' },
  { key: 'short_answer', label: 'Written answer', hint: 'You type it. Marked on what you wrote.' },
]

const ORDERS = [
  { key: 'mixed', label: 'Mixed', hint: 'Shuffled, the way a quiz normally runs.' },
  { key: 'rising', label: 'Easiest first', hint: 'Warm up, then climb. Good for a long session.' },
  { key: 'falling', label: 'Hardest first', hint: 'Hit the hard ones while you are fresh.' },
]

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

/**
 * IB HL courses are the SL course plus additional higher level content. An HL
 * student can usefully sit either half on its own: the core when they are
 * behind, the extension when they are revising for the paper that only tests
 * it. SL students never see this, because there is no second half to choose.
 */
const LEVELS = [
  { key: 'all', label: 'Everything', hint: 'Core and HL extension together' },
  { key: 'core', label: 'Core only', hint: 'The content SL students also sit' },
  { key: 'hl', label: 'HL extension only', hint: 'Only the additional higher level content' },
]

/**
 * Heat, as something to filter by. The ranges are the same cut points the
 * badge uses, so "Burning" on this screen and "Burning" on a question are the
 * same set of questions rather than two different opinions.
 */
const DIFFICULTIES = [
  { key: 'mixed', label: 'Any heat', range: null },
  ...HEAT_LEVELS.map((h) => ({ key: h.key, label: h.label, range: HEAT_RANGES[h.key] })),
]

/**
 * One decision per block, numbered.
 *
 * This page was nine sections in a column, each with its own rule and heading,
 * which is a wall of controls rather than a thing you are building. They fall
 * into three questions — what goes in it, how hard and how long, and how you
 * sit it — so those are the three blocks now, and the settings inside them are
 * no longer separated from each other as though they were unrelated.
 */
function Step({ n, title, hint, children }) {
  return (
    <section className="mb-10 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-6 flex items-baseline gap-3">
        <span
          className="text-[11px] font-semibold tabular-nums tracking-[0.16em]"
          style={{ color: 'var(--text-faint)' }}
        >
          {String(n).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-[-0.018em]">{title}</h2>
          {hint && (
            <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {hint}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function TestBuilderPage() {
  const [profile, setProfile] = useState(null)
  const [subject, setSubject] = useState('')
  const [topics, setTopics] = useState([])
  const [pool, setPool] = useState([])
  const [statusBySubtopic, setStatusBySubtopic] = useState({})
  const [selected, setSelected] = useState([])
  const [length, setLength] = useState(20)
  const [timed, setTimed] = useState(true)
  const [qtype, setQtype] = useState('all')
  const [order, setOrder] = useState('mixed')
  // A length you typed, and a limit you chose. Both are optional: leaving them
  // alone keeps the presets and the time the questions are actually worth.
  const [customLength, setCustomLength] = useState('')
  const [customMinutes, setCustomMinutes] = useState('')
  const [focusMode, setFocusMode] = useState('all')
  const [difficulty, setDifficulty] = useState('mixed')
  const [level, setLevel] = useState('all')
  const [hlBySubtopic, setHlBySubtopic] = useState({})
  const [loading, setLoading] = useState(true)

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight. A page that has arrived but has no data yet is the
  // part that feels broken.
  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])
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
      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })
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

      // Which subtopics are the HL extension, so a paper can be split by level.
      const hlMap = {}
      for (const row of syllabus || []) hlMap[row.subtopic] = !!row.hl_only

      const unique = [...new Set((syllabus || []).map((r) => r.topic))]
      const ordered = sortTopics(unique.map((t) => [t, null])).map(([t]) => t)

      setTopics(ordered)
      setHlBySubtopic(hlMap)
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

      if (level !== 'all') {
        const isHL = !!hlBySubtopic[q.subtopic]
        if (level === 'hl' && !isHL) return false
        if (level === 'core' && isHL) return false
      }

      if (diff?.range) {
        const d = typeof q.difficulty === 'number' ? q.difficulty : 0.5
        if (d < diff.range[0] || d > diff.range[1]) return false
      }

      if (qtype !== 'all' && (q.question_type || 'mcq') !== qtype) return false

      return true
    })
  }, [pool, selected, focusMode, difficulty, statusBySubtopic, level, hlBySubtopic, qtype])

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
  const isHLSubject = profile?.curriculum === 'IB' && / HL$/.test(subject)
  const hlCount = Object.values(hlBySubtopic).filter(Boolean).length
  // A typed length wins over the presets, clamped to something sittable. Blank
  // has to stay blank: clamping an empty box up to 1 is how "85 questions
  // match" turned into a one-question paper.
  const parsedLength = parseInt(customLength, 10)
  const typedLength = Number.isFinite(parsedLength) && parsedLength > 0
    ? Math.min(100, parsedLength)
    : 0
  const wantedLength = typedLength || length
  const actualLength = Math.min(wantedLength, eligible.length)
  const canStart = actualLength > 0

  // Real paper metrics, taken from the questions that would actually be drawn.
  const sample = eligible.slice(0, actualLength)
  const totalMarks = sample.reduce((s, q) => s + (q.marks || 1), 0)
  const totalSeconds = sample.reduce((s, q) => s + (q.time_budget_seconds || 90), 0)
  const budgetMinutes = Math.max(1, Math.round(totalSeconds / 60))
  const parsedMinutes = parseInt(customMinutes, 10)
  const typedMinutes = Number.isFinite(parsedMinutes) && parsedMinutes > 0
    ? Math.min(240, parsedMinutes)
    : 0
  const estMinutes = timed && typedMinutes ? typedMinutes : budgetMinutes

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
    if (qtype !== 'all') params.set('qtype', qtype)
    if (order !== 'mixed') params.set('order', order)
    if (timed && typedMinutes) params.set('minutes', String(typedMinutes))
    if (focusMode !== 'all') params.set('focus', focusMode)
    if (difficulty !== 'mixed') params.set('difficulty', difficulty)
    if (level !== 'all') params.set('level', level)
    router.push(`/dashboard/quiz?${params.toString()}`)
  }

  return (
    <DashboardLayout profile={profile}>
      <Page width="wide">
        <PageHeader
          eyebrow="Test builder"
          title="Build a Test"
          subtitle="Set the paper on the left. It takes shape on the right as you go."
        />

        <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-14">
          <div>

        <Step n={1} title="What goes in it" hint="The subject, the half of the course, and which topics it draws from.">
        {/* Subject */}
        <div className="mb-7">
          <label htmlFor="subject" className="mb-2 block text-[13.5px] font-medium">
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

        {/* Level. Only an IB HL subject has two halves to choose between. */}
        {isHLSubject && hlCount > 0 && (
          <div className="mb-7">
            <p className="text-[13.5px] font-medium">Level</p>
            <p className="t-caption mb-3">
              {hlCount} of your subtopics in this subject are HL extension.
            </p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setLevel(l.key)}
                  aria-pressed={level === l.key}
                  title={l.hint}
                  className={`${level === l.key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* What to draw from */}
        <div className="mb-7">
          <p className="mb-3 text-[13.5px] font-medium">What should this test cover?</p>
          <div className="flex flex-col gap-2">
            {FOCUS_MODES.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setFocusMode(mode.key)}
                aria-pressed={focusMode === mode.key}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
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
        <div className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13.5px] font-medium">Topics</p>
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
                    className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors duration-150 ${
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

        </Step>

        <Step n={2} title="How hard, and how long" hint="Heat sets the difficulty; the rest sets the shape of the paper.">
        {/* Difficulty and length */}
        <div className="mb-7">
          <p className="text-[13.5px] font-medium">Heat</p>
          <p className="t-caption mb-3">
            How hard the questions are. Burning is the hardest end of the paper.
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => {
              const n = d.range
                ? pool.filter((q) => {
                    const v = typeof q.difficulty === 'number' ? q.difficulty : 0.5
                    return v > d.range[0] && v <= d.range[1]
                  }).length
                : pool.length
              return (
                <button
                  key={d.key}
                  onClick={() => setDifficulty(d.key)}
                  aria-pressed={difficulty === d.key}
                  disabled={n === 0}
                  className={`${difficulty === d.key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
                >
                  {d.label}
                  <span className="ml-2 opacity-60">{n}</span>
                </button>
              )
            })}
          </div>

          <p className="text-[13.5px] font-medium">Question type</p>
          <p className="t-caption mb-3">
            What the paper is made of. A type your subject has none of is ignored rather than
            handed back empty.
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => {
              const n =
                t.key === 'all'
                  ? pool.length
                  : pool.filter((q) => (q.question_type || 'mcq') === t.key).length
              return (
                <button
                  key={t.key}
                  onClick={() => setQtype(t.key)}
                  aria-pressed={qtype === t.key}
                  title={t.hint}
                  disabled={n === 0}
                  className={`${qtype === t.key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
                >
                  {t.label}
                  <span className="ml-2 opacity-60">{n}</span>
                </button>
              )
            })}
          </div>

          <p className="text-[13.5px] font-medium">Order</p>
          <p className="t-caption mb-3">The order you sit them in, once they have been chosen.</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {ORDERS.map((o) => (
              <button
                key={o.key}
                onClick={() => setOrder(o.key)}
                aria-pressed={order === o.key}
                title={o.hint}
                className={`${order === o.key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <p className="mb-3 text-[13.5px] font-medium">Length</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {LENGTHS.map((n) => (
              <button
                key={n}
                onClick={() => setLength(n)}
                aria-pressed={length === n}
                className={`${length === n ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
              >
                {n} questions
              </button>
            ))}
            <label className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={customLength}
                aria-label="Or type how many questions"
                placeholder="or type"
                onChange={(e) => setCustomLength(e.target.value.replace(/[^0-9]/g, ''))}
                className="input control-md w-[104px] text-center tabular-nums"
              />
            </label>
          </div>
        </div>
        </Step>

        <Step n={3} title="How you sit it" hint="Untimed to learn, timed to rehearse the real thing.">
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
            <span className="text-[13.5px] text-[var(--text-body)]">
              Exam conditions: countdown and live marks-per-minute pacing
            </span>
          </button>

          {timed && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                  Time limit
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customMinutes}
                  aria-label="Time limit in minutes"
                  placeholder={String(budgetMinutes)}
                  onChange={(e) => setCustomMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                  className="input control-sm w-[88px] text-center tabular-nums"
                />
                <span className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                  minutes
                </span>
              </label>
              <span className="t-caption">
                Leave it blank for {budgetMinutes} minutes, which is what these questions are worth
                in real exam time.
              </span>
            </div>
          )}
        </Step>

          </div>

          {/* The paper, as it currently stands. */}
          <aside className="lg:sticky lg:top-10 lg:self-start">
            <div
              className="rounded-[12px] border p-5"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <p
                className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--text-faint)' }}
              >
                Your paper
              </p>
              <p className="text-[15px] font-semibold leading-snug tracking-[-0.015em]">{subject}</p>
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                {selected.length === topics.length
                  ? 'All topics'
                  : `${selected.length} of ${topics.length} topic${topics.length === 1 ? '' : 's'}`}
                {level !== 'all' ? ` · ${LEVELS.find((l) => l.key === level)?.label}` : ''}
                {difficulty !== 'mixed'
                  ? ` · ${DIFFICULTIES.find((d) => d.key === difficulty)?.label}`
                  : ''}
              </p>

              <div className="my-5 h-px" style={{ background: 'var(--border)' }} />

              {canStart ? (
                <>
                  <dl className="mb-7 flex flex-wrap gap-x-9 gap-y-5">
                    {[
                      ['Questions', actualLength],
                      ['Marks', totalMarks],
                      [timed ? 'Time limit' : 'Est. time', `${estMinutes}m`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                          {label}
                        </dt>
                        <dd className="mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.028em] tabular-nums">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {actualLength < length && (
                    <p className="mb-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
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
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {selected.length === 0
                    ? 'Select at least one topic to build a paper.'
                    : 'Nothing matches these settings. Try a different focus, a wider heat range, or more topics.'}
                </p>
              )}
            </div>
          </aside>
        </div>
      </Page>
    </DashboardLayout>
  )
}
