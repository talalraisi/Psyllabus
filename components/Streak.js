'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, invalidateProfile } from '@/lib/cache'
import {
  computeStreak,
  goalFor,
  restDaysFor,
  loadStudyDays,
  STUDIED_EVENT,
  GOALS,
  MILESTONES,
} from '@/lib/streak'

/**
 * The streak, wherever it shows: a chip in the sidebar, a card on the
 * dashboard and a line under every quiz result. All three read the same
 * days through lib/streak.js and re-read them the moment something is
 * studied, so they always say the same number.
 */

const GOAL_EVENT = 'psyllabus:goal'
const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function Flame({ size = 18, lit = true, className = '', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={style}>
      <path
        d="M12 2.5c.4 3-1.2 4.6-2.7 6.1C7.7 10.2 6 12 6 14.8 6 18.5 8.7 21.5 12 21.5s6-3 6-6.7c0-2.6-1.3-4.3-2.6-5.7-.3 1.4-1 2.4-2 2.9.4-3.4-.4-6.7-1.4-8.5Z"
        fill={lit ? 'var(--flame)' : 'none'}
        stroke={lit ? 'var(--flame)' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {lit && (
        <path
          d="M12 21.5c-1.7 0-3-1.4-3-3.2 0-1.6 1-2.6 2-3.5.3 1 .9 1.6 1.6 1.9.1-1 .5-1.9 1.1-2.6.8 1 1.3 2.2 1.3 3.6 0 2.1-1.3 3.8-3 3.8Z"
          fill="#fff"
          opacity="0.55"
        />
      )}
    </svg>
  )
}

/** A thin progress ring, with whatever is passed as children in its middle. */
export function GoalRing({ value, max, size = 40, stroke = 4, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = Math.min(1, max > 0 ? value / max : 0)
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--flame)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * filled} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  )
}

/**
 * The streak for a profile, kept current. Pass no profile to have it read
 * the signed-in student's own (the quiz results do this).
 */
export function useStreak(profile) {
  const [own, setOwn] = useState(null)
  const [loaded, setLoaded] = useState(null)
  const [goal, setGoal] = useState(null)
  const [tick, setTick] = useState(0)
  const who = profile || own

  useEffect(() => {
    if (profile) return
    let off = false
    const supabase = createClient()
    getCurrentUser(supabase)
      .then((user) => (user ? getProfile(supabase, user.id) : null))
      .then((p) => {
        if (!off && p) setOwn(p)
      })
      .catch(() => {})
    return () => {
      off = true
    }
  }, [profile])

  useEffect(() => {
    const onStudied = () => setTick((t) => t + 1)
    const onGoal = (e) => setGoal(e.detail)
    window.addEventListener(STUDIED_EVENT, onStudied)
    window.addEventListener(GOAL_EVENT, onGoal)
    return () => {
      window.removeEventListener(STUDIED_EVENT, onStudied)
      window.removeEventListener(GOAL_EVENT, onGoal)
    }
  }, [])

  const id = who?.id
  useEffect(() => {
    if (!id) return
    let off = false
    loadStudyDays(createClient(), id)
      .then((days) => {
        // Today is read here, with the data, rather than while rendering.
        const now = new Date()
        if (!off) setLoaded({ days, today: new Date(now.getFullYear(), now.getMonth(), now.getDate()) })
      })
      .catch(() => {})
    return () => {
      off = true
    }
  }, [id, tick])

  return useMemo(() => {
    if (!loaded || !who) return null
    return computeStreak({ days: loaded.days, goal: goal ?? goalFor(who), rest: restDaysFor(who), today: loaded.today })
  }, [loaded, who, goal])
}

/** Save a new daily goal, and tell everything showing the old one. */
async function saveGoal(profileId, minutes) {
  window.dispatchEvent(new CustomEvent(GOAL_EVENT, { detail: minutes }))
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('plan_settings').eq('id', profileId).single()
  await supabase
    .from('profiles')
    .update({ plan_settings: { ...(data?.plan_settings || {}), goal: minutes } })
    .eq('id', profileId)
  invalidateProfile(profileId)
}

/** Pops once whenever the number it is given goes up. */
function usePop(value) {
  const last = useRef(value)
  const [n, setN] = useState(0)
  useEffect(() => {
    if (value == null) return
    if (last.current != null && value > last.current) {
      const t = setTimeout(() => setN((k) => k + 1), 0)
      last.current = value
      return () => clearTimeout(t)
    }
    last.current = value
  }, [value])
  return n
}

/* ---------- The sidebar chip ---------- */

