'use client'

/**
 * Friends: streaks and study time side by side, and nothing else.
 *
 * Added only by swapping codes, and only both ways (095-friends.sql). There
 * is no search, no list of other students, no messaging and nothing to type
 * to anyone. A friend's card shows their first name, picture, streak, today
 * against their goal, this week's minutes and when they last studied; never
 * a grade, a level, a score or a subject's progress.
 *
 * Streaks and minutes are worked out here with the same code as the
 * student's own (lib/streak.js), from the times their quizzes and timer runs
 * happened, so a friend's number is the one they see themselves.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, PageLoading } from '@/components/PageShell'
import { ConfirmSheet, DotsMenu } from '@/components/flashcards/DeckDialogs'
import Counting from '@/components/Counting'
import { forgetFriends, summarise } from '@/lib/friends'

const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`)

function lastSeen(ms, now) {
  if (!ms) return 'Not studied yet'
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86400000)
  if (days <= 0) return 'Studied today'
  if (days === 1) return 'Studied yesterday'
  return `Last studied ${days} days ago`
}

function Face({ name, url, size = 40 }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full text-[14px] font-semibold" style={{ width: size, height: size, background: 'var(--brand-tint)', color: 'var(--brand)' }}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function FriendsPage() {
  const [profile, setProfile] = useState(null)
  const [code, setCode] = useState('')
  const [friends, setFriends] = useState([])
  const [activity, setActivity] = useState({})
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState('')
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [now, setNow] = useState(0)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    const user = await getCurrentUser(supabase)
    if (!user) return router.push('/login')
    const p = await getProfile(supabase, user.id)
    if (!p) return router.push('/onboarding')
    const since = new Date(Date.now() - 120 * 86400000).toISOString()
    const [{ data: c }, { data: list }, { data: acts }, { data: myAttempts }, { data: mySessions }] = await Promise.all([
      supabase.rpc('my_friend_code'),
      supabase.rpc('my_friends'),
      supabase.rpc('friends_activity'),
      supabase.from('quiz_attempts').select('completed_at, elapsed_seconds').eq('user_id', user.id).gte('completed_at', since),
      supabase.from('study_sessions').select('started_at, ended_at').eq('user_id', user.id).gte('started_at', since),
    ])
    setProfile(p)
    setCode(c || '')
    setFriends(list || [])
    setActivity(Object.fromEntries((acts || []).map((a) => [a.friend, summarise(a)])))
    setMe(summarise({ attempts: myAttempts, sessions: mySessions, plan: p.plan_settings, session_minutes: p.session_minutes }))
    setNow(Date.now())
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    Promise.resolve().then(load)
  }, [load])

  const add = async (e) => {
    e.preventDefault()
    if (!entry.trim() || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('request_friend', { p_code: entry })
    setBusy(false)
    if (error || !data?.ok) return setNote({ bad: true, text: data?.error || 'That did not work. Try again in a moment.' })
    setNote({ bad: false, text: data.note })
    setEntry('')
    forgetFriends()
    load()
  }

  const respond = async (f, accept) => {
    setFriends((list) => list.filter((x) => x.id !== f.id))
    await supabase.rpc('respond_friend', { p_id: f.id, p_accept: accept })
    forgetFriends()
    load()
  }

  const remove = async (f) => {
    await supabase.rpc('remove_friend', { p_id: f.id })
    forgetFriends()
    setFriends((list) => list.filter((x) => x.id !== f.id))
  }

  const share = async () => {
    const text = `Add me on Psyllabus: my friend code is ${code}. Friends → Add a friend.`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      /* closed the share sheet */
    }
  }

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Friends" subtitle="Streaks and study time with your friends." rows={4} />
      </DashboardLayout>
    )
  }

  const accepted = friends.filter((f) => f.status === 'accepted')
  const incoming = friends.filter((f) => f.status === 'pending' && f.incoming)
  const outgoing = friends.filter((f) => f.status === 'pending' && !f.incoming)
  const first = (profile.full_name || '').trim().split(/\s+/)[0] || 'You'
  const board = [
    { id: 'me', name: `${first} (you)`, url: profile.avatar_url, s: me, mine: true },
    ...accepted.map((f) => ({ id: f.id, f, name: f.first_name, url: f.avatar_url, s: activity[f.friend] })),
  ]
    .filter((r) => r.s)
    .sort((a, b) => b.s.weekMinutes - a.s.weekMinutes || b.s.current - a.s.current)

  return (
    <DashboardLayout profile={profile}>
      <Page>
        <PageHeader title="Friends" subtitle="Streaks and study time, side by side. Friends never see your grades, and there is no messaging." />

        {/* Your code, and adding someone by theirs. */}
        <div className="mb-8 grid gap-3 md:grid-cols-2">
          <section className="rounded-[18px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-[12px] font-medium" style={{ color: 'var(--text-faint)' }}>
              Your friend code
            </p>
            <p className="mt-1.5 select-all text-[28px] font-semibold tracking-[0.12em]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {code || '········'}
            </p>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              Give it to friends you know. Only people with your code can ask, and you choose who to accept.
            </p>
            <button type="button" onClick={share} disabled={!code} className="btn btn-outline control-sm mt-4">
              {copied ? 'Copied' : 'Share your code'}
            </button>
          </section>
          <section className="rounded-[18px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-[12px] font-medium" style={{ color: 'var(--text-faint)' }}>
              Add a friend
            </p>
            <form onSubmit={add} className="mt-2 flex gap-2">
              <input
                value={entry}
                onChange={(e) => {
                  setEntry(e.target.value.toUpperCase())
                  setNote(null)
                }}
                maxLength={12}
                placeholder="Their code"
                aria-label="Their friend code"
                autoComplete="off"
                className="input h-11 min-w-0 flex-1 text-[16px] uppercase tracking-[0.1em]"
              />
              <button type="submit" disabled={busy || !entry.trim()} className="btn btn-solid control-md shrink-0">
                {busy ? 'Adding…' : 'Add'}
              </button>
            </form>
            {note && (
              <p className="mt-2.5 text-[13px]" role="status" style={{ color: note.bad ? 'var(--danger)' : 'var(--brand)' }}>
                {note.text}
              </p>
            )}
          </section>
        </div>

        {/* Requests. */}
        {(incoming.length > 0 || outgoing.length > 0) && (
          <section className="mb-8">
            <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">Requests</h2>
            <ul className="flex flex-col gap-2">
              {incoming.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-[14px] border px-4 py-3" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}>
                  <Face name={f.first_name} url={f.avatar_url} size={36} />
                  <span className="min-w-0 flex-1 text-[14px]">
                    <span className="font-semibold">{f.first_name}</span> wants to be friends
                  </span>
                  <button type="button" onClick={() => respond(f, false)} className="btn btn-quiet control-sm">
                    Decline
                  </button>
                  <button type="button" onClick={() => respond(f, true)} className="btn btn-solid control-sm">
                    Accept
                  </button>
                </li>
              ))}
              {outgoing.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-[14px] border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <Face name={f.first_name} url={f.avatar_url} size={36} />
                  <span className="min-w-0 flex-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                    Waiting for <span className="font-semibold" style={{ color: 'var(--text)' }}>{f.first_name}</span> to accept
                  </span>
                  <button type="button" onClick={() => remove(f)} className="btn btn-quiet control-sm">
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* This week, together. */}
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">This week</h2>
            <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
              Study time over the last 7 days
            </span>
          </div>
          {accepted.length === 0 ? (
            <div className="rounded-[18px] border border-dashed px-6 py-10 text-center" style={{ borderColor: 'var(--border-strong)' }}>
              <p className="text-[14.5px] font-semibold">Study alongside your friends</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Share your code with a friend, or add theirs. Once you are both in, you will see each other&apos;s streak and study time here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {board.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 rounded-[16px] border px-4 py-3.5 sm:gap-4" style={{ borderColor: r.mine ? 'var(--brand)' : 'var(--border)', background: 'var(--surface)' }}>
                  <span className="w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-faint)' }}>
                    {i + 1}
                  </span>
                  <Face name={r.name} url={r.url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{r.name}</span>
                    <span className="block truncate text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      {r.s.goalMet ? 'Goal met today' : r.s.studiedToday ? `${hm(r.s.todayMinutes)} of ${r.s.goal} today` : lastSeen(r.s.last, now)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[18px] font-semibold leading-none tracking-[-0.02em]" style={{ fontVariantNumeric: 'proportional-nums' }}>
                      <Counting to={r.s.current} />
                      <span className="ml-1 text-[11.5px] font-medium tracking-normal" style={{ color: 'var(--text-faint)' }}>
                        day{r.s.current === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      streak
                    </span>
                  </span>
                  <span className="hidden w-24 text-right sm:block">
                    <span className="block text-[15px] font-semibold tabular-nums">{hm(r.s.weekMinutes)}</span>
                    <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-faint)' }}>
                      this week
                    </span>
                  </span>
                  {/* The week, one dot a day: green for the goal, lighter for some study. */}
                  <span className="hidden gap-1 md:flex" aria-label={`Studied on ${r.s.week.filter((d) => d.minutes).length} of the last 7 days`}>
                    {r.s.week.map((d) => (
                      <span key={d.date} className="h-2.5 w-2.5 rounded-full" style={{ background: d.state === 'goal' ? 'var(--brand)' : d.state === 'studied' ? 'color-mix(in oklab, var(--brand) 40%, var(--surface-sunken))' : 'var(--border)' }} />
                    ))}
                  </span>
                  {r.f ? <DotsMenu label={`${r.name} options`} items={[{ label: 'Remove friend', danger: true, onClick: () => setRemoving(r.f) }]} /> : <span className="w-8" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        {removing && (
          <ConfirmSheet
            title={`Remove ${removing.first_name}?`}
            body="You stop seeing each other's streak and study time. They are not told, and you can add each other again with your codes."
            action="Remove"
            onConfirm={() => remove(removing)}
            onClose={() => setRemoving(null)}
          />
        )}
      </Page>
    </DashboardLayout>
  )
}
