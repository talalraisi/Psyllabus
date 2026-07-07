'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  gradeAnswer,
  computeAccuracy,
  buildProgressUpdate,
  pickQuestions,
  SUBTOPIC_QUESTION_COUNT,
} from '@/lib/quiz'
import { statusLabel } from '@/lib/quiz-status'

const PHASE = {
  loading: 'loading',
  empty: 'empty',
  predict: 'predict',
  quiz: 'quiz',
  results: 'results',
}

export default function QuizRunner({ topicId, quizType = 'subtopic', backHref }) {
  const [phase, setPhase] = useState(PHASE.loading)
  const [topic, setTopic] = useState(null)
  const [allQuestions, setAllQuestions] = useState([])
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [predictedScore, setPredictedScore] = useState('')
  const [results, setResults] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data: topicData } = await supabase
        .from('topics')
        .select('id, title, topic_type, subject_id')
        .eq('id', topicId)
        .single()

      if (!topicData) {
        setPhase(PHASE.empty)
        return
      }
      setTopic(topicData)

      const { data: questionRows } = await supabase
        .from('questions')
        .select('*')
        .eq('topic_id', topicId)
        .eq('verified', true)

      if (!questionRows?.length) {
        setPhase(PHASE.empty)
        return
      }

      setAllQuestions(questionRows)
      setPhase(PHASE.predict)
    }
    load()
  }, [topicId, router, supabase])

  const startQuiz = useCallback(() => {
    const picked = pickQuestions(allQuestions, SUBTOPIC_QUESTION_COUNT)
    setQuestions(picked)
    setCurrentIndex(0)
    setAnswers({})
    setPhase(PHASE.quiz)
  }, [allQuestions])

  const selectAnswer = (questionId, optionId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }

  const finishQuiz = async () => {
    if (!userId || submitting) return
    setSubmitting(true)

    const graded = questions.map((q) => {
      const selected = answers[q.id]
      const correct = gradeAnswer(selected, q.correct_answer)
      return { question: q, selected, correct }
    })

    const score = graded.filter((g) => g.correct).length
    const total = questions.length
    const accuracy = computeAccuracy(score, total)
    const prediction = predictedScore !== '' ? parseInt(predictedScore, 10) : null

    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        topic_id: topicId,
        subject_id: topic.subject_id,
        quiz_type: quizType,
        predicted_score: prediction,
        score,
        total_questions: total,
        accuracy,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (attemptError || !attempt) {
      setSubmitting(false)
      return
    }

    const responses = graded.map((g) => ({
      attempt_id: attempt.id,
      question_id: g.question.id,
      selected_answer: g.selected,
      is_correct: g.correct,
    }))
    await supabase.from('question_responses').insert(responses)

    const { data: existing } = await supabase
      .from('user_topic_progress')
      .select('attempt_count')
      .eq('user_id', userId)
      .eq('topic_id', topicId)
      .maybeSingle()

    const attemptCount = (existing?.attempt_count || 0) + 1
    const progressUpdate = buildProgressUpdate({ accuracy, attemptCount })

    await supabase.from('user_topic_progress').upsert({
      user_id: userId,
      topic_id: topicId,
      ...progressUpdate,
    })

    const wrongAnswers = graded.filter((g) => !g.correct)
    if (wrongAnswers.length) {
      const mistakeRows = wrongAnswers.map((g) => ({
        user_id: userId,
        question_id: g.question.id,
        attempt_id: attempt.id,
        next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }))
      await supabase.from('mistakes').upsert(mistakeRows, {
        onConflict: 'user_id,question_id',
        ignoreDuplicates: false,
      })
    }

    setResults({ score, total, accuracy, prediction, graded })
    setPhase(PHASE.results)
    setSubmitting(false)
  }

  if (phase === PHASE.loading) {
    return <p className="text-text-muted text-sm py-12 text-center">Loading quiz…</p>
  }

  if (phase === PHASE.empty) {
    return (
      <div className="card card-pad text-center">
        <p className="text-text font-semibold mb-2">Questions coming soon</p>
        <p className="text-text-muted text-sm mb-6">
          We&apos;re building the question bank for this subtopic. Check back soon.
        </p>
        {backHref && (
          <Link href={backHref} className="btn-primary text-sm px-5 py-2.5">
            Back to syllabus
          </Link>
        )}
      </div>
    )
  }

  if (phase === PHASE.predict) {
    return (
      <div className="card card-pad">
        <p className="section-label mb-2">Mini-quiz</p>
        <h1 className="text-xl font-bold text-text mb-2">{topic?.title}</h1>
        <p className="text-text-muted text-sm mb-6">
          {Math.min(allQuestions.length, SUBTOPIC_QUESTION_COUNT)} questions · auto-graded
        </p>

        <div className="mb-6 p-4 rounded-[var(--radius-sm)] border border-border bg-bg-subtle">
          <label className="block text-sm font-medium text-text mb-2">
            How many do you think you&apos;ll get right? (optional)
          </label>
          <input
            type="number"
            min={0}
            max={SUBTOPIC_QUESTION_COUNT}
            value={predictedScore}
            onChange={(e) => setPredictedScore(e.target.value)}
            placeholder={`0–${SUBTOPIC_QUESTION_COUNT}`}
            className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-border bg-bg-elevated text-sm"
          />
          <p className="text-text-faint text-xs mt-2">
            This helps track your confidence calibration over time.
          </p>
        </div>

        <button onClick={startQuiz} className="btn-primary w-full py-3">
          Start quiz
        </button>
      </div>
    )
  }

  if (phase === PHASE.quiz) {
    const q = questions[currentIndex]
    const options = q.options || []
    const selected = answers[q.id]
    const allAnswered = questions.every((question) => answers[question.id] != null)

    return (
      <div className="card card-pad">
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-muted text-sm">
            Question {currentIndex + 1} of {questions.length}
          </p>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: answers[questions[i].id] != null
                    ? 'var(--accent)'
                    : i === currentIndex
                      ? 'var(--border-strong)'
                      : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>

        <p className="text-text font-medium mb-6 leading-relaxed">{q.stem}</p>

        <div className="space-y-2 mb-6">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => selectAnswer(q.id, opt.id)}
              className="w-full text-left p-3 rounded-[var(--radius-sm)] border transition-all text-sm"
              style={{
                borderColor: selected === opt.id ? 'var(--accent)' : 'var(--border)',
                background: selected === opt.id ? 'var(--accent-soft)' : 'var(--bg-subtle)',
              }}
            >
              {opt.text}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="btn-ghost flex-1 py-2.5 disabled:opacity-40"
          >
            Back
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={goNext}
              disabled={selected == null}
              className="btn-primary flex-1 py-2.5 disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              onClick={finishQuiz}
              disabled={!allAnswered || submitting}
              className="btn-primary flex-1 py-2.5 disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === PHASE.results && results) {
    const pct = Math.round(results.accuracy * 100)
    const status = statusLabel(
      results.accuracy < 0.5 ? 'weak' : results.accuracy < 0.75 ? 'shaky' : 'solid'
    )

    return (
      <div className="card card-pad">
        <p className="section-label mb-2">Quiz complete</p>
        <h1 className="text-3xl font-extrabold text-text mb-1">
          {results.score}/{results.total}
        </h1>
        <p className="text-text-muted text-sm mb-1">{pct}% accuracy · {status}</p>
        {results.prediction != null && (
          <p className="text-text-faint text-xs mb-6">
            You predicted {results.prediction} — actual: {results.score}
          </p>
        )}

        <div className="space-y-3 mb-6">
          {results.graded.map((g, i) => (
            <div
              key={g.question.id}
              className="p-3 rounded-[var(--radius-sm)] border border-border bg-bg-subtle"
            >
              <div className="flex items-start gap-2 mb-1">
                <span
                  className="text-xs font-bold mt-0.5"
                  style={{ color: g.correct ? 'var(--solid)' : 'var(--weak)' }}
                >
                  {g.correct ? '✓' : '✗'}
                </span>
                <p className="text-sm text-text">{g.question.stem}</p>
              </div>
              {!g.correct && g.question.explanation && (
                <p className="text-xs text-text-muted ml-5">{g.question.explanation}</p>
              )}
            </div>
          ))}
        </div>

        {backHref && (
          <Link href={backHref} className="btn-primary w-full py-3 text-center block">
            Back to syllabus
          </Link>
        )}
      </div>
    )
  }

  return null
}
