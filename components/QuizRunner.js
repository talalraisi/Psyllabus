'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CopyButton from '@/components/CopyButton'
import HeatBadge from '@/components/HeatBadge'
import QuestionFigure from '@/components/QuestionFigure'
import QuestionStimulus from '@/components/QuestionStimulus'
import ReportQuestion from '@/components/ReportQuestion'
import { EmptyState } from '@/components/PageShell'
import { IconCheck, IconClose } from '@/components/Icons'
import { gradeAnswer } from '@/lib/grading'
import { createClient } from '@/lib/supabase'
import {
  statusFromPoints,
  pointsForQuestion,
  pointsToNextLevel,
  masteryFraction,
  MASTERY_TARGET,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_TEXT_COLORS,
} from '@/lib/progress'
import { getCurrentUser } from '@/lib/auth'
import { getSyllabus, getProfile } from '@/lib/cache'
import { paperById, typesForStyle } from '@/lib/papers'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { progressKey, HEAT_RANGES } from '@/lib/progress'

const PHASE = {
  loading: 'loading',
  empty: 'empty',
  predict: 'predict',
  quiz: 'quiz',
  results: 'results',
}

const SUBTOPIC_COUNT = 10
const MOCK_COUNT = 15
const MISTAKES_COUNT = 15
// Spaced-repetition intervals in days, indexed by consecutive correct reviews
/**
 * Spacing between reviews of a question you got wrong: tomorrow, then three
 * days, then five. Get it right three times running and it leaves the bank.
 *
 * A mistake bank that only grows is a list nobody opens. Three correct recalls
 * spread over nine days is decent evidence the gap has closed, and anything
 * still shaky comes straight back the next time the question is drawn in a
 * normal quiz.
 */
/** One question as plain text: stem, options, and the answer if it is known. */
function questionAsText(question, { includeAnswer = false } = {}) {
  const opts = (question.options || []).map((o) => `${o.id}) ${o.text}`).join('\n')
  // The extract goes with it. Copying a question about an unseen text without
  // the text produces something nobody can answer later.
  const parts = [question.stimulus, question.stem, opts]
  if (includeAnswer) {
    parts.push(`Answer: ${question.correct_answer}`)
    if (question.explanation) parts.push(question.explanation)
  }
  return parts.filter(Boolean).join('\n')
}

/** The whole paper, for pasting into notes or a revision doc. */
function paperAsText(graded) {
  return graded
    .map((g, i) => `${i + 1}. ${questionAsText(g.question, { includeAnswer: true })}`)
    .join('\n\n')
}

const REVIEW_INTERVALS = [1, 3, 5]
const REVIEWS_TO_CLEAR = 3
const DAY_MS = 24 * 60 * 60 * 1000

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// Bands live in lib/progress.js so the quiz, the heatmap and the legend can
// never disagree about what a score means.

/** Mirrors the quiz itself: rail, stem, four options. No card, because the
 *  quiz has no card either, and a skeleton that is the wrong shape reads as
 *  the page breaking rather than loading. */
function Skeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton h-1 flex-1 rounded-full" />
        ))}
      </div>
      <div className="skeleton mt-6 h-3.5 w-40 rounded" />
      <div className="skeleton mt-6 h-4 w-full rounded" />
      <div className="skeleton mt-2 h-4 w-2/3 rounded" />
      <div className="mt-7 flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[52px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle opacity-70"
      aria-hidden="true"
    />
  )
}

