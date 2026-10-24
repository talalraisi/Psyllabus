'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile, invalidateProfile } from '@/lib/cache'
import { SkeletonStreak } from '@/components/PageShell'
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
        {filled > 0 && <circle
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
        />}
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
  if (!s) return <div className="h-12" aria-hidden="true" />

  const lit = s.current > 0
  const pct = Math.min(100, (s.todayMinutes / Math.max(1, s.goal)) * 100)
  const title = lit ? `${s.current}-day streak` : 'Start a streak'
  const line = s.goalMet ? 'Goal done today' : s.atRisk ? 'Study today to keep it' : `${s.todayMinutes} / ${s.goal} min today`

  return (
    <Link
      // No streak yet: the way to start one is today's plan. With one: the
      // full picture of what has been studied.
      href={lit ? '/dashboard/analytics' : '/dashboard/study-plan'}
      title={expanded ? undefined : `${title} · ${line}`}
      className="flex h-12 items-center gap-3 rounded-[12px] pl-[7px] pr-2.5 transition-colors hover:bg-[var(--surface-sunken)]"
    >
      <span
        className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px]"
        style={{ background: lit ? 'var(--flame-tint)' : 'var(--surface-sunken)', color: 'var(--text-faint)' }}
      >
        <Flame key={pop} size={16} lit={lit} className={`${pop ? 'flame-pop' : ''} ${s.atRisk ? 'flame-flicker' : ''}`} />
        {!expanded && lit && (
          <span className="absolute -bottom-1.5 -right-1.5 min-w-[15px] rounded-full px-1 text-center text-[9.5px] font-bold leading-[15px] tabular-nums" style={{ background: 'var(--flame)', color: '#1a1206' }}>
            {s.current}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 transition-opacity duration-150" style={{ opacity: expanded ? 1 : 0 }}>
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[13px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
            {title}
          </span>
          <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: s.atRisk ? 'var(--flame)' : 'var(--text-faint)' }}>
            {s.goalMet ? '✓' : `${s.todayMinutes}/${s.goal}m`}
          </span>
        </span>
        <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full" style={{ background: 'var(--border-strong)' }}>
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: 'var(--flame)' }} />
        </span>
        <span className="sr-only">{line}</span>
      </span>
    </Link>
  )
}

/* ---------- The dashboard card ---------- */

