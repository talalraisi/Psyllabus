'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Page } from '@/components/PageShell'
import Select from '@/components/Select'
import { Flame } from '@/components/Streak'
import { analyse, RANGES, hm, UNASSIGNED } from '@/lib/study-analytics'
import { computeStreak, goalFor, restDaysFor } from '@/lib/streak'
import { minutesPerDay, studyIntervals } from '@/lib/study-time'
import { displaySubtopic, progressKey, STATUS_LABELS } from '@/lib/progress'
import { StackedBars, Donut, LineChart, HeatGrid, Calendar, Bars, colourFor } from '@/components/analytics/Charts'

/**
 * Analytics: where the time went, what was studied, and how it is going.
 *
 * One page, one range (a week to a year) and optionally one subject, and
 * every chart answers to both. Time is split between subjects by
 * lib/study-analytics.js, so the subjects add up to the total; the streak is
 * the same one the sidebar shows (lib/streak.js).
 */

const STATUS_VAR = {
  mastered: 'var(--status-mastered)',
  proficient: 'var(--status-proficient)',
  confident: 'var(--status-developing)',
  in_progress: 'var(--status-weak)',
  decaying: 'var(--status-fading)',
  not_started: 'var(--status-untested)',
}
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const band = (h) => (h < 5 ? 'late at night' : h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : h < 21 ? 'in the evening' : 'at night')

function Card({ title, aside, children, className = '' }) {
  return (
    <section className={`elev rounded-[20px] border p-5 sm:p-6 ${className}`} style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      {(title || aside) && (
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</h2>
          {aside && (
            <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
              {aside}
            </span>
          )}
        </header>
      )}
      {children}
    </section>
  )
}

