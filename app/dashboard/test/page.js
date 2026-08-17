'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { sortTopics } from '@/lib/progress'

const LENGTHS = [10, 20, 30, 45]

export default function TestBuilderPage() {
  const [profile, setProfile] = useState(null)
  const [subject, setSubject] = useState('')
  const [topics, setTopics] = useState([])
  const [available, setAvailable] = useState({})
  const [selected, setSelected] = useState([])
  const [length, setLength] = useState(20)
  const [timed, setTimed] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingTopics, setLoadingTopics] = useState(false)
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
        .single()
      if (!profileData) {
        router.push('/onboarding')
        return
      }
      setProfile(profileData)
      setSubject(profileData.subjects?.[0] || '')
      setLoading(false)
    }
    load()
  }, [router, supabase])

  useEffect(() => {
    if (!subject) return
    async function loadTopics() {
      setLoadingTopics(true)
      const [{ data: syllabus }, { data: questions }] = await Promise.all([
        supabase.from('syllabus_content').select('topic').eq('subject', subject),
        supabase
          .from('questions')
          .select('topic')
          .eq('subject', subject)
          .eq('verified', true),
      ])

      const counts = {}
      for (const q of questions || []) {
        counts[q.topic] = (counts[q.topic] || 0) + 1
      }
      const unique = [...new Set((syllabus || []).map((r) => r.topic))]
      const ordered = sortTopics(unique.map((t) => [t, null])).map(([t]) => t)

      setTopics(ordered)
      setAvailable(counts)
      setSelected(ordered.filter((t) => counts[t] > 0))
      setLoadingTopics(false)
    }
    loadTopics()
  }, [subject, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading…</p>
      </div>
    )
  }

  const subjects = profile.subjects || []
  const totalAvailable = selected.reduce((sum, t) => sum + (available[t] || 0), 0)
  const canStart = selected.length > 0 && totalAvailable > 0
  const actualLength = Math.min(length, totalAvailable)

  const toggleTopic = (topic) => {
    setSelected((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    )
  }

  const startTest = () => {
    const params = new URLSearchParams({
      subject,
      mode: 'custom',
      count: String(actualLength),
      topics: selected.join('~~'),
      back: '/dashboard/test',
    })
    if (timed) params.set('timed', '1')
    router.push(`/dashboard/quiz?${params.toString()}`)
  }

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold text-[#1a2e1e] mb-1">Build a Test</h1>
          <p className="text-sm text-[#6b7280]">
            Mix any topics into an exam-style paper. Choose the length and whether to run it
            under timed conditions.
          </p>
        </header>

        <div className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-4">
          <label className="block text-sm font-medium text-[#1a2e1e] mb-2">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white text-sm outline-none focus:border-[#2D6A4F]"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-[#1a2e1e]">Topics</label>
            <button
              onClick={() =>
                setSelected(
                  selected.length === topics.filter((t) => available[t] > 0).length
                    ? []
                    : topics.filter((t) => available[t] > 0)
                )
              }
              className="text-xs font-medium text-[#2D6A4F] hover:underline"
            >
              {selected.length > 0 ? 'Clear all' : 'Select all'}
            </button>
          </div>

          {loadingTopics ? (
            <div className="space-y-2 animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 bg-[#f3f4f6] rounded-lg" />
              ))}
            </div>
          ) : topics.length === 0 ? (
            <p className="text-sm text-[#6b7280]">
              No syllabus loaded for this subject yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {topics.map((topic) => {
                const n = available[topic] || 0
                const isSelected = selected.includes(topic)
                return (
                  <button
                    key={topic}
                    onClick={() => n > 0 && toggleTopic(topic)}
                    disabled={n === 0}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                      n === 0
                        ? 'border-[#f0f0f0] bg-[#f9fafb] cursor-not-allowed'
                        : isSelected
                          ? 'border-[#2D6A4F] bg-[#f0fdf4]'
                          : 'border-[#e5e7eb] bg-white hover:border-[#d1d5db]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] text-white ${
                        isSelected ? 'bg-[#2D6A4F] border-[#2D6A4F]' : 'border-[#d1d5db]'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                    <span
                      className={`flex-1 text-sm truncate ${n === 0 ? 'text-[#9ca3af]' : 'text-[#374151]'}`}
                    >
                      {topic}
                    </span>
                    <span className="text-xs text-[#9ca3af] shrink-0">
                      {n > 0 ? `${n} questions` : 'none yet'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-4">
          <label className="block text-sm font-medium text-[#1a2e1e] mb-3">Length</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {LENGTHS.map((n) => (
              <button
                key={n}
                onClick={() => setLength(n)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  length === n
                    ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                    : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#d1d5db]'
                }`}
              >
                {n} questions
              </button>
            ))}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <button
              onClick={() => setTimed(!timed)}
              role="switch"
              aria-checked={timed}
              className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${
                timed ? 'bg-[#2D6A4F]' : 'bg-[#e5e7eb]'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  timed ? 'left-5' : 'left-1'
                }`}
              />
            </button>
            <span className="text-sm text-[#374151]">
              Exam conditions (timed, with live pacing clock)
            </span>
          </label>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {canStart ? (
            <>
              <p className="text-sm text-[#6b7280] mb-4">
                {actualLength} question{actualLength !== 1 ? 's' : ''} from {selected.length} topic
                {selected.length !== 1 ? 's' : ''}
                {actualLength < length
                  ? ` (only ${totalAvailable} available so far)`
                  : ''}
                {timed ? ' · timed' : ' · untimed'}
              </p>
              <button
                onClick={startTest}
                className="w-full py-2.5 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors"
              >
                Start test
              </button>
            </>
          ) : (
            <p className="text-sm text-[#6b7280]">
              {selected.length === 0
                ? 'Select at least one topic to build a test.'
                : 'No questions available for the selected topics yet.'}
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
