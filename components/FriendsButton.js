'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { loadFriends, startPresence } from '@/lib/friends'

/**
 * Friends at a glance, top right: who is on now, as faces with a green dot
 * and a count, and a short list on click (on now, streak, today's study).
 * Only what the Friends page shows; never grades, and nothing to type to
 * anyone. It also tells friends you are on (startPresence).
 */

export function Face({ name, url, size = 26, ring = false, online = false, edge = 'var(--bg)' }) {
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 2px ${edge}` : undefined }
  const dot = Math.max(8, Math.round(size * 0.32))
  return (
    <span className="relative inline-flex shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={style} />
      ) : (
        <span className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ ...style, background: 'var(--brand-tint)', color: 'var(--brand)' }}>
          {(name || '?').slice(0, 1).toUpperCase()}
        </span>
      )}
      {online && (
        <span
          aria-label="On now"
          className="absolute -bottom-px -right-px rounded-full"
          style={{ width: dot, height: dot, background: '#22c55e', boxShadow: `0 0 0 2px ${edge}` }}
        />
      )}
    </span>
  )
}

export default function FriendsButton() {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    let live = true
    startPresence(supabase)
    const load = () =>
      loadFriends(supabase)
        .then((d) => live && setData(d))
        .catch(() => {})
    load()
    // Who is on changes by the minute; the cache keeps this to one read.
    const t = setInterval(load, 61_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [supabase])

  useEffect(() => {
    if (!open) return
    const away = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const friends = (data?.list || []).filter((f) => f.status === 'accepted').map((f) => ({ ...f, s: data.activity[f.friend] })).filter((f) => f.s)
  const incoming = (data?.list || []).filter((f) => f.status === 'pending' && f.incoming).length
  const active = friends.filter((f) => f.s.online)
  const sorted = [...friends].sort(
    (a, b) => Number(b.s.online) - Number(a.s.online) || Number(b.s.studiedToday) - Number(a.s.studiedToday) || b.s.current - a.s.current
  )
  const shown = sorted.slice(0, 3)

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={friends.length ? `${active.length} of ${friends.length} friends on now` : 'Friends'}
        className="flex h-9 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
        style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
      >
        {shown.length ? (
          <span className="flex -space-x-2">
            {shown.map((f) => (
              <Face key={f.id} name={f.first_name} url={f.avatar_url} online={f.s.online} ring />
            ))}
          </span>
        ) : (
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full" style={{ background: 'var(--surface-sunken)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5" />
              <circle cx="16.8" cy="9.2" r="2.5" />
              <path d="M16.5 14c2.2.2 3.7 1.8 4.1 4.3" />
            </svg>
          </span>
        )}
        {active.length ? `${active.length} on now` : 'Friends'}
        {incoming > 0 && (
          <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ background: 'var(--brand)', color: '#fff' }}>
            {incoming}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Friends today" className="pop-enter absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-[14px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
            <p className="text-[13px] font-semibold">Friends</p>
            {friends.length > 0 && (
              <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                {active.length} of {friends.length} on now
              </p>
            )}
          </div>
          {incoming > 0 && (
            <Link href="/dashboard/friends" onClick={() => setOpen(false)} className="mx-2 mb-1 block rounded-[10px] px-2.5 py-2 text-[12.5px] font-medium" style={{ background: 'var(--brand-tint)', color: 'var(--text)' }}>
              {incoming} friend request{incoming === 1 ? '' : 's'} waiting
            </Link>
          )}
          {friends.length === 0 ? (
            <p className="px-4 pb-3 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              Add friends with their code to see each other&apos;s streaks and study time.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto px-2 pb-1">
              {sorted.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2">
                  <Face name={f.first_name} url={f.avatar_url} size={30} online={f.s.online} edge="var(--surface)" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{f.first_name}</span>
                    <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      {f.s.online && <span style={{ color: '#16a34a' }}>On now · </span>}
                      <span style={{ color: f.s.studiedToday ? 'var(--brand)' : undefined }}>
                        {f.s.goalMet ? 'Goal met today' : f.s.studiedToday ? `${f.s.todayMinutes} min today` : 'Not studied yet today'}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12.5px] font-semibold tabular-nums">
                    {f.s.current}
                    <span className="ml-0.5 text-[10.5px] font-normal" style={{ color: 'var(--text-faint)' }}>
                      day{f.s.current === 1 ? '' : 's'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/friends" onClick={() => setOpen(false)} className="block border-t px-4 py-2.5 text-[12.5px] font-medium hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border)', color: 'var(--brand)' }}>
            {friends.length ? 'All friends' : 'Add friends'}
          </Link>
        </div>
      )}
    </div>
  )
}
