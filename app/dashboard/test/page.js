'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getSyllabus, getProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import TestBuilder from '@/components/TestBuilder'
import { Page, PageHeader, PageLoading, SkeletonLine } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { IconClock, IconCheck, IconChevronRight } from '@/components/Icons'
import {
  sortTopics,
  groupByTopic,
  progressKey,
  displaySubtopic,
  HEAT_LEVELS,
  HEAT_RANGES,
} from '@/lib/progress'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { accessibleSubjects, isPremium } from '@/lib/access'
import { IB_CORE_SUBJECTS } from '@/lib/ib-points'

// Five is there because most revision is not an hour of it. Five questions is
// a bus stop, a gap between lessons, the thing you actually do rather than the
// thing you plan to do on Sunday.
const LENGTHS = [5, 10, 20, 45]

/** The same paper, counted out the way you happen to be thinking about it. */
const LENGTH_PRESETS = {
  questions: LENGTHS,
  marks: [10, 20, 40, 80],
  minutes: [5, 15, 30, 60],
}
const LENGTH_UNIT = { questions: 'questions', marks: 'marks', minutes: 'min' }

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

export default function TestBuilderPage() {
  const [profile, setProfile] = useState(null)
  const [subject, setSubject] = useState('')
  const [topics, setTopics] = useState([])
  const [pool, setPool] = useState([])
  const [statusBySubtopic, setStatusBySubtopic] = useState({})
  const [selected, setSelected] = useState([])
  // Subtopics picked inside an opened topic. Empty for a topic means "all of
  // it", so ticking a topic and never opening it behaves as it always did.
  const [pickedSubtopics, setPickedSubtopics] = useState({})
  const [openTopic, setOpenTopic] = useState(null)
  const [unitBySubtopic, setUnitBySubtopic] = useState({})
  // 'questions' | 'marks' | 'minutes' — how the length is counted out.
  const [lengthMetric, setLengthMetric] = useState('questions')
  const [review, setReview] = useState('practice')
  // Hints follow exam mode rather than having a switch of their own: a real
  // paper has no hint button, and two toggles for one idea is how a builder
  // becomes a settings page.
  const hintsAllowed = review !== 'exam'
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

      // Topics in the guide's order, and where each subtopic sits inside one:
      // the builder groups by unit, and a picker sorted alphabetically puts
      // momentum before kinematics.
      const ordered = sortTopics(Object.entries(groupByTopic(syllabus || []))).map(([t]) => t)
      const units = {}
      for (const row of syllabus || []) {
        units[row.subtopic] = { unit: row.unit || null, code: row.code || null, position: row.position }
      }

      setUnitBySubtopic(units)
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
      // A topic with nothing ticked inside it means the whole topic.
      const within = pickedSubtopics[q.topic]
      if (within?.length && !within.includes(q.subtopic)) return false

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
  }, [pool, selected, pickedSubtopics, focusMode, difficulty, statusBySubtopic, level, hlBySubtopic, qtype])

  /** Subtopic → how many questions exist, grouped under its topic. */
  const subtopicsByTopic = useMemo(() => {
    const out = {}
    for (const q of pool) {
      ;(out[q.topic] ||= {})
      out[q.topic][q.subtopic] = (out[q.topic][q.subtopic] || 0) + 1
    }
    return out
  }, [pool])

  /** Every subtopic actually being drawn from, or null for "whole topics". */
  const effectiveSubtopics = useMemo(() => {
    const picked = selected.flatMap((t) => pickedSubtopics[t] || [])
    return picked.length ? picked : null
  }, [selected, pickedSubtopics])


  const perTopicCounts = useMemo(() => {
    const counts = {}
    for (const q of pool) counts[q.topic] = (counts[q.topic] || 0) + 1
    return counts
  }, [pool])

  /**
   * The spread of heat across the questions that would actually be drawn.
   *
   * A count tells you how big the paper is. This tells you what sitting it
   * will feel like, which is the thing you are really choosing when you set a
   * heat filter — and it is drawn from the questions themselves rather than
   * from the filter, so a "Burning" paper that only has four burning questions
   * in it says so.
   */
  const composition = useMemo(() => {
    const drawn = eligible
    if (!drawn.length) return []
    const counts = {}
    for (const q of drawn) {
      const v = typeof q.difficulty === 'number' ? q.difficulty : 0.5
      const level = HEAT_LEVELS.find((h) => v <= h.max) || HEAT_LEVELS[HEAT_LEVELS.length - 1]
      counts[level.key] = (counts[level.key] || 0) + 1
    }
    return HEAT_LEVELS.filter((h) => counts[h.key]).map((h) => ({
      key: h.key,
      label: h.label,
      count: counts[h.key],
      share: counts[h.key] / drawn.length,
      color: `var(--heat-${h.key}, var(--brand))`,
    }))
  }, [eligible])

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
  /**
   * How many questions that length actually is.
   *
   * A paper is as long as it takes, and students think about that in three
   * different units depending on why they are sitting it: fifteen questions
   * before bed, forty marks to match a real Paper 1, or twenty minutes on the
   * bus. Same draw, counted out differently.
   */
  const lengthFromMetric = () => {
    if (lengthMetric === 'questions') return Math.min(wantedLength, eligible.length)
    let total = 0
    for (let i = 0; i < eligible.length; i++) {
      total +=
        lengthMetric === 'marks' ? eligible[i].marks || 1 : (eligible[i].time_budget_seconds || 90) / 60
      if (total >= wantedLength) return i + 1
    }
    return eligible.length
  }
  const actualLength = lengthFromMetric()

  /** What this paper is drawn from, in one line. */
  const scopeLabel = [
    selected.length === topics.length
      ? 'All topics'
      : `${selected.length} of ${topics.length} topic${topics.length === 1 ? '' : 's'}`,
    effectiveSubtopics ? `${effectiveSubtopics.length} subtopics` : null,
    level !== 'all' ? LEVELS.find((l) => l.key === level)?.label : null,
    focusMode !== 'all' ? FOCUS_MODES.find((f) => f.key === focusMode)?.label : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const canStart = actualLength > 0

  /**
   * Why nothing matched, when nothing matched.
   *
   * "Nothing matches these settings" is true and useless: four filters can each
   * be reasonable and still intersect to nothing, and the one actually
   * responsible is usually the source. Picking subtopics you have never been
   * tested on while the source is set to your weak spots is the common way in,
   * and the page used to just disable the button and say nothing.
   *
   * So each filter is relaxed in turn to see which one is doing it.
   */
  const emptyReason = (() => {
    if (canStart || !selected.length) return null
    const inTopics = pool.filter((q) => selected.includes(q.topic))
    if (!inTopics.length) return 'There are no questions in these topics yet.'

    const picked = inTopics.filter((q) => {
      const within = pickedSubtopics[q.topic]
      return !(within?.length && !within.includes(q.subtopic))
    })
    if (!picked.length) return 'No questions have been written for the subtopics you ticked yet.'

    const mode = FOCUS_MODES.find((m) => m.key === focusMode)
    if (mode?.statuses) {
      const surviving = picked.filter((q) =>
        mode.statuses.includes(statusBySubtopic[q.subtopic] || 'not_started')
      )
      if (!surviving.length) {
        return `Nothing here matches “${mode.label}”. These subtopics have not been tested yet, so none of them count as weak. Go back and draw from everything.`
      }
    }
    if (level !== 'all') return 'Nothing at this level. Try “Everything” on the first step.'
    if (difficulty !== 'mixed') return 'No questions at this heat. Try “Any heat”.'
    if (qtype !== 'all') return 'No questions of this type. Try “Any kind”.'
    return 'Nothing matches these settings.'
  })()

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
    if (effectiveSubtopics) params.set('subtopics', effectiveSubtopics.join('~~'))
    if (review !== 'exam') params.set('review', review)
    if (!hintsAllowed) params.set('hints', '0')
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

        <TestBuilder
          subject={subject}
          subjects={usable}
          onSubject={setSubject}
          freeNote={
            !isPremium(profile) && (profile.subjects || []).length > usable.length
              ? 'The free plan covers one subject. A school code opens the rest.'
              : null
          }
          levels={LEVELS}
          level={level}
          onLevel={setLevel}
          showLevel={isHLSubject && hlCount > 0}
          hlCount={hlCount}
          focusModes={FOCUS_MODES}
          focusMode={focusMode}
          onFocusMode={setFocusMode}
          topics={topics}
          selected={selected}
          onToggleTopic={toggleTopic}
          onSelectAll={() => setSelected(selected.length === topics.length ? [] : topics)}
          perTopicCounts={perTopicCounts}
          subtopicsByTopic={subtopicsByTopic}
          unitBySubtopic={unitBySubtopic}
          pickedSubtopics={pickedSubtopics}
          onToggleSubtopic={(topic, name) =>
            setPickedSubtopics((prev) => {
              const cur = prev[topic] || []
              return {
                ...prev,
                [topic]: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name],
              }
            })
          }
          openTopic={openTopic}
          onOpenTopic={setOpenTopic}
          loadingPool={loadingPool}
          difficulties={DIFFICULTIES}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          difficultyCount={(d) =>
            d.range
              ? pool.filter((q) => {
                  const v = typeof q.difficulty === 'number' ? q.difficulty : 0.5
                  return v > d.range[0] && v <= d.range[1]
                }).length
              : pool.length
          }
          questionTypes={QUESTION_TYPES}
          qtype={qtype}
          onQtype={setQtype}
          qtypeCount={(t) =>
            t.key === 'all'
              ? pool.length
              : pool.filter((q) => (q.question_type || 'mcq') === t.key).length
          }
          orders={ORDERS}
          order={order}
          onOrder={setOrder}
          lengthMetric={lengthMetric}
          onLengthMetric={setLengthMetric}
          lengthPresets={LENGTH_PRESETS}
          lengthUnit={LENGTH_UNIT}
          length={length}
          onLength={(n) => {
            setLength(n)
            setCustomLength('')
          }}
          customLength={customLength}
          onCustomLength={setCustomLength}
          timed={timed}
          onTimed={setTimed}
          customMinutes={customMinutes}
          onCustomMinutes={setCustomMinutes}
          budgetMinutes={budgetMinutes}
          review={review}
          onReview={setReview}
          paper={{
            canStart,
            actualLength,
            totalMarks,
            estMinutes,
            eligibleCount: eligible.length,
            short: actualLength < wantedLength,
            emptyReason,
            scopeLabel,
            composition,
          }}
          onStart={startTest}
        />
      </Page>
    </DashboardLayout>
  )
}
