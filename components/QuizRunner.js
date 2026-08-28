'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { statusFromAccuracy } from '@/lib/progress'
import { getCurrentUser } from '@/lib/auth'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { progressKey } from '@/lib/progress'

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
const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60]
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

function Skeleton() {
  return (
    <div className="surface p-6 animate-pulse space-y-4">
      <div className="h-4 w-24 bg-[var(--surface-sunken)] rounded" />
      <div className="h-6 w-2/3 bg-[var(--surface-sunken)] rounded" />
      <div className="h-10 w-full bg-[var(--surface-sunken)] rounded-lg" />
      <div className="h-10 w-full bg-[var(--surface-sunken)] rounded-lg" />
      <div className="h-10 w-full bg-[var(--surface-sunken)] rounded-lg" />
    </div>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin align-middle"
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
  const router = useRouter()
  const supabase = createClient()

  const timed = mode === 'mock' || timedProp
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

      // Difficulty bands mirror the ranges offered in the test builder.
      const BANDS = { easy: [0, 0.4], medium: [0.35, 0.7], hard: [0.6, 1] }
      if (difficulty && BANDS[difficulty]) {
        const [lo, hi] = BANDS[difficulty]
        const banded = candidates.filter((q) => {
          const d = typeof q.difficulty === 'number' ? q.difficulty : 0.5
          return d >= lo && d <= hi
        })
        if (banded.length) candidates = banded
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
        count || (mode === 'mock' ? MOCK_COUNT : mode === 'topic' ? 15 : SUBTOPIC_COUNT)

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
  }, [subject, topic, subtopic, mode, count, topics?.join('|'), focus, difficulty])

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
      const correct = selected != null && String(selected) === String(q.correct_answer)
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
        quiz_type: mode === 'custom' ? (timed ? 'mock' : 'topic') : mode,
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

    // Update progress for every subtopic this paper touched, not just single
    // subtopic quizzes. A topic test, mock, or custom paper covers several
    // subtopics, and each is scored on its own questions.
    if (mode !== 'mistakes') {
      const bySubtopic = new Map()
      for (const g of graded) {
        const key = `${g.question.subject}|||${g.question.subtopic}`
        const entry = bySubtopic.get(key) || {
          subject: g.question.subject,
          topic: g.question.topic,
          subtopic: g.question.subtopic,
          correct: 0,
          total: 0,
        }
        entry.total++
        if (g.correct) entry.correct++
        bySubtopic.set(key, entry)
      }

      const rows = [...bySubtopic.values()]
        // One or two questions is too thin to reclassify a subtopic.
        .filter((e) => e.total >= 3)
        .map((e) => ({
          user_id: userId,
          subject: e.subject,
          topic: e.topic || '',
          subtopic: e.subtopic,
          status: statusFromAccuracy(e.correct / e.total),
          updated_at: new Date().toISOString(),
        }))

      if (rows.length) {
        await supabase.from('progress').upsert(rows, {
          onConflict: 'user_id,subject,subtopic',
        })
      }
    }

    if (mode === 'mistakes') {
      await Promise.all(
        graded.map((g) => {
          const row = mistakeRowsById[g.question.id]
          if (!row) return null
          const reviewCount = g.correct ? (row.review_count || 0) + 1 : 0
          const intervalDays =
            REVIEW_INTERVALS[Math.min(reviewCount, REVIEW_INTERVALS.length - 1)]
          return supabase
            .from('mistakes')
            .update({
              review_count: reviewCount,
              next_review_at: new Date(Date.now() + intervalDays * DAY_MS).toISOString(),
            })
            .eq('id', row.id)
        })
      )
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

    setResults({ score, total, accuracy, prediction, graded, totalMarks, elapsed })
    setPhase(PHASE.results)
    setSubmitting(false)
  }, [userId, submitting, questions, currentIndex, secondsLeft, predictedScore, mode, subject, topic, subtopic, timed, mistakeRowsById, commitTime, supabase])

  finishRef.current = finishQuiz

  if (phase === PHASE.loading) return <Skeleton />

  if (phase === PHASE.empty) {
    return (
      <div className="surface p-10 text-center">
        <h2 className="text-base font-semibold text-[var(--text)]">
          {mode === 'mistakes' ? 'Nothing to review' : 'Questions coming soon'}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-2">{emptyMessage}</p>
        <Link
          href={backHref}
          className="btn btn-solid control-md mt-6"
        >
          Go back
        </Link>
      </div>
    )
  }

  if (phase === PHASE.predict) {
    const totalMinutes = timed
      ? Math.round(questions.reduce((s, q) => s + (q.time_budget_seconds || 90), 0) / 60)
      : null
    return (
      <div className="surface p-6">
        <p className="t-overline mb-2">
          {mode === 'mock'
            ? 'Timed Mock'
            : mode === 'mistakes'
              ? 'Mistake Review'
              : mode === 'custom'
                ? 'Custom Test'
                : mode === 'topic'
                  ? 'Topic Test'
                  : 'Mini-Quiz'}
        </p>
        <h1 className="text-xl font-bold text-[var(--text)] mb-1">
          {mode === 'mistakes'
            ? 'Your past mistakes'
            : mode === 'topic'
              ? topic
              : subtopic || subject}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {questions.length} question{questions.length !== 1 ? 's' : ''} · auto-graded
          {timed ? ` · ${totalMinutes} min limit` : ''}
        </p>

        <div className="mb-6 p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]">
          <label className="block text-sm font-medium text-[var(--text)] mb-2">
            How many will you get right? (optional)
          </label>
          <input
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
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-strong)] bg-white text-sm outline-none focus:border-[var(--brand)]"
          />
          <p className="text-xs text-[var(--text-faint)] mt-2">
            Tracks your confidence calibration over time.
          </p>
        </div>

        <button
          onClick={startQuiz}
          className="w-full btn btn-solid control-md"
        >
          {timed ? 'Start timed mock' : 'Start quiz'}
        </button>
      </div>
    )
  }

  if (phase === PHASE.quiz) {
    const q = questions[currentIndex]
    const options = q.options || []
    const selected = answers[q.id]
    const answeredCount = questions.filter((question) => answers[question.id] != null).length

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
        <div className="flex items-center justify-between mb-4 px-4 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border)] text-sm">
          <span className={`font-semibold tabular-nums ${secondsLeft < 60 ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
            {formatClock(secondsLeft)} left
          </span>
          <span className={behind ? 'text-[var(--warning-text)] font-medium' : 'text-[var(--text-muted)]'}>
            {actualPace != null
              ? `Pace ${actualPace.toFixed(1)} marks/min · target ${requiredPace.toFixed(1)}`
              : `Target pace ${requiredPace.toFixed(1)} marks/min`}
            {behind ? ' · behind' : ''}
          </span>
        </div>
      )
    }

    return (
      <div className="surface p-6">
        {paceBlock}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[var(--text-muted)]">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <p className="text-xs text-[var(--text-faint)]">
            {q.marks || 1} mark{(q.marks || 1) !== 1 ? 's' : ''} · {answeredCount}/{questions.length} answered
          </p>
        </div>

        <p className="text-sm text-[var(--text)] font-medium mb-6 leading-relaxed">{q.stem}</p>

        <div className="space-y-2 mb-6">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => selectAnswer(q.id, opt.id)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors duration-150 ${
                selected === opt.id
                  ? 'border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--text)]'
                  : 'border-[var(--border-strong)] bg-white text-[var(--text-body)] hover:border-[var(--border-hover)]'
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex-1 btn btn-quiet control-md disabled:opacity-40"
          >
            Back
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={selected == null}
              className="flex-1 btn btn-solid control-md disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={finishQuiz}
              disabled={(!timed && answeredCount < questions.length) || submitting}
              className="flex-1 btn btn-solid control-md disabled:opacity-40 flex items-center justify-center gap-2"
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
      <div className="surface p-6">
        <p className="t-overline mb-2">
          Quiz Complete
        </p>
        <h1 className="text-[32px] font-bold text-[var(--brand)] leading-tight">
          {results.score}/{results.total}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{pct}% accuracy</p>
        {results.prediction != null && (
          <p className="text-xs text-[var(--text-faint)] mt-1">
            You predicted {results.prediction}: {results.prediction > results.score
              ? 'slightly overconfident this time'
              : results.prediction < results.score
                ? 'you underestimated yourself'
                : 'perfectly calibrated'}
          </p>
        )}

        {timed && (
          <div className="mt-5 p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]">
            <p className="text-sm font-semibold text-[var(--text)] mb-1">Pacing</p>
            <p className="text-sm text-[var(--text-muted)]">
              Finished in {formatClock(results.elapsed)} of {formatClock(timeLimitRef.current)} ·{' '}
              {(results.totalMarks / (timeLimitRef.current / 60)).toFixed(1)} marks/min required
            </p>
            {overBudget.length > 0 ? (
              <p className="text-sm text-[var(--warning-text)] mt-1">
                Pacing penalty: {overBudget.length} question{overBudget.length !== 1 ? 's' : ''} went
                over the exam time budget.
              </p>
            ) : (
              <p className="text-sm text-[var(--success-text)] mt-1">
                All questions inside the exam time budget.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 space-y-2">
          {results.graded.map((g) => {
            const budget = g.question.time_budget_seconds || 90
            const slow = g.timeSpent > budget
            return (
              <div
                key={g.question.id}
                className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)]"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`text-xs font-bold mt-1 ${g.correct ? 'text-[var(--success-text)]' : 'text-[var(--danger)]'}`}
                    aria-label={g.correct ? 'Correct' : 'Incorrect'}
                  >
                    {g.correct ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text)]">{g.question.stem}</p>
                    {!g.correct && g.question.explanation && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">{g.question.explanation}</p>
                    )}
                    <p className={`text-xs mt-1 ${slow && timed ? 'text-[var(--warning-text)]' : 'text-[var(--text-faint)]'}`}>
                      {g.timeSpent}s spent · {budget}s budget{slow && timed ? ' · over budget' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex gap-2">
          <Link
            href={backHref}
            className="flex-1 text-center btn btn-quiet control-md"
          >
            Done
          </Link>
          <Link
            href="/dashboard/mistakes"
            className="flex-1 text-center btn btn-solid control-md"
          >
            Open Mistake Bank
          </Link>
        </div>
      </div>
    )
  }

  return null
}