export default function QuizRunner({
  subject,
  topic,
  subtopic,
  mode = 'subtopic',
  count,
  topics,
  timed: timedProp = false,
  focus = null,
  difficulty = null,
  level = null,
  paper = null,
  backHref = '/dashboard',
}) {
  const [phase, setPhase] = useState(PHASE.loading)
  const [emptyMessage, setEmptyMessage] = useState('')
  const [questions, setQuestions] = useState([])
  const [mistakeRowsById, setMistakeRowsById] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [predictedScore, setPredictedScore] = useState('')
  const [results, setResults] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [hintsShown, setHintsShown] = useState({})
  const router = useRouter()
  const supabase = createClient()

  // A paper is sat under exam conditions by definition.
  const timed = mode === 'mock' || mode === 'paper' || timedProp
  const [curriculumId, setCurriculumId] = useState('IB')
  const paperDefinition = mode === 'paper' && paper ? paperById(subject, curriculumId, paper) : null
  const timeLimitRef = useRef(null)
  const questionTimesRef = useRef({})
  const lastSwitchRef = useRef(null)
  const finishRef = useRef(null)
  const answersRef = useRef({})

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      if (mode === 'mistakes') {
        const { data: rows } = await supabase
          .from('mistakes')
          .select('*, questions(*)')
          .eq('user_id', user.id)
          .lte('next_review_at', new Date().toISOString())
          .order('next_review_at', { ascending: true })
          .limit(MISTAKES_COUNT)

        const withQuestions = (rows || []).filter((r) => r.questions)
        if (!withQuestions.length) {
          setEmptyMessage('No reviews due right now. Mistakes you make in quizzes will queue up here.')
          setPhase(PHASE.empty)
          return
        }
        setMistakeRowsById(
          withQuestions.reduce((acc, r) => {
            acc[r.question_id] = r
            return acc
          }, {})
        )
        setQuestions(shuffle(withQuestions.map((r) => r.questions)))
        setPhase(PHASE.predict)
        return
      }

      const profileRow = await getProfile(supabase, user.id)
      const curriculum = profileRow?.curriculum || 'IB'
      setCurriculumId(curriculum)

      let query = supabase
        .from('questions')
        .select('*')
        .eq('subject', subject)
        .eq('verified', true)

      if (mode === 'subtopic') query = query.eq('subtopic', subtopic)
      else if (mode === 'topic') query = query.eq('topic', topic)
      else if (mode === 'custom' && topics?.length) query = query.in('topic', topics)

      const { data: questionRows } = await query

      if (!questionRows?.length) {
        setEmptyMessage('We are still building the question bank for this area. Check back soon.')
        setPhase(PHASE.empty)
        return
      }

      let candidates = questionRows

      // Heat bands come from one definition shared with the test builder, so
      // picking "Burning" there cannot quietly select something else here.
      if (difficulty && HEAT_RANGES[difficulty]) {
        const [lo, hi] = HEAT_RANGES[difficulty]
        const banded = candidates.filter((q) => {
          const d = typeof q.difficulty === 'number' ? q.difficulty : 0.5
          return d > lo && d <= hi
        })
        if (banded.length) candidates = banded
      }

      // A paper has a shape of its own: which question types it holds, which
      // half of the course it draws from, and how long it runs. It is applied
      // before anything else, because it is the whole point of sitting one.
      let paperDef = null
      if (mode === 'paper' && paper) {
        paperDef = paperById(subject, curriculum, paper)
        if (paperDef) {
          const types = typesForStyle(paperDef.style)
          if (types) {
            const typed = candidates.filter((q) => types.includes(q.question_type || 'mcq'))
            if (typed.length) candidates = typed
          }
          if (paperDef.scope === 'hl') {
            const syllabus = await getSyllabus(supabase, [subject])
            const hlBySubtopic = {}
            for (const row of syllabus || []) hlBySubtopic[row.subtopic] = !!row.hl_only
            const hlOnly = candidates.filter((q) => hlBySubtopic[q.subtopic])
            if (hlOnly.length) candidates = hlOnly
          }
        }
      }

      // Level splits an IB HL course into the half SL students also sit and
      // the extension on top of it. Which subtopics are which lives in the
      // syllabus, not on the question, so it is looked up here.
      if (level === 'core' || level === 'hl') {
        const syllabus = await getSyllabus(supabase, [subject])
        const hlBySubtopic = {}
        for (const row of syllabus || []) hlBySubtopic[row.subtopic] = !!row.hl_only
        const levelled = candidates.filter((q) =>
          level === 'hl' ? hlBySubtopic[q.subtopic] : !hlBySubtopic[q.subtopic]
        )
        if (levelled.length) candidates = levelled
      }

      // Focus draws only from subtopics at the relevant mastery level.
      if (focus) {
        const { data: progressRows } = await supabase
          .from('progress')
          .select('subject, subtopic, status, updated_at')
          .eq('user_id', user.id)
        const effective = buildEffectiveProgressMap(progressRows)
        const wanted =
          focus === 'weak'
            ? ['in_progress', 'confident', 'proficient', 'decaying']
            : focus === 'untested'
              ? ['not_started']
              : null

        if (wanted) {
          const focused = candidates.filter((q) => {
            const status = effective[progressKey(q.subject, q.subtopic)] || 'not_started'
            return wanted.includes(status)
          })
          if (focused.length) candidates = focused
        }
      }

      if (!candidates.length) candidates = questionRows

      const questionRowsFiltered = candidates
      const target =
        paperDef?.target ||
        count ||
        (mode === 'mock' ? MOCK_COUNT : mode === 'topic' ? 15 : SUBTOPIC_COUNT)

      // Serve unseen questions first so repeats only happen once this pool is
      // exhausted. Falls back to seen ones (oldest-seen first) to fill the paper.
      const { data: seenRows } = await supabase
        .from('question_responses')
        .select('question_id, created_at')
        .in(
          'question_id',
          questionRowsFiltered.slice(0, 1000).map((q) => q.id)
        )
        .order('created_at', { ascending: false })

      const lastSeenAt = new Map()
      for (const r of seenRows || []) {
        if (!lastSeenAt.has(r.question_id)) lastSeenAt.set(r.question_id, r.created_at)
      }

      const unseen = shuffle(questionRowsFiltered.filter((q) => !lastSeenAt.has(q.id)))
      const seen = questionRowsFiltered
        .filter((q) => lastSeenAt.has(q.id))
        .sort((a, b) => new Date(lastSeenAt.get(a.id)) - new Date(lastSeenAt.get(b.id)))

      setQuestions([...unseen, ...seen].slice(0, target))
      setPhase(PHASE.predict)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, topic, subtopic, mode, count, topics?.join('|'), focus, difficulty, level, paper])

  const startQuiz = () => {
    questionTimesRef.current = {}
    lastSwitchRef.current = Date.now()
    if (timed) {
      const limit = questions.reduce((sum, q) => sum + (q.time_budget_seconds || 90), 0)
      timeLimitRef.current = limit
      setSecondsLeft(limit)
    }
    setCurrentIndex(0)
    setAnswers({})
    setPhase(PHASE.quiz)
  }

  // Countdown for timed mocks, auto-submits at zero.
  useEffect(() => {
    if (phase !== PHASE.quiz || !timed) return
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          finishRef.current?.()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, timed])

  const commitTime = useCallback((questionId) => {
    const now = Date.now()
    if (lastSwitchRef.current != null && questionId) {
      const elapsed = Math.round((now - lastSwitchRef.current) / 1000)
      questionTimesRef.current[questionId] =
        (questionTimesRef.current[questionId] || 0) + elapsed
    }
    lastSwitchRef.current = now
  }, [])

  const goTo = (nextIndex) => {
    commitTime(questions[currentIndex]?.id)
    setCurrentIndex(nextIndex)
  }

  const selectAnswer = (questionId, optionId) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionId }
      answersRef.current = next
      return next
    })
  }

  const finishQuiz = useCallback(async () => {
    if (!userId || submitting) return
    setSubmitting(true)
    commitTime(questions[currentIndex]?.id)

    const currentAnswers = answersRef.current
    const graded = questions.map((q) => {
      const selected = currentAnswers[q.id] ?? null
      const { correct } = gradeAnswer(q, selected)
      return {
        question: q,
        selected,
        correct,
        timeSpent: questionTimesRef.current[q.id] || 0,
      }
    })

    const score = graded.filter((g) => g.correct).length
    const total = questions.length
    const accuracy = total ? score / total : 0
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0)
    const elapsed = timed
      ? timeLimitRef.current - Math.max(0, secondsLeft ?? 0)
      : graded.reduce((sum, g) => sum + g.timeSpent, 0)
    const prediction = predictedScore !== '' ? parseInt(predictedScore, 10) : null

    const { data: attempt } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        subject: subject || null,
        topic: topic || questions[0]?.topic || null,
        subtopic: mode === 'subtopic' ? subtopic : null,
        // DB constraint allows subtopic|topic|mock|mistakes
        // quiz_attempts.quiz_type is constrained to four values. A paper is a
        // timed mock as far as that column is concerned, so it is stored as one
        // rather than failing the insert at the moment the student finishes.
        quiz_type:
          mode === 'paper' ? 'mock' : mode === 'custom' ? (timed ? 'mock' : 'topic') : mode,
        predicted_score: prediction,
        score,
        total_questions: total,
        total_marks: totalMarks,
        accuracy,
        timed,
        time_limit_seconds: timed ? timeLimitRef.current : null,
        elapsed_seconds: elapsed,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (attempt) {
      await supabase.from('question_responses').insert(
        graded.map((g) => ({
          attempt_id: attempt.id,
          question_id: g.question.id,
          selected_answer: g.selected,
          is_correct: g.correct,
          time_spent_seconds: g.timeSpent,
        }))
      )
    }

    let earnedSummary = []
    let clearedFromBank = 0

    // Award mastery points, then restate each touched subtopic from its running
    // total. Every subtopic this paper covered is scored on its own questions,
    // so a topic test or a mock updates each one separately.
    if (mode !== 'mistakes') {
      // Only correct answers pay, and the unique index on (user_id,
      // question_id) means each question pays exactly once however many times
      // it comes back. Ignoring the conflict is the whole anti-farming rule.
      const credits = graded
        .filter((g) => g.correct)
        .map((g) => ({
          user_id: userId,
          question_id: g.question.id,
          subject: g.question.subject,
          subtopic: g.question.subtopic,
          points: pointsForQuestion(g.question.difficulty),
        }))

      if (credits.length) {
        await supabase.from('mastery_credits').upsert(credits, {
          onConflict: 'user_id,question_id',
          ignoreDuplicates: true,
        })
      }

      // Re-read the totals rather than adding up locally: the insert above
      // silently drops questions already credited, so the database is the only
      // thing that knows what this attempt actually earned.
      const touched = [...new Set(graded.map((g) => `${g.question.subject}|||${g.question.subtopic}`))]
      const meta = new Map(
        graded.map((g) => [
          `${g.question.subject}|||${g.question.subtopic}`,
          { subject: g.question.subject, topic: g.question.topic, subtopic: g.question.subtopic },
        ])
      )

      const { data: creditRows } = await supabase
        .from('mastery_credits')
        .select('subject, subtopic, points')
        .eq('user_id', userId)
        .in(
          'subtopic',
          touched.map((k) => k.split('|||')[1])
        )

      const totals = new Map()
      for (const row of creditRows || []) {
        const key = `${row.subject}|||${row.subtopic}`
        totals.set(key, (totals.get(key) || 0) + Number(row.points))
      }

      // Which subtopics had at least one right answer. Fading clears only for
      // these: revisiting a subtopic and getting everything wrong is not
      // evidence that you still know it.
      const gotSomethingRight = new Set(
        graded.filter((g) => g.correct).map((g) => `${g.question.subject}|||${g.question.subtopic}`)
      )

      const now = new Date().toISOString()
      const rows = touched.map((key) => {
        const m = meta.get(key)
        const points = +(totals.get(key) || 0).toFixed(2)
        const row = {
          user_id: userId,
          subject: m.subject,
          topic: m.topic || '',
          subtopic: m.subtopic,
          mastery_points: points,
          status: statusFromPoints(points),
          updated_at: now,
        }
        if (gotSomethingRight.has(key)) row.last_correct_at = now
        return row
      })

      if (rows.length) {
        await supabase.from('progress').upsert(rows, {
          onConflict: 'user_id,subject,subtopic',
        })
      }

      earnedSummary = rows.map((r) => ({
        subtopic: r.subtopic,
        points: r.mastery_points,
        status: r.status,
      }))
    }

    if (mode === 'mistakes') {
      await Promise.all(
        graded.map((g) => {
          const row = mistakeRowsById[g.question.id]
          if (!row) return null

          // Wrong again puts it back to the start of the schedule.
          const reviewCount = g.correct ? (row.review_count || 0) + 1 : 0

          if (reviewCount >= REVIEWS_TO_CLEAR) {
            return supabase.from('mistakes').delete().eq('id', row.id)
          }

          const intervalDays = REVIEW_INTERVALS[Math.min(reviewCount, REVIEW_INTERVALS.length - 1)]
          return supabase
            .from('mistakes')
            .update({
              review_count: reviewCount,
              next_review_at: new Date(Date.now() + intervalDays * DAY_MS).toISOString(),
            })
            .eq('id', row.id)
        })
      )

      const cleared = graded.filter((g) => {
        const row = mistakeRowsById[g.question.id]
        return row && g.correct && (row.review_count || 0) + 1 >= REVIEWS_TO_CLEAR
      }).length
      if (cleared > 0) clearedFromBank = cleared
    } else {
      const wrong = graded.filter((g) => !g.correct)
      if (wrong.length) {
        await supabase.from('mistakes').upsert(
          wrong.map((g) => ({
            user_id: userId,
            question_id: g.question.id,
            attempt_id: attempt?.id || null,
            subject: g.question.subject,
            review_count: 0,
            next_review_at: new Date(Date.now() + DAY_MS).toISOString(),
          })),
          { onConflict: 'user_id,question_id' }
        )
      }
    }

    setResults({
      score,
      total,
      accuracy,
      prediction,
      graded,
      totalMarks,
      elapsed,
      earned: earnedSummary,
      clearedFromBank,
    })
    setPhase(PHASE.results)
    setSubmitting(false)
  }, [userId, submitting, questions, currentIndex, secondsLeft, predictedScore, mode, subject, topic, subtopic, timed, mistakeRowsById, commitTime, supabase])

  finishRef.current = finishQuiz

  if (phase === PHASE.loading) return <Skeleton />

  if (phase === PHASE.empty) {
    return (
      <EmptyState
        title={mode === 'mistakes' ? 'Nothing to review' : 'Questions coming soon'}
        description={emptyMessage}
        action={
          <Link href={backHref} className="btn btn-solid control-md">
            Go back
          </Link>
        }
      />
    )
  }

  /* The brief. One thing to read, one thing to press. Everything that used to
     sit in a tinted box is now reference type under a hairline, which is how
     the landing page states a fact it does not want you to stop on. */
  if (phase === PHASE.predict) {
    const totalMinutes = timed
      ? Math.round(questions.reduce((s, q) => s + (q.time_budget_seconds || 90), 0) / 60)
      : null
    const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0)
    const eyebrow = paperDefinition
      ? `${paperDefinition.name} · ${subject}`
      : mode === 'mock'
        ? 'Timed mock'
        : mode === 'mistakes'
          ? 'Mistake review'
          : mode === 'custom'
            ? 'Custom test'
            : mode === 'topic'
              ? 'Topic test'
              : 'Mini-quiz'

    const facts = [
      ['Questions', String(questions.length)],
      ['Marks', String(totalMarks)],
      timed ? ['Time limit', `${totalMinutes} min`] : ['Timing', 'Untimed'],
    ]

    return (
      <div>
        <p
          className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-faint)' }}
        >
          {eyebrow}
        </p>
        <h1 className="text-[clamp(1.7rem,3.4vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
          {paperDefinition
            ? paperDefinition.blurb
            : mode === 'mistakes'
              ? 'Your past mistakes'
              : mode === 'topic'
                ? topic
                : subtopic || subject}
        </h1>

        <dl
          className="mt-8 flex flex-wrap gap-x-12 gap-y-5 border-t pt-6"
          style={{ borderColor: 'var(--border)' }}
        >
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {label}
              </dt>
              <dd className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.025em] tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {paperDefinition && paperDefinition.minutes && (
          <p className="mt-5 text-[13px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            The real {paperDefinition.name} runs {paperDefinition.minutes} minutes. This one is
            timed from the questions it actually contains.
          </p>
        )}

        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          <label
            htmlFor="predicted-score"
            className="block text-[14.5px] font-medium"
          >
            How many will you get right?
          </label>
          <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Optional. It is how the app learns whether your confidence matches your marks.
          </p>
          <input
            id="predicted-score"
            type="number"
            min={0}
            max={questions.length}
            value={predictedScore}
            onChange={(e) => {
              // Number inputs accept 'e', '+', '-' and any magnitude, so the
              // value is sanitised rather than trusted.
              const digits = e.target.value.replace(/[^0-9]/g, '')
              if (digits === '') return setPredictedScore('')
              const clamped = Math.min(questions.length, parseInt(digits, 10))
              setPredictedScore(String(clamped))
            }}
            onKeyDown={(e) => {
              if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault()
            }}
            inputMode="numeric"
            placeholder={`0–${questions.length}`}
            className="input mt-4 max-w-[160px] tabular-nums"
          />
        </div>

        <div className="mt-10">
          <button onClick={startQuiz} className="btn btn-solid control-lg">
            {timed ? 'Start timed mock' : 'Start quiz'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === PHASE.quiz) {
    const q = questions[currentIndex]
    const options = q.options || []
    const selected = answers[q.id]
    // An empty box is not an answer. != null alone was true for '', so a
    // short-answer paper counted itself finished before anything was typed.
    const isAnswered = (question) =>
      answers[question.id] != null && String(answers[question.id]).trim() !== ''
    const answeredCount = questions.filter(isAnswered).length

    let paceBlock = null
    if (timed && secondsLeft != null) {
      const totalMarks = questions.reduce((s, x) => s + (x.marks || 1), 0)
      const requiredPace = totalMarks / (timeLimitRef.current / 60)
      const elapsedSec = timeLimitRef.current - secondsLeft
      const marksAnswered = questions
        .filter((x) => answers[x.id] != null)
        .reduce((s, x) => s + (x.marks || 1), 0)
      const actualPace = elapsedSec >= 30 ? marksAnswered / (elapsedSec / 60) : null
      const behind = actualPace != null && actualPace < requiredPace
      paceBlock = (
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <span
            className="text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
            style={{ color: secondsLeft < 60 ? 'var(--status-weak)' : 'var(--text)' }}
          >
            {formatClock(secondsLeft)}
          </span>
          <span
            className="text-[12.5px] tabular-nums"
            style={{ color: behind ? 'var(--status-fading)' : 'var(--text-muted)' }}
          >
            {actualPace != null
              ? `${actualPace.toFixed(1)} marks/min · ${requiredPace.toFixed(1)} needed`
              : `${requiredPace.toFixed(1)} marks/min needed`}
            {behind ? ' · behind' : ''}
          </span>
        </div>
      )
    }

    return (
      <div>
        {/* Where you are, as a rail rather than a sentence. Every question is
            one segment: filled if it has an answer, brand if it is the one on
            screen, and each is a button so you can go back to the one you
            skipped without pressing Back eight times. */}
        <div className="mb-6">
          {paceBlock}
          <div className={`flex gap-1 ${paceBlock ? 'mt-4' : ''}`}>
            {questions.map((question, i) => (
              <button
                key={question.id}
                onClick={() => goTo(i)}
                aria-label={`Question ${i + 1}${isAnswered(question) ? ', answered' : ''}`}
                aria-current={i === currentIndex ? 'true' : undefined}
                className="h-1 flex-1 rounded-full transition-colors duration-150"
                style={{
                  background:
                    i === currentIndex
                      ? 'var(--brand)'
                      : isAnswered(question)
                        ? 'var(--text-faint)'
                        : 'var(--border-strong)',
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-[12.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              Question {currentIndex + 1} of {questions.length} · {answeredCount} answered
            </p>
            <div className="flex items-center gap-4">
              <HeatBadge difficulty={q.difficulty} />
              <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                {q.marks || 1} mark{(q.marks || 1) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <QuestionStimulus text={q.stimulus} kind={q.stimulus_kind} />

        <div className="flex items-start justify-between gap-4">
          <p className="text-[17px] font-medium leading-relaxed">{q.stem}</p>
          <CopyButton text={questionAsText(q)} label="" />
        </div>

        <QuestionFigure figure={q.figure} />

        {q.question_type === 'short_answer' ? (
          <div className="mt-6">
            <label className="t-overline" htmlFor="short-answer">
              Your answer
            </label>
            <input
              id="short-answer"
              key={q.id}
              type="text"
              inputMode={q.answer_kind === 'numeric' ? 'decimal' : 'text'}
              autoComplete="off"
              value={selected ?? ''}
              onChange={(e) => selectAnswer(q.id, e.target.value)}
              placeholder={q.answer_kind === 'numeric' ? 'e.g. 9.81' : 'Type your answer'}
              className="input mt-2"
            />
            <p className="mt-2 text-[13px]" style={{ color: 'var(--text-faint)' }}>
              {q.answer_hint ||
                (q.answer_kind === 'numeric'
                  ? 'Units are optional, and close counts. Write the number.'
                  : 'Spelling is forgiving, but say the right thing.')}
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            {options.map((opt) => {
              const isPicked = selected === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(q.id, opt.id)}
                  className="flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[14.5px] leading-relaxed transition-colors duration-150"
                  style={{
                    borderColor: isPicked ? 'var(--brand)' : 'var(--border-strong)',
                    background: isPicked ? 'var(--brand-tint)' : 'transparent',
                    // Set rather than inherited: an author-less button falls
                    // back to the system `buttontext`, which follows
                    // color-scheme instead of the palette.
                    color: 'var(--text)',
                  }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
                    style={{
                      borderColor: isPicked ? 'var(--brand)' : 'var(--border-strong)',
                      color: isPicked ? 'var(--brand)' : 'var(--text-muted)',
                    }}
                  >
                    {opt.id}
                  </span>
                  <span className="flex-1">{opt.text}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* A hint is offered rather than shown. Reading it before trying is the
            fastest way to feel like you understood something you could not
            have done, so it costs a click and says so on the results. */}
        {q.hint && (
          <div className="mt-5">
            {hintsShown[q.id] ? (
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                <span className="font-semibold">Hint. </span>
                {q.hint}
              </p>
            ) : (
              <button
                onClick={() => setHintsShown((h) => ({ ...h, [q.id]: true }))}
                className="text-[13px] font-medium underline underline-offset-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Show a hint
              </button>
            )}
          </div>
        )}

        <div
          className="mt-10 flex items-center gap-3 border-t pt-6"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="btn btn-quiet control-md disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex-1" />
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={selected == null || String(selected).trim() === ''}
              className="btn btn-solid control-md disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={finishQuiz}
              disabled={(!timed && answeredCount < questions.length) || submitting}
              className="btn btn-solid control-md flex items-center gap-2 disabled:opacity-40"
            >
              {submitting ? <Spinner /> : null}
              {submitting ? 'Submitting' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === PHASE.results && results) {
    const pct = Math.round(results.accuracy * 100)
    const overBudget = results.graded.filter(
      (g) => g.timeSpent > (g.question.time_budget_seconds || 90)
    )

    return (
      <div>
        <p
          className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: 'var(--text-faint)' }}
        >
          Result
        </p>
        <h1 className="text-[clamp(2.4rem,6vw,3.4rem)] font-semibold leading-[1] tracking-[-0.035em] tabular-nums">
          {results.score}
          <span style={{ color: 'var(--text-faint)' }}>/{results.total}</span>
        </h1>
        <p className="mt-3 text-[14.5px]" style={{ color: 'var(--text-muted)' }}>
          {pct}% accuracy
          {results.prediction != null && (
            <>
              {' · '}
              you predicted {results.prediction},{' '}
              {results.prediction > results.score
                ? 'slightly overconfident this time'
                : results.prediction < results.score
                  ? 'you underestimated yourself'
                  : 'perfectly calibrated'}
            </>
          )}
        </p>

        {results.clearedFromBank > 0 && (
          <p
            className="mt-6 border-l-2 pl-4 text-[14px] leading-relaxed"
            style={{ borderColor: 'var(--status-proficient)', color: 'var(--text-body)' }}
          >
            {results.clearedFromBank} question{results.clearedFromBank === 1 ? '' : 's'} left your
            mistake bank. Three correct reviews and it is considered fixed.
          </p>
        )}

        {/* Where each subtopic now stands, and how much further it has to go.
            Without this the level looks arbitrary: a perfect score that leaves
            you on Weak needs explaining, and the explanation is the point. */}
        {results.earned?.length > 0 && (
          <section className="mt-10">
            <div
              className="mb-5 flex items-baseline justify-between gap-4 border-b pb-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2 className="text-[15px] font-semibold tracking-[-0.012em]">Mastery</h2>
              <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                {MASTERY_TARGET} points to Mastered
              </span>
            </div>
            <ul className="flex flex-col gap-5">
              {results.earned.map((e) => {
                const next = pointsToNextLevel(e.points)
                return (
                  <li key={e.subtopic}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[14.5px]">{e.subtopic}</span>
                      <span
                        className={`shrink-0 text-[12.5px] font-semibold ${STATUS_TEXT_COLORS[e.status]}`}
                      >
                        {STATUS_LABELS[e.status]}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1 w-full overflow-hidden rounded-full"
                      style={{ background: 'var(--border-strong)' }}
                    >
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[e.status]}`}
                        style={{ width: `${masteryFraction(e.points) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                      {e.points} of {MASTERY_TARGET} points
                      {next ? ` · ${next.points} more for ${STATUS_LABELS[next.status]}` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
            <p className="mt-6 text-[13px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
              A question is worth points by heat: Low 0.5, Medium 0.75, Hot 1, Extremely hot 1.25,
              Burning 1.5. Only correct answers pay, and each question pays once, so the same easy
              question cannot be farmed.
            </p>
          </section>
        )}

        {timed && (
          <section className="mt-10">
            <div
              className="mb-5 flex items-baseline justify-between gap-4 border-b pb-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2 className="text-[15px] font-semibold tracking-[-0.012em]">Pacing</h2>
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Finished in {formatClock(results.elapsed)} of {formatClock(timeLimitRef.current)} ·{' '}
              {(results.totalMarks / (timeLimitRef.current / 60)).toFixed(1)} marks/min required
            </p>
            <p
              className="mt-2 text-[14px]"
              style={{
                color: overBudget.length
                  ? 'var(--status-fading)'
                  : 'var(--status-proficient)',
              }}
            >
              {overBudget.length > 0
                ? `${overBudget.length} question${overBudget.length !== 1 ? 's' : ''} went over the exam time budget.`
                : 'All questions inside the exam time budget.'}
            </p>
          </section>
        )}

        <section className="mt-10">
          <div
            className="mb-1 flex items-baseline justify-between gap-4 border-b pb-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="text-[15px] font-semibold tracking-[-0.012em]">Every question</h2>
            <CopyButton text={paperAsText(results.graded)} label="Copy all" />
          </div>

          <ul className="flex flex-col">
            {results.graded.map((g) => {
              const budget = g.question.time_budget_seconds || 90
              const slow = g.timeSpent > budget
              const tone = g.correct ? 'var(--status-proficient)' : 'var(--status-weak)'
              return (
                <li
                  key={g.question.id}
                  className="flex items-start gap-4 border-b py-5 last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                    style={{ borderColor: tone, color: tone }}
                    aria-label={g.correct ? 'Correct' : 'Incorrect'}
                  >
                    {g.correct ? (
                      <IconCheck width={11} height={11} />
                    ) : (
                      <IconClose width={11} height={11} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14.5px] leading-relaxed">{g.question.stem}</p>
                      <CopyButton
                        text={questionAsText(g.question, { includeAnswer: true })}
                        label=""
                      />
                    </div>
                    {/* Why the option you chose is wrong beats why the right
                        one is right: the second closes the loop, the first
                        names the mistake you actually made. Both are shown,
                        the specific one first. */}
                    {!g.correct && g.question.option_feedback?.[g.selected] && (
                      <p
                        className="mt-2 text-[13.5px] leading-relaxed"
                        style={{ color: 'var(--status-weak)' }}
                      >
                        <span className="font-semibold">
                          You picked {String(g.selected).toUpperCase()}.
                        </span>{' '}
                        {g.question.option_feedback[g.selected]}
                      </p>
                    )}
                    {!g.correct && g.question.explanation && (
                      <p
                        className="mt-2 text-[13.5px] leading-relaxed"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {g.question.explanation}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <HeatBadge difficulty={g.question.difficulty} showPoints />
                      <span
                        className="text-[12.5px] tabular-nums"
                        style={{
                          color: slow && timed ? 'var(--status-fading)' : 'var(--text-faint)',
                        }}
                      >
                        {g.timeSpent}s of {budget}s{slow && timed ? ' · over budget' : ''}
                      </span>
                    </div>
                    <ReportQuestion questionId={g.question.id} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/dashboard/mistakes" className="btn btn-solid control-md">
            Open Mistake Bank
          </Link>
          <Link href={backHref} className="btn btn-quiet control-md">
            Done
          </Link>
        </div>
      </div>
    )
  }

  return null
}
