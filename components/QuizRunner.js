'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

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

function statusFromAccuracy(accuracy) {
  if (accuracy >= 0.75) return 'mastered'
  if (accuracy >= 0.5) return 'confident'
  return 'in_progress'
}

function Skeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] animate-pulse space-y-4">
      <div className="h-4 w-24 bg-[#f3f4f6] rounded" />
      <div className="h-6 w-2/3 bg-[#f3f4f6] rounded" />
      <div className="h-10 w-full bg-[#f3f4f6] rounded-lg" />
      <div className="h-10 w-full bg-[#f3f4f6] rounded-lg" />
      <div className="h-10 w-full bg-[#f3f4f6] rounded-lg" />
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

      const target =
        count || (mode === 'mock' ? MOCK_COUNT : mode === 'topic' ? 15 : SUBTOPIC_COUNT)

      // Serve unseen questions first so repeats only happen once this pool is
      // exhausted. Falls back to seen ones (oldest-seen first) to fill the paper.
      const { data: seenRows } = await supabase
        .from('question_responses')
        .select('question_id, created_at')
        .in(
          'question_id',
          questionRows.slice(0, 1000).map((q) => q.id)
        )
        .order('created_at', { ascending: false })

      const lastSeenAt = new Map()
      for (const r of seenRows || []) {
        if (!lastSeenAt.has(r.question_id)) lastSeenAt.set(r.question_id, r.created_at)
      }

      const unseen = shuffle(questionRows.filter((q) => !lastSeenAt.has(q.id)))
      const seen = questionRows
        .filter((q) => lastSeenAt.has(q.id))
        .sort((a, b) => new Date(lastSeenAt.get(a.id)) - new Date(lastSeenAt.get(b.id)))

      setQuestions([...unseen, ...seen].slice(0, target))
      setPhase(PHASE.predict)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, topic, subtopic, mode, count, topics?.join('|')])

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

  // Countdown for timed mocks — auto-submits at zero.
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

    if (mode === 'subtopic' && subject && subtopic) {
      await supabase.from('progress').upsert(
        {
          user_id: userId,
          subject,
          topic: topic || questions[0]?.topic || '',
          subtopic,
          status: statusFromAccuracy(accuracy),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,subject,subtopic' }
      )
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
      <div className="bg-white rounded-xl p-10 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-center">
        <h2 className="text-base font-semibold text-[#1a2e1e]">
          {mode === 'mistakes' ? 'Nothing to review' : 'Questions coming soon'}
        </h2>
        <p className="text-sm text-[#6b7280] mt-2">{emptyMessage}</p>
        <Link
          href={backHref}
          className="inline-block mt-6 px-5 py-2 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors"
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
      <div className="bg-white rounded-xl p-6 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-2">
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
        <h1 className="text-xl font-bold text-[#1a2e1e] mb-1">
          {mode === 'mistakes'
            ? 'Your past mistakes'
            : mode === 'topic'
              ? topic
              : subtopic || subject}
        </h1>
        <p className="text-sm text-[#6b7280] mb-6">
          {questions.length} question{questions.length !== 1 ? 's' : ''} · auto-graded
          {timed ? ` · ${totalMinutes} min limit` : ''}
        </p>

        <div className="mb-6 p-4 rounded-lg border border-[#f0f0f0] bg-[#f9fafb]">
          <label className="block text-sm font-medium text-[#1a2e1e] mb-2">
            How many will you get right? (optional)
          </label>
          <input
            type="number"
            min={0}
            max={questions.length}
            value={predictedScore}
            onChange={(e) => setPredictedScore(e.target.value)}
            placeholder={`0–${questions.length}`}
            className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white text-sm outline-none focus:border-[#2D6A4F]"
          />
          <p className="text-xs text-[#9ca3af] mt-2">
            Tracks your confidence calibration over time.
          </p>
        </div>

        <button
          onClick={startQuiz}
          className="w-full py-2.5 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors"
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
        <div className="flex items-center justify-between mb-4 px-4 py-2 rounded-lg bg-[#f9fafb] border border-[#f0f0f0] text-sm">
          <span className={`font-semibold tabular-nums ${secondsLeft < 60 ? 'text-[#dc2626]' : 'text-[#1a2e1e]'}`}>
            {formatClock(secondsLeft)} left
          </span>
          <span className={behind ? 'text-[#d97706] font-medium' : 'text-[#6b7280]'}>
            {actualPace != null
              ? `Pace ${actualPace.toFixed(1)} marks/min · target ${requiredPace.toFixed(1)}`
              : `Target pace ${requiredPace.toFixed(1)} marks/min`}
            {behind ? ' · behind' : ''}
          </span>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-xl p-6 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {paceBlock}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#6b7280]">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <p className="text-xs text-[#9ca3af]">
            {q.marks || 1} mark{(q.marks || 1) !== 1 ? 's' : ''} · {answeredCount}/{questions.length} answered
          </p>
        </div>

        <p className="text-sm text-[#1a2e1e] font-medium mb-6 leading-relaxed">{q.stem}</p>

        <div className="space-y-2 mb-6">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => selectAnswer(q.id, opt.id)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors duration-150 ${
                selected === opt.id
                  ? 'border-[#2D6A4F] bg-[#f0fdf4] text-[#1a2e1e]'
                  : 'border-[#e5e7eb] bg-white text-[#374151] hover:border-[#d1d5db]'
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
            className="flex-1 py-2.5 rounded-lg border border-[#e5e7eb] text-sm font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-40"
          >
            Back
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={selected == null}
              className="flex-1 py-2.5 rounded-lg bg-[#2D6A4F] text-white text-sm font-medium hover:bg-[#245a42] transition-colors disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={finishQuiz}
              disabled={(!timed && answeredCount < questions.length) || submitting}
              className="flex-1 py-2.5 rounded-lg bg-[#2D6A4F] text-white text-sm font-medium hover:bg-[#245a42] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
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
      <div className="bg-white rounded-xl p-6 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af] mb-2">
          Quiz Complete
        </p>
        <h1 className="text-[32px] font-bold text-[#2D6A4F] leading-tight">
          {results.score}/{results.total}
        </h1>
        <p className="text-sm text-[#6b7280] mt-1">{pct}% accuracy</p>
        {results.prediction != null && (
          <p className="text-xs text-[#9ca3af] mt-1">
            You predicted {results.prediction}: {results.prediction > results.score
              ? 'slightly overconfident this time'
              : results.prediction < results.score
                ? 'you underestimated yourself'
                : 'perfectly calibrated'}
          </p>
        )}

        {timed && (
          <div className="mt-5 p-4 rounded-lg border border-[#f0f0f0] bg-[#f9fafb]">
            <p className="text-sm font-semibold text-[#1a2e1e] mb-1">Pacing</p>
            <p className="text-sm text-[#6b7280]">
              Finished in {formatClock(results.elapsed)} of {formatClock(timeLimitRef.current)} ·{' '}
              {(results.totalMarks / (timeLimitRef.current / 60)).toFixed(1)} marks/min required
            </p>
            {overBudget.length > 0 ? (
              <p className="text-sm text-[#d97706] mt-1">
                Pacing penalty: {overBudget.length} question{overBudget.length !== 1 ? 's' : ''} went
                over the exam time budget.
              </p>
            ) : (
              <p className="text-sm text-[#16a34a] mt-1">
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
                className="p-4 rounded-lg border border-[#f0f0f0] bg-[#f9fafb]"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`text-xs font-bold mt-0.5 ${g.correct ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}
                    aria-label={g.correct ? 'Correct' : 'Incorrect'}
                  >
                    {g.correct ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#1a2e1e]">{g.question.stem}</p>
                    {!g.correct && g.question.explanation && (
                      <p className="text-xs text-[#6b7280] mt-1">{g.question.explanation}</p>
                    )}
                    <p className={`text-xs mt-1 ${slow && timed ? 'text-[#d97706]' : 'text-[#9ca3af]'}`}>
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
            className="flex-1 text-center py-2.5 rounded-lg border border-[#e5e7eb] text-sm font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            Done
          </Link>
          <Link
            href="/dashboard/mistakes"
            className="flex-1 text-center py-2.5 rounded-lg bg-[#2D6A4F] text-white text-sm font-medium hover:bg-[#245a42] transition-colors"
          >
            Open Mistake Bank
          </Link>
        </div>
      </div>
    )
  }

  return null
}