export function StreakCard({ profile, cta }) {
  const s = useStreak(profile)
  const pop = usePop(s?.current)
  const [picking, setPicking] = useState(false)

  if (!s) {
    return <SkeletonStreak id="streak" />
  }

  const { next, prev } = s.milestone
  const left = Math.max(0, s.goal - s.todayMinutes)
  const message = s.goalMet
    ? s.current > 1
      ? `Goal done for today. That is ${s.current} days in a row.`
      : 'Goal done for today. Come back tomorrow and the streak begins.'
    : s.studiedToday
      ? `${left} more minute${left === 1 ? '' : 's'} and today's goal is done.`
      : s.atRisk
        ? `Study today to keep your ${s.current}-day streak.`
        : s.restToday
          ? 'A rest day on your plan. Your streak is safe either way.'
          : 'A few minutes today starts a new streak.'
  const top = Math.max(s.goal, ...s.week.map((d) => d.minutes))

  return (
    <section
      id="streak"
      className="elev mb-10 scroll-mt-24 overflow-hidden rounded-[18px] border"
      style={{ borderColor: s.atRisk ? 'color-mix(in oklab, var(--flame) 60%, var(--border-strong))' : 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10">
        {/* The streak and today */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]" style={{ background: s.current ? 'var(--flame-tint)' : 'var(--surface-sunken)', color: 'var(--text-faint)' }}>
              <Flame key={pop} size={26} lit={s.current > 0} className={`${pop ? 'flame-pop' : ''} ${s.atRisk ? 'flame-flicker' : ''}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {s.current}
                <span className="ml-1.5 text-[14px] font-medium tracking-normal" style={{ color: 'var(--text-muted)' }}>
                  day streak
                </span>
              </p>
              <p className="mt-1 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                Best {s.longest} · {(s.weekMinutes / 60).toFixed(1)}h this week
              </p>
            </div>
            <div className="relative">
              <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking} title="Change your daily goal" className="rounded-full transition-transform hover:scale-105">
                <GoalRing value={s.todayMinutes} max={s.goal} size={58} stroke={5}>
                  <span className="block text-center leading-none">
                    <span className="block text-[14px] font-semibold tabular-nums">{s.todayMinutes}</span>
                    <span className="block text-[9px]" style={{ color: 'var(--text-faint)' }}>
                      /{s.goal}m
                    </span>
                  </span>
                </GoalRing>
              </button>
              {picking && (
                <div className="pop-enter absolute right-0 top-full z-20 mt-2 w-52 rounded-[14px] border p-2 shadow-xl" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                  <p className="px-1.5 pb-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Daily goal
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {GOALS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setPicking(false)
                          saveGoal(profile.id, g)
                        }}
                        className="rounded-[8px] py-1.5 text-[12.5px] font-semibold tabular-nums transition-colors hover:bg-[var(--surface-sunken)]"
                        style={g === s.goal ? { background: 'var(--flame)', color: '#1a1206' } : { color: 'var(--text-body)' }}
                      >
                        {g}m
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-5 text-[13.5px] leading-relaxed" style={{ color: s.atRisk ? 'var(--flame)' : 'var(--text-body)' }}>
            {message}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            {cta && !s.goalMet && (
              <Link href={cta.href} className="btn btn-solid control-sm">
                {cta.label}
              </Link>
            )}
            <Link href="/dashboard/analytics" className="btn btn-quiet control-sm">
              See analytics
            </Link>
          </div>
        </div>

        {/* The week, as bars that fill towards the goal */}
        <div>
          <ol className="grid h-[104px] grid-cols-7 items-end gap-2 sm:h-[132px]">
            {s.week.map((d) => {
              const h = d.minutes ? Math.max(10, (d.minutes / top) * 100) : 0
              return (
                <li key={d.date} className="relative flex h-full flex-col justify-end" title={`${d.minutes} min`}>
                  {/* The goal line, across every day */}
                  <span className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ bottom: `${(s.goal / top) * 100}%`, borderColor: 'var(--border-strong)' }} />
                  <span
                    className="relative flex w-full items-start justify-center rounded-[8px] transition-[height] duration-700"
                    style={{
                      height: d.minutes ? `${h}%` : '6px',
                      background: d.state === 'goal' ? 'var(--flame)' : d.minutes ? 'color-mix(in oklab, var(--flame) 40%, var(--surface-sunken))' : d.state === 'rest' ? 'transparent' : 'var(--surface-sunken)',
                      border: d.state === 'rest' ? '1px dashed var(--border-strong)' : d.isToday && !d.minutes ? '1px dashed var(--flame)' : 'none',
                    }}
                  >
                    {d.state === 'goal' && h > 26 && <Flame size={13} lit={false} style={{ color: '#1a1206', marginTop: 6 }} />}
                  </span>
                </li>
              )
            })}
          </ol>
          <ol className="mt-2 grid grid-cols-7 gap-2 text-center">
            {s.week.map((d) => (
              <li key={d.date}>
                <span className="block text-[11px] font-semibold" style={{ color: d.isToday ? 'var(--text)' : 'var(--text-faint)' }}>
                  {d.isToday ? 'Today' : WEEKDAY_LETTER[d.weekday]}
                </span>
                <span className="block text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                  {d.state === 'rest' && !d.minutes ? 'rest' : d.minutes ? `${d.minutes}m` : '·'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* The next badge */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-5 py-3.5 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          {next ? (
            <>
              <strong className="font-semibold" style={{ color: 'var(--text)' }}>
                {next - s.current} more day{next - s.current === 1 ? '' : 's'}
              </strong>{' '}
              to a {next}-day streak
            </>
          ) : (
            'Every badge earned.'
          )}
        </span>
        {next && (
          <span className="h-1.5 min-w-[6rem] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border-strong)' }}>
            <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${((s.current - prev) / (next - prev)) * 100}%`, background: 'var(--flame)' }} />
          </span>
        )}
        <span className="flex gap-1" aria-label={`Badges earned: ${s.milestone.reached.join(', ') || 'none yet'}`}>
          {MILESTONES.map((m) => (
            <span
              key={m}
              title={s.milestone.reached.includes(m) ? `${m}-day streak reached` : `Reach a ${m}-day streak`}
              className="h-2 w-2 rounded-full"
              style={{ background: s.milestone.reached.includes(m) ? 'var(--flame)' : 'var(--border-strong)' }}
            />
          ))}
        </span>
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
