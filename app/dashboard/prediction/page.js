'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus, invalidateProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, EmptyState, PageLoading, Spinner } from '@/components/PageShell'
import { getSlugForSubject } from '@/lib/subject-map'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { predictDiploma, CONFIDENCE_COPY } from '@/lib/prediction'
import { CORE_GRADES, coreBonusPoints, MAX_TOTAL_POINTS, IB_CORE_SUBJECTS } from '@/lib/ib-points'
import { daysUntilExam } from '@/lib/planner'

const SUBJECT_GRADES = [1, 2, 3, 4, 5, 6, 7]

export default function PredictionPage() {
  const [profile, setProfile] = useState(null)
  const [syllabus, setSyllabus] = useState([])
  const [effective, setEffective] = useState({})
  const [targets, setTargets] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
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

      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })

      if (!profileData) {
        router.push('/onboarding')
        return
      }

      setProfile(profileData)
      setTargets(profileData.target_grades || {})

      const subjects = profileData.subjects || []
      const [syllabusRows, { data: progressRows }] = await Promise.all([
        getSyllabus(supabase, subjects),
        supabase.from('progress').select('*').eq('user_id', user.id),
      ])

      setSyllabus(syllabusRows || [])
      setEffective(buildEffectiveProgressMap(progressRows))
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const prediction = useMemo(() => {
    if (!profile) return null
    return predictDiploma({
      profile: { ...profile, target_grades: targets },
      syllabusRows: syllabus,
      effectiveMap: effective,
    })
  }, [profile, syllabus, effective, targets])

  if (loading || !prediction) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Predicted Grade" width="default" stats rows={4} />
      </DashboardLayout>
    )
  }

  const saveTargets = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ target_grades: targets })
      .eq('id', profile.id)
    if (!error) {
      invalidateProfile(profile.id)
      setProfile((p) => ({ ...p, target_grades: targets }))
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const setTarget = (key, value) => setTargets((t) => ({ ...t, [key]: value }))

  const daysLeft = daysUntilExam(profile)
  const bonus = coreBonusPoints(targets['Theory of Knowledge'], targets['Extended Essay'])
  const hasData = prediction.testedSubjects > 0

  return (
    <DashboardLayout profile={profile}>
      <Page width="default">
        <PageHeader
          title="Predicted Grade"
          subtitle={
            daysLeft !== null
              ? `Based on your quiz results · ${daysLeft} days until your exam session`
              : 'Based on your quiz results'
          }
        />

        {!hasData ? (
          <EmptyState
            title="No prediction yet"
            description="Predictions are calculated from quiz results only, never from self-rating. Take a quiz on any subtopic and a figure will appear here."
            action={
              <Link href="/dashboard/subjects" className="btn btn-solid control-md">
                Open a subject
              </Link>
            }
          />
        ) : (
          <>
            {/* Headline */}
            <div className="surface mb-3 p-6">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="t-overline mb-2">Predicted total</p>
                  <p className="flex items-baseline gap-2">
                    <span className="text-[44px] font-bold leading-none tabular-nums text-[var(--brand)]">
                      {prediction.predictedTotal}
                    </span>
                    <span className="t-small">/ {MAX_TOTAL_POINTS}</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="t-overline mb-2">Your target</p>
                  <p className="flex items-baseline justify-end gap-2">
                    <span className="text-[28px] font-bold leading-none tabular-nums text-[var(--text)]">
                      {prediction.targetTotal}
                    </span>
                    <span className="t-small">/ {MAX_TOTAL_POINTS}</span>
                  </p>
                </div>
              </div>

              {/* Distance to target */}
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="t-small">Progress toward your target</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      prediction.onTrack ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'
                    }`}
                  >
                    {Math.min(100, prediction.percentToTarget)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${
                      prediction.onTrack ? 'bg-[var(--success-text)]' : 'bg-[var(--brand)]'
                    }`}
                    style={{ width: `${Math.min(100, prediction.percentToTarget)}%` }}
                  />
                </div>

                <p className="mt-3 text-sm text-[var(--text-body)]">
                  {prediction.onTrack ? (
                    <>
                      You are <strong className="text-[var(--success-text)]">on track</strong>, and
                      currently {prediction.gap === 0 ? 'exactly at' : `${prediction.gap} point${Math.abs(prediction.gap) === 1 ? '' : 's'} above`}{' '}
                      your target.
                    </>
                  ) : (
                    <>
                      You are{' '}
                      <strong className="text-[var(--warning-text)]">
                        {Math.abs(prediction.gap)} point{Math.abs(prediction.gap) === 1 ? '' : 's'}
                      </strong>{' '}
                      short of your target.
                    </>
                  )}
                </p>

                <p className="t-caption mt-2">
                  {CONFIDENCE_COPY[prediction.confidence]} You have tested{' '}
                  {Math.round(prediction.coverage * 100)}% of your syllabus.
                </p>
              </div>
            </div>

            {/* Per subject */}
            <Section title="By subject">
              <ul className="surface">
                {prediction.subjects.map((s, i) => {
                  const behind = s.gap !== null && s.gap < 0
                  return (
                    <li
                      key={s.subject}
                      className={i > 0 ? 'border-t border-[var(--border)]' : undefined}
                    >
                      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--text)]">
                            {s.subject}
                          </p>
                          <p className="t-caption mt-1">
                            {s.tested} of {s.total} subtopics tested
                            {s.confidence === 'low' && ' · low confidence'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="t-caption">Predicted</p>
                            <p
                              className={`text-lg font-bold tabular-nums ${
                                s.grade === null
                                  ? 'text-[var(--text-faint)]'
                                  : behind
                                    ? 'text-[var(--warning-text)]'
                                    : 'text-[var(--brand)]'
                              }`}
                            >
                              {s.grade ?? '–'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="t-caption">Target</p>
                            <p className="text-lg font-bold tabular-nums text-[var(--text)]">
                              {s.target ?? '–'}
                            </p>
                          </div>
                          <Link
                            href={`/dashboard/syllabus/${getSlugForSubject(s.subject)}`}
                            className="btn btn-outline control-sm text-xs"
                          >
                            {behind ? 'Close the gap' : 'Open'}
                          </Link>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Section>
          </>
        )}

        {/* Targets, editable */}
        <Section title="Your targets">
          <div className="surface p-5">
            {saved && (
              <p className="mb-4 rounded-[var(--r-md)] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[var(--success-text)]">
                Targets updated
              </p>
            )}

            {!editing ? (
              <>
                <p className="t-small mb-4">
                  What you told us you are aiming for. Change them any time and the prediction
                  updates immediately.
                </p>

                <ul className="mb-5 flex flex-col">
                  {(profile.subjects || [])
                    .filter((sub) => !IB_CORE_SUBJECTS.includes(sub))
                    .map((subject, i) => (
                      <li
                        key={subject}
                        className={`flex items-center justify-between gap-4 py-2.5 ${
                          i > 0 ? 'border-t border-[var(--border)]' : ''
                        }`}
                      >
                        <span className="min-w-0 truncate text-sm text-[var(--text-body)]">
                          {subject}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text)]">
                          {targets[subject] || <span className="t-caption">not set</span>}
                        </span>
                      </li>
                    ))}

                  {['Theory of Knowledge', 'Extended Essay'].map((component) => (
                    <li
                      key={component}
                      className="flex items-center justify-between gap-4 border-t border-[var(--border)] py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm text-[var(--text-body)]">
                        {component}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[var(--text)]">
                        {targets[component] || <span className="t-caption">not set</span>}
                      </span>
                    </li>
                  ))}

                  <li className="flex items-center justify-between gap-4 border-t border-[var(--border-strong)] py-3">
                    <span className="text-sm font-medium text-[var(--text)]">
                      Core bonus from TOK and EE
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-[var(--text)]">
                      {bonus === 'F'
                        ? 'Failing condition'
                        : typeof bonus === 'number'
                          ? `+${bonus}`
                          : 'not set'}
                    </span>
                  </li>

                  <li className="flex items-center justify-between gap-4 border-t border-[var(--border-strong)] py-3">
                    <span className="text-sm font-semibold text-[var(--text)]">Target total</span>
                    <span className="shrink-0 text-base font-bold tabular-nums text-[var(--brand)]">
                      {prediction.targetTotal} / {MAX_TOTAL_POINTS}
                    </span>
                  </li>
                </ul>

                <button onClick={() => setEditing(true)} className="btn btn-quiet control-md">
                  Edit targets
                </button>
              </>
            ) : (
              <>
                <div className="mb-5 flex flex-col gap-4">
                  {(profile.subjects || [])
                    .filter((s) => !IB_CORE_SUBJECTS.includes(s))
                    .map((subject) => (
                      <div key={subject}>
                        <p className="t-small mb-2 font-medium text-[var(--text)]">{subject}</p>
                        <div className="flex flex-wrap gap-2">
                          {SUBJECT_GRADES.map((g) => (
                            <button
                              key={g}
                              onClick={() => setTarget(subject, String(g))}
                              aria-pressed={String(targets[subject]) === String(g)}
                              className={`control-sm w-10 rounded-[var(--r-md)] border text-sm font-semibold transition-colors duration-150 ${
                                String(targets[subject]) === String(g)
                                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                  : 'border-[var(--border-strong)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                  {['Theory of Knowledge', 'Extended Essay'].map((component) => (
                    <div key={component}>
                      <p className="t-small mb-2 font-medium text-[var(--text)]">
                        {component} <span className="t-caption">(A to E)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {CORE_GRADES.map((g) => (
                          <button
                            key={g}
                            onClick={() => setTarget(component, g)}
                            aria-pressed={targets[component] === g}
                            className={`control-sm w-10 rounded-[var(--r-md)] border text-sm font-semibold transition-colors duration-150 ${
                              targets[component] === g
                                ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                                : 'border-[var(--border-strong)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
                  <p className="t-small">
                    Core bonus:{' '}
                    <strong className="text-[var(--text)]">
                      {bonus === 'F'
                        ? 'Failing condition. An E in TOK or EE fails the Diploma.'
                        : typeof bonus === 'number'
                          ? `${bonus} point${bonus === 1 ? '' : 's'}`
                          : 'set both TOK and EE to see this'}
                    </strong>
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTargets(profile.target_grades || {})
                      setEditing(false)
                    }}
                    className="btn btn-quiet control-md flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTargets}
                    disabled={saving}
                    className="btn btn-solid control-md flex-1"
                  >
                    {saving && <Spinner />}
                    {saving ? 'Saving' : 'Save targets'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Section>

        <p className="t-caption">
          Predictions come from quiz accuracy across your syllabus and are a study aid, not a
          forecast of your final result. TOK and the Extended Essay use your target grades until
          that coursework can be assessed.
        </p>
      </Page>
    </DashboardLayout>
  )
}
