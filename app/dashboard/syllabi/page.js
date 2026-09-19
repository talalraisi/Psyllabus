'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { accessibleSubjects } from '@/lib/access'

/**
 * Syllabi.
 *
 * The part of the app that reads what a student has written and says what is
 * missing. It is careful about one thing above all: it comments, it does not
 * compose. An IA with sentences it produced would be the student's work in
 * name only, and the IB calls that misconduct — so the rule is in the system
 * prompt, stated on this page, and true.
 *
 * Three things it does: read a draft against the criteria, offer research
 * questions to choose between, and say how to study a subject given what the
 * quizzes already show. Everything else people want from a chatbot is
 * deliberately absent.
 */

const TABS = [
  {
    key: 'draft_feedback',
    label: 'Feedback on a draft',
    blurb: 'Paste an IA, EE or TOK draft. You get what an examiner would say, not new sentences.',
    placeholder: 'Paste your draft here.',
    cta: 'Read my draft',
  },
  {
    key: 'research_questions',
    label: 'Research questions',
    blurb: 'Six directions for an IA or EE, with what each one would actually take.',
    placeholder: 'What are you interested in? A topic, a case, a text, an experiment.',
    cta: 'Suggest questions',
  },
  {
    key: 'study_advice',
    label: 'How to study this',
    blurb: 'What to do this week in one subject, based on what your quizzes show.',
    placeholder: 'Anything else worth knowing — a test date, what you find hard.',
    cta: 'Tell me where to start',
  },
]

const KINDS = [
  { key: 'ia', label: 'Internal assessment' },
  { key: 'ee', label: 'Extended essay' },
  { key: 'tok', label: 'TOK essay' },
]

export default function SyllabiPage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(TABS[0])
  const [kind, setKind] = useState('ia')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(null)
  const [busy, setBusy] = useState(false)
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
      const profileData = await getProfile(supabase, user.id)
      if (cancelled) return
      setProfile(profileData)
      setSubject(accessibleSubjects(profileData)[0] || '')
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const ask = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setAnswer('')

    try {
      const res = await fetch('/api/syllabi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: tab.key, text, subject, kind }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'That did not work.')
      else {
        setAnswer(data.answer)
        setRemaining(data.remaining)
      }
    } catch {
      setError('Could not reach Syllabi. Check your connection.')
    }
    setBusy(false)
  }

  if (loading) return <PageLoading title="Syllabi" width="default" rows={3} />

  const subjects = accessibleSubjects(profile)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Syllabi"
          subtitle="Reads your work and says what is missing. It will not write it for you."
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t)
                setAnswer('')
                setError('')
              }}
              className={tab.key === t.key ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mb-5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
          {tab.blurb}
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {tab.key !== 'study_advice' && (
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="What you are writing"
              className="input control-sm"
              style={{ width: 200 }}
            >
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          )}
          {subjects.length > 0 && kind !== 'tok' && (
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-label="Subject"
              className="input control-sm"
              style={{ width: 240 }}
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={tab.key === 'draft_feedback' ? 14 : 5}
          placeholder={tab.placeholder}
          className="input w-full resize-y text-[14px]"
          style={{ height: 'auto', padding: '12px 14px' }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={ask}
            disabled={busy || (tab.key === 'draft_feedback' && words < 50)}
            className="btn btn-solid control-md disabled:opacity-40"
          >
            {busy ? 'Reading…' : tab.cta}
          </button>
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {words > 0 && `${words} word${words === 1 ? '' : 's'}`}
            {tab.key === 'draft_feedback' && words > 0 && words < 50 && ' · paste a bit more'}
            {remaining != null && ` · ${remaining} left today`}
          </span>
        </div>

        {error && (
          <p
            className="mt-5 border-l-2 pl-4 text-[13.5px] leading-relaxed"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            {error}
          </p>
        )}

        {answer && (
          <section
            className="pop-enter mt-8 rounded-[14px] border p-5"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <p className="t-overline mb-3">Syllabi</p>
            {/* Plain text, deliberately: rendering markdown would invite
                answers written to be pasted somewhere. */}
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {answer}
            </div>
          </section>
        )}

        <p className="mt-10 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          Syllabi comments on your work; it never writes it. Anything it produced and you handed in
          would be your work in name only, and the IB treats that as misconduct. Feedback is not a
          mark, and it is not your teacher.
        </p>
      </Page>
    </DashboardLayout>
  )
}