function Stat({ label, value, sub, tone, icon }) {
  return (
    <div className="elev rounded-[18px] border p-4 sm:p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: 'var(--text-faint)' }}>
        {icon}
        {label}
      </p>
      <p className="mt-2 text-[clamp(1.4rem,3vw,1.85rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
      {sub && (
        <p className="mt-1.5 truncate text-[12px]" style={{ color: tone || 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function AnalyticsView({ attempts, sessions, progress = [], profile, now }) {
  const [rangeKey, setRangeKey] = useState('1m')
  const [subject, setSubject] = useState('')
  const range = RANGES.find((r) => r.key === rangeKey)

  const a = useMemo(() => analyse({ attempts, sessions, range, subject: subject || null, now }), [attempts, sessions, range, subject, now])

  // The streak is all-time and every subject, as everywhere else.
  const streak = useMemo(() => {
    const d = new Date(now)
    return computeStreak({
      days: minutesPerDay(studyIntervals({ attempts, sessions })),
      goal: goalFor(profile),
      rest: restDaysFor(profile),
      today: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    })
  }, [attempts, sessions, profile, now])

  // Subjects with any time at all, for the filter and stable colours.
  const allSubjects = useMemo(() => analyse({ attempts, sessions, range: RANGES.at(-1), now }).subjects.map((s) => s.name), [attempts, sessions, now])
  const colours = useMemo(() => colourFor([...allSubjects, ...(profile?.subjects || []).filter((s) => !allSubjects.includes(s))]), [allSubjects, profile])
  const status = useMemo(() => Object.fromEntries(progress.map((p) => [progressKey(p.subject, p.subtopic), p.status])), [progress])

  const nothing = !attempts.length && !sessions.length
  const change = a.change == null ? null : Math.round(a.change * 100)

  return (
    <Page width="wide">
      {/* Header and controls */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-[-0.03em]">Analytics</h1>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
            Where your study time goes, what you have covered, and how it is going.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {allSubjects.length > 1 && (
            <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" className="h-10 min-w-[10rem] max-w-[14rem] rounded-full border pl-4 pr-2 text-[13px] font-medium" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
              <option value="">All subjects</option>
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
          <div className="flex rounded-full p-0.5" style={{ background: 'var(--surface-sunken)' }} role="radiogroup" aria-label="Period">
            {RANGES.map((r) => (
              <button
                key={r.key}
                role="radio"
                aria-checked={r.key === rangeKey}
                onClick={() => setRangeKey(r.key)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold tabular-nums transition-colors"
                style={r.key === rangeKey ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.25)' } : { color: 'var(--text-muted)' }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {nothing ? (
        <div className="rounded-[20px] border border-dashed px-6 py-16 text-center" style={{ borderColor: 'var(--border-strong)' }}>
          <p className="text-[15px] font-semibold">Nothing to show yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            Run the study timer or take a quiz and this fills in: time by subject, when you study best, your streak and how your accuracy moves.
          </p>
          <Link href="/dashboard/study-plan" className="btn btn-solid control-md mt-6">
            Open today&apos;s plan
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Headline numbers */}
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Stat
              label="Time studied"
              value={hm(a.total)}
              sub={change == null ? 'Nothing the period before' : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% vs before`}
              tone={change == null ? undefined : change >= 0 ? 'var(--status-proficient)' : 'var(--status-weak)'}
            />
            <Stat label="Daily average" value={hm(a.perDay)} sub={`Over ${a.rangeDays} days`} />
            <Stat label="Days studied" value={`${a.studiedDays}`} sub={`of ${a.rangeDays} · ${Math.round((a.studiedDays / a.rangeDays) * 100)}%`} />
            <Stat icon={<Flame size={13} lit={streak.current > 0} />} label="Streak" value={`${streak.current} day${streak.current === 1 ? '' : 's'}`} sub={`Best ${streak.longest} · goal ${streak.goal} min`} />
            <Stat label="Questions answered" value={a.quizzes.answered.toLocaleString()} sub={a.quizzes.accuracy == null ? 'No quizzes yet' : `${Math.round(a.quizzes.accuracy * 100)}% right · ${a.quizzes.count} quizzes`} />
            <Stat label="Focus sessions" value={`${a.focus.count}`} sub={a.focus.count ? `Avg ${hm(a.focus.average)} · longest ${hm(a.focus.longest)}` : 'Start the timer to track them'} />
          </div>

          {/* Time over the period */}
          <Card
            title="Study time"
            aside={range.bucket === 'day' ? 'Per day' : range.bucket === 'week' ? 'Per week' : 'Per month'}
          >
            <StackedBars buckets={a.buckets} colours={colours} />
            {a.subjects.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
                {a.subjects.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colours[s.name] }} />
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* By subject */}
            <Card title="Time by subject" aside={hm(a.total)}>
              {a.subjects.length ? (
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                  <Donut
                    items={a.subjects}
                    colours={colours}
                    centre={
                      <>
                        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                          Total
                        </span>
                        <span className="text-[20px] font-semibold tabular-nums">{hm(a.total)}</span>
                      </>
                    }
                  />
                  <ul className="flex w-full min-w-0 flex-1 flex-col gap-2.5">
                    {a.subjects.map((s) => (
                      <li key={s.name} className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colours[s.name] }} />
                        <span className="min-w-0 flex-1 truncate text-[13px]" title={s.name === UNASSIGNED ? 'Timer runs with no subject set' : undefined}>
                          {s.name}
                        </span>
                        <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                          {Math.round(s.share * 100)}%
                        </span>
                        <span className="w-14 text-right text-[12.5px] font-semibold tabular-nums">{hm(s.minutes)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="py-10 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
                  No study in this period.
                </p>
              )}
            </Card>

            {/* Accuracy */}
            <Card title="Accuracy" aside={a.quizzes.accuracy == null ? '' : `${Math.round(a.quizzes.accuracy * 100)}% overall`}>
              <LineChart points={a.buckets.map((b) => b.accuracy)} labels={a.buckets.map((b) => b.label)} />
              {a.quizzes.bySubject.length > 0 && (
                <div className="mt-5">
                  <Bars
                    items={a.quizzes.bySubject.slice(0, 6).map((s) => ({ label: s.name, value: Math.round((s.accuracy || 0) * 100), colour: colours[s.name] }))}
                    format={(v) => `${v}%`}
                    max={100}
                  />
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* When */}
            <Card title="Focus activity" aside="When in the week you study">
              <HeatGrid grid={a.grid} />
              {a.bestTime && (
                <p className="mt-2 rounded-[12px] px-3.5 py-2.5 text-[12.5px]" style={{ background: 'var(--brand-tint)', color: 'var(--text-body)' }}>
                  You study most on <strong>{DAYS[a.bestTime.d]}s {band(a.bestTime.h)}</strong>, around {String(a.bestTime.h).padStart(2, '0')}:00. Put the hardest topics there.
                </p>
              )}
            </Card>

            {/* Sessions */}
            <Card title="Focus sessions" aside={a.focus.count ? `${a.focus.count} in this period` : ''}>
              {a.focus.count ? (
                <>
                  <Bars items={a.focus.lengths.map((l) => ({ label: l.label, value: l.n }))} />
                  <ul className="mt-5 flex flex-col">
                    {a.focus.recent.map((r) => (
                      <li key={r.start} className="flex items-center gap-2.5 border-t py-2 text-[12.5px] first:border-t-0" style={{ borderColor: 'var(--border)' }}>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colours[r.subject] || 'var(--text-faint)' }} />
                        <span className="min-w-0 flex-1 truncate">{r.subtopic ? displaySubtopic(r.subtopic) : r.subject}</span>
                        <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                          {new Date(r.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="w-12 text-right font-semibold tabular-nums">{hm(r.minutes)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="py-10 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
                  The study timer records each focus session.
                </p>
              )}
            </Card>
          </div>

          {/* Streak */}
          <Card title="Streak" aside={`${a.studiedDays} of ${a.rangeDays} days studied`}>
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex shrink-0 items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-[16px]" style={{ background: streak.current ? 'var(--flame-tint)' : 'var(--surface-sunken)', color: 'var(--text-faint)' }}>
                  <Flame size={30} lit={streak.current > 0} />
                </span>
                <div>
                  <p className="text-[26px] font-semibold leading-none tabular-nums">{streak.current}</p>
                  <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                    day streak · best {streak.longest}
                  </p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <Calendar days={a.days} from={a.from} end={a.end} goal={streak.goal} />
                <p className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'color-mix(in oklab, var(--flame) 45%, var(--surface-sunken))' }} /> Studied
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--flame)' }} /> Daily goal reached
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* What */}
          <Card title="What you studied" aside={a.subtopics.length ? `${a.subtopics.length} subtopic${a.subtopics.length === 1 ? '' : 's'}` : ''}>
            {a.subtopics.length ? (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[12.5px]">
                  <thead>
                    <tr style={{ color: 'var(--text-faint)' }}>
                      <th className="px-2 pb-2 font-medium">Subtopic</th>
                      <th className="px-2 pb-2 font-medium">Time</th>
                      <th className="px-2 pb-2 text-right font-medium">Quizzes</th>
                      <th className="px-2 pb-2 text-right font-medium">Right</th>
                      <th className="px-2 pb-2 font-medium">Level now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.subtopics.filter((t) => t.subject !== UNASSIGNED).slice(0, 12).map((t) => {
                      const st = status[progressKey(t.subject, t.subtopic)] || 'not_started'
                      const maxMin = a.subtopics[0].minutes || 1
                      return (
                        <tr key={`${t.subject}|${t.subtopic}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="max-w-[16rem] px-2 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colours[t.subject] }} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{displaySubtopic(t.subtopic)}</span>
                                <span className="block truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
                                  {t.subject}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-20 overflow-hidden rounded-full" style={{ background: 'var(--surface-sunken)' }}>
                                <span className="block h-full rounded-full" style={{ width: `${(t.minutes / maxMin) * 100}%`, background: colours[t.subject] }} />
                              </span>
                              <span className="tabular-nums">{hm(t.minutes)}</span>
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{t.quizzes || '—'}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums">{t.accuracy == null ? '—' : `${Math.round(t.accuracy * 100)}%`}</td>
                          <td className="px-2 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_VAR[st] }} />
                              {STATUS_LABELS[st] || 'Untested'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
                Set a subtopic on the timer, or take a quiz, and it shows up here.
              </p>
            )}
          </Card>
        </div>
      )}
    </Page>
  )
}