export function StreakChip({ profile, expanded }) {
  const s = useStreak(profile)
  const pop = usePop(s?.current)
  if (!s) return <div className="h-11" aria-hidden="true" />

  const lit = s.current > 0
  const line = s.goalMet
    ? 'Goal reached today'
    : s.atRisk
      ? 'Study today to keep it'
      : `${s.todayMinutes} of ${s.goal} min today`

  return (
    <Link
      href="/dashboard#streak"
      title={expanded ? undefined : `${s.current}-day streak · ${line}`}
      className="flex h-11 items-center gap-3 rounded-[10px] pl-[11px] pr-2 transition-colors hover:bg-[var(--surface-sunken)]"
      style={{ background: s.atRisk ? 'var(--flame-tint)' : undefined }}
    >
      <span className="relative flex w-[18px] shrink-0 justify-center">
        <Flame key={pop} size={19} lit={lit} className={`${pop ? 'flame-pop' : ''} ${s.atRisk ? 'flame-flicker' : ''}`} style={{ color: 'var(--text-faint)' }} />
        {!expanded && (
          <span
            className="absolute -bottom-2 -right-2.5 min-w-[16px] rounded-full px-1 text-center text-[10px] font-bold leading-[16px] tabular-nums"
            style={{ background: lit ? 'var(--flame)' : 'var(--surface-sunken)', color: lit ? '#fff' : 'var(--text-faint)' }}
          >
            {s.current}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap transition-opacity duration-150" style={{ opacity: expanded ? 1 : 0 }}>
        <span className="block text-[13px] font-semibold leading-tight tabular-nums" style={{ color: 'var(--text)' }}>
          {s.current}-day streak
        </span>
        <span className="block truncate text-[11.5px] leading-tight" style={{ color: s.atRisk ? 'var(--flame)' : 'var(--text-faint)' }}>
          {line}
        </span>
      </span>
      <span className="transition-opacity duration-150" style={{ opacity: expanded ? 1 : 0 }}>
        <GoalRing value={s.todayMinutes} max={s.goal} size={26} stroke={3}>
          {s.goalMet && <span className="block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--flame)' }} />}
        </GoalRing>
      </span>
    </Link>
  )
}

/* ---------- The dashboard card ---------- */

const DAY_STYLE = {
  goal: { background: 'var(--flame)', borderColor: 'var(--flame)' },
  studied: { background: 'var(--flame-tint)', borderColor: 'var(--flame)' },
  rest: { background: 'transparent', borderColor: 'var(--border-strong)', borderStyle: 'dashed' },
  missed: { background: 'transparent', borderColor: 'var(--border-strong)' },
  today: { background: 'transparent', borderColor: 'var(--flame)', borderStyle: 'dashed' },
}

export function StreakCard({ profile, cta }) {
  const s = useStreak(profile)
  const pop = usePop(s?.current)
  const [picking, setPicking] = useState(false)

  if (!s) {
    return <div id="streak" className="skeleton mb-10 h-[220px] rounded-[16px]" aria-hidden="true" />
  }

  const { next, prev } = s.milestone
  const toNext = next ? next - s.current : 0
  const message = s.goalMet
    ? `Daily goal done. ${s.current > 1 ? `That is ${s.current} days running.` : 'Come back tomorrow to start a streak.'}`
    : s.studiedToday
      ? `${s.goal - s.todayMinutes} more minute${s.goal - s.todayMinutes === 1 ? '' : 's'} to reach today's goal.`
      : s.atRisk
        ? `Study today to keep your ${s.current}-day streak alive.`
        : s.restToday
          ? 'A rest day on your plan. Your streak is safe either way.'
          : 'Study for a minute today and a new streak starts.'

  return (
    <section
      id="streak"
      className="elev mb-10 scroll-mt-24 overflow-hidden rounded-[16px] border"
      style={{ borderColor: s.atRisk ? 'var(--flame)' : 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8">
        {/* The number */}
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px]"
            style={{ background: s.current > 0 ? 'var(--flame-tint)' : 'var(--surface-sunken)', color: 'var(--text-faint)' }}
          >
            <Flame key={pop} size={36} lit={s.current > 0} className={`${pop ? 'flame-pop' : ''} ${s.atRisk ? 'flame-flicker' : ''}`} />
          </span>
          <div>
            <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{s.current}</p>
            <p className="mt-1.5 text-[13px] font-medium">day streak</p>
            <p className="mt-0.5 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              Best {plural(s.longest, 'day')}
            </p>
          </div>
        </div>

        {/* The week */}
        <div className="min-w-0">
          <ol className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {s.week.map((d) => (
              <li key={d.date} className="flex flex-col items-center gap-1.5" title={`${d.minutes} min`}>
                <span className="text-[11px] font-medium" style={{ color: d.isToday ? 'var(--text)' : 'var(--text-faint)' }}>
                  {d.isToday ? 'Today' : WEEKDAY_LETTER[d.weekday]}
                </span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors"
                  style={DAY_STYLE[d.state]}
                >
                  {d.state === 'goal' && <Flame size={16} lit={false} style={{ color: '#fff' }} />}
                  {d.state === 'studied' && <Flame size={15} />}
                  {d.state === 'rest' && <span className="text-[9.5px] font-semibold uppercase" style={{ color: 'var(--text-faint)' }}>rest</span>}
                </span>
                <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                  {d.minutes ? `${d.minutes}m` : '·'}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[13.5px]" style={{ color: s.atRisk ? 'var(--flame)' : 'var(--text-body)' }}>
            {message}
          </p>
          {cta && !s.studiedToday && (
            <Link href={cta.href} className="btn btn-solid control-md mt-3 inline-flex">
              {cta.label}
            </Link>
          )}
        </div>

        {/* Today's goal */}
        <div className="flex items-center gap-4 md:flex-col md:gap-2">
          <GoalRing value={s.todayMinutes} max={s.goal} size={92} stroke={8}>
            <span className="block text-center">
              <span className="block text-[22px] font-semibold leading-none tabular-nums">{s.todayMinutes}</span>
              <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-faint)' }}>
                of {s.goal} min
              </span>
            </span>
          </GoalRing>
          <div className="relative md:text-center">
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              aria-expanded={picking}
              className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
              style={{ color: 'var(--text-muted)' }}
            >
              Daily goal · {s.goal} min
            </button>
            {picking && (
              <div className="pop-enter absolute right-0 z-20 mt-1 flex gap-1 rounded-[12px] border p-1.5 shadow-xl md:left-1/2 md:right-auto md:-translate-x-1/2" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                {GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setPicking(false)
                      saveGoal(profile.id, g)
                    }}
                    className="rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-semibold tabular-nums transition-colors hover:bg-[var(--surface-sunken)]"
                    style={g === s.goal ? { background: 'var(--flame)', color: '#fff' } : { color: 'var(--text-body)' }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t px-5 py-4 sm:px-6" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
        <div className="min-w-[180px] flex-1">
          <p className="text-[12.5px] font-medium" style={{ color: 'var(--text-body)' }}>
            {next
              ? `${plural(toNext, 'more day')} to a ${next}-day streak${s.milestone.reached.includes(next) ? '' : ' and a new badge'}`
              : 'Every badge earned. Legend.'}
          </p>
          {next && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border-strong)' }}>
              <span
                className="block h-full rounded-full transition-[width] duration-700"
                style={{ width: `${((s.current - prev) / (next - prev)) * 100}%`, background: 'var(--flame)' }}
              />
            </span>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Streak badges">
          {MILESTONES.map((m) => {
            const got = s.milestone.reached.includes(m)
            return (
              <li
                key={m}
                title={got ? `${m}-day streak reached` : `Reach a ${m}-day streak`}
                className="flex h-7 min-w-[34px] items-center justify-center gap-0.5 rounded-full px-2 text-[11px] font-bold tabular-nums"
                style={got ? { background: 'var(--flame)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-faint)', border: '1px solid var(--border-strong)' }}
              >
                {m}
              </li>
            )
          })}
        </ul>
        <p className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {Math.round(s.weekMinutes / 6) / 10}h this week · {s.goalDays}/7 goals
        </p>
      </div>
    </section>
  )
}

/* ---------- Under a quiz result ---------- */

export function StreakLine() {
  const s = useStreak(null)
  const pop = usePop(s?.current)
  if (!s) return null
  return (
    <div
      className="mt-6 flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3"
      style={{ borderColor: s.goalMet ? 'var(--flame)' : 'var(--border-strong)', background: s.goalMet ? 'var(--flame-tint)' : 'var(--surface)' }}
    >
      <Flame key={pop} size={22} lit={s.current > 0} className={pop ? 'flame-pop' : ''} style={{ color: 'var(--text-faint)' }} />
      <p className="min-w-0 flex-1 text-[13.5px]" style={{ color: 'var(--text-body)' }}>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>
          {s.current}-day streak.
        </span>{' '}
        {s.goalMet
          ? `Daily goal reached: ${s.todayMinutes} of ${s.goal} minutes.`
          : `${s.todayMinutes} of ${s.goal} minutes today, ${s.goal - s.todayMinutes} to go.`}
        {s.milestone.next && s.milestone.next - s.current <= 2 ? ` ${plural(s.milestone.next - s.current, 'day')} from the ${s.milestone.next}-day badge.` : ''}
      </p>
      <GoalRing value={s.todayMinutes} max={s.goal} size={30} stroke={3.5} />
    </div>
  )
}
