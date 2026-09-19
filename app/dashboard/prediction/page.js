'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, getSyllabus, invalidateProfile } from '@/lib/cache'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, EmptyState, PageLoading, Spinner } from '@/components/PageShell'
import { startLoading, stopLoading } from '@/components/LoadingBar'
import { getSlugForSubject } from '@/lib/subject-map'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { predictDiploma, CONFIDENCE_COPY } from '@/lib/prediction'
import { CORE_GRADES, coreBonusPoints, IB_CORE_SUBJECTS, MAX_TOTAL_POINTS } from '@/lib/ib-points'
import { curriculumOf } from '@/lib/curriculum'
import { daysUntilExam } from '@/lib/planner'



export default function PredictionPage() {
  const [profile, setProfile] = useState(null)
  const [syllabus, setSyllabus] = useState([])
  const [effective, setEffective] = useState({})
  const [targets, setTargets] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  // The top bar runs for as long as this page is fetching, not just while the
  // route is in flight. A page that has arrived but has no data yet is the
  // part that feels broken.
  useEffect(() => {
    if (!loading) return
    startLoading()
    return () => stopLoading()
  }, [loading])
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
        <PageLoading title="Predicted Grade" width="default" variant="prediction" />
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
  const rules = curriculumOf(profile)
  const gradeScale = rules.grades
  // Only meaningful for the IB, and even there it is shown rather than counted.
  const bonus = rules.hasCore
    ? coreBonusPoints(targets['Theory of Knowledge'], targets['Extended Essay'])
    : null
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
            description="Take a quiz and a predicted grade appears here. Quiz results only — never self-rating."
            action={
              <Link href="/dashboard/subjects" className="btn btn-solid control-md">
                Open a subject
              </Link>
            }
          />
        ) : (
          <>
            {/* Headline. The predicted total is the one number on this page
                that matters, so it is the only thing set large; the target and
                the distance to it are reference beneath it. */}
            <div className="mb-14">
              <p
                className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--text-faint)' }}
              >
                {rules.hasCore ? 'Predicted subject points' : 'Predicted total'}
              </p>
              <p className="flex items-baseline gap-3">
                <span
                  className="text-[clamp(3rem,9vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] tabular-nums"
                  style={{ color: 'var(--brand)' }}
                >
                  {prediction.predictedTotal}
                </span>
                <span className="text-[17px]" style={{ color: 'var(--text-faint)' }}>
                  / {rules.maxSubjectPoints}
                </span>
              </p>

              <div
                className="mt-8 flex flex-wrap gap-x-12 gap-y-5 border-t pt-6"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    Your target
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.025em] tabular-nums">
                    {prediction.targetTotal}
                    <span className="text-[14px] font-normal" style={{ color: 'var(--text-faint)' }}>
                      {' '}/ {rules.maxSubjectPoints}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    Toward that target
                  </p>
                  <p
                    className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.025em] tabular-nums"
                    style={{
                      color: prediction.onTrack
                        ? 'var(--status-proficient)'
                        : 'var(--status-fading)',
                    }}
                  >
                    {Math.min(100, prediction.percentToTarget)}%
                  </p>
                </div>
                <div>
                  <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    Syllabus tested
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.025em] tabular-nums">
                    {Math.round(prediction.coverage * 100)}%
                  </p>
                </div>
              </div>

              <div
                className="mt-6 h-1 overflow-hidden rounded-full"
                style={{ background: 'var(--border-strong)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.min(100, prediction.percentToTarget)}%`,
                    background: prediction.onTrack
                      ? 'var(--status-proficient)'
                      : 'var(--brand)',
                  }}
                />
              </div>

              <p className="mt-5 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                {prediction.onTrack ? (
                  <>
                    You are{' '}
                    <strong style={{ color: 'var(--status-proficient)' }}>on track</strong>, and
                    currently{' '}
                    {prediction.gap === 0
                      ? 'exactly at'
                      : `${prediction.gap} point${Math.abs(prediction.gap) === 1 ? '' : 's'} above`}{' '}
                    your target.
                  </>
                ) : (
                  <>
                    You are{' '}
                    <strong style={{ color: 'var(--status-fading)' }}>
                      {Math.abs(prediction.gap)} point{Math.abs(prediction.gap) === 1 ? '' : 's'}
                    </strong>{' '}
                    short of your target.
                  </>
                )}
              </p>

              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                {CONFIDENCE_COPY[prediction.confidence]}
              </p>
            </div>

            {/* Per subject */}
            <Section title="By subject">
              <ul className="flex flex-col">
                {prediction.subjects.map((s, i) => {
                  const behind = s.gap !== null && s.gap < 0
                  return (
                    <li
                      key={s.subject}
                      className="border-b last:border-b-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="flex flex-wrap items-center gap-4 py-3.5">
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
                            className="btn btn-outline control-sm"
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
          <div>
            {saved && (
              <p
                className="mb-6 border-l-2 pl-4 text-[14px]"
                style={{ borderColor: 'var(--status-proficient)', color: 'var(--text-body)' }}
              >
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
                    .filter((sub) => !rules.hasCore || !IB_CORE_SUBJECTS.includes(sub))
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

                  {rules.hasCore &&
                    ['Theory of Knowledge', 'Extended Essay'].map((component) => (
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

                  {rules.hasCore && (
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
                  )}

                  {rules.hasTotal && rules.hasCore && (
                    <li className="flex items-center justify-between gap-4 border-t border-[var(--border)] py-2.5">
                      <span className="text-sm text-[var(--text-body)]">Subject points</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text)]">
                        {prediction.targetTotal} / {rules.maxSubjectPoints}
                      </span>
                    </li>
                  )}

                  {rules.hasTotal && (
                    <li className="flex items-center justify-between gap-4 border-t border-[var(--border-strong)] py-3">
                      <span className="text-sm font-semibold text-[var(--text)]">Target total</span>
                      <span className="shrink-0 text-base font-bold tabular-nums text-[var(--brand)]">
                        {rules.hasCore ? prediction.targetDiplomaTotal : prediction.targetTotal} /{' '}
                        {rules.hasCore ? rules.maxTotal : rules.maxSubjectPoints}
                      </span>
                    </li>
                  )}
                </ul>

                <button onClick={() => setEditing(true)} className="btn btn-quiet control-md">
                  Edit targets
                </button>
              </>
            ) : (
              <>
                <div className="mb-5 flex flex-col gap-4">
                  {(profile.subjects || [])
                    .filter((s) => !rules.hasCore || !IB_CORE_SUBJECTS.includes(s))
                    .map((subject) => (
                      <div key={subject}>
                        <p className="mb-2.5 text-[14px] font-medium">{subject}</p>
                        <div className="flex flex-wrap gap-2">
                          {gradeScale.map((g) => (
                            <button
                              key={g}
                              onClick={() => setTarget(subject, String(g))}
                              aria-pressed={String(targets[subject]) === String(g)}
                              className={`w-10 px-0 ${String(targets[subject]) === String(g) ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                  {rules.hasCore &&
                    ['Theory of Knowledge', 'Extended Essay'].map((component) => (
                    <div key={component}>
                      <p className="mb-2.5 text-[14px] font-medium">
                        {component} <span className="t-caption">(A to E)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {CORE_GRADES.map((g) => (
                          <button
                            key={g}
                            onClick={() => setTarget(component, g)}
                            aria-pressed={targets[component] === g}
                            className={`w-10 px-0 ${targets[component] === g ? 'btn btn-solid control-sm' : 'btn btn-outline control-sm'}`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {rules.hasCore && (
                <div
                  className="mb-6 border-l-2 pl-4"
                  style={{ borderColor: 'var(--border-strong)' }}
                >
                  <p className="text-[14px]" style={{ color: 'var(--text-body)' }}>
                    Core bonus:{' '}
                    <strong className="text-[var(--text)]">
                      {bonus === 'F'
                        ? 'Failing condition. An E in TOK or EE fails the Diploma.'
                        : typeof bonus === 'number'
                          ? `${bonus} point${bonus === 1 ? '' : 's'}`
                          : 'set both TOK and EE to see this'}
                    </strong>
                  </p>
                  <p className="t-caption mt-2">
                    Shown for reference. It is not added to your predicted total, because nothing
                    here has assessed your TOK or EE work.
                  </p>
                </div>
                )}

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
