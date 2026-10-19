'use client'

/**
 * Tests found in the student's own calendar, offered rather than assumed.
 *
 * A "Physics test" on Thursday in their school calendar should move Physics
 * up the plan, but a wrong guess changing their plan uninvited would be worse
 * than missing one, so nothing is added without a tap. "Not a test" is
 * remembered against that event so it is not offered again. Subject is
 * filled in when the title names it, and can be changed before adding.
 */

import { useMemo, useState } from 'react'
import { looksLikeTest } from '@/lib/test-detect'

export default function TestSuggestions({ imported, events, connections, subjects, now, onAdd, onDismiss }) {
  const [subjectFor, setSubjectFor] = useState({})
  const [working, setWorking] = useState(null)

  const suggestions = useMemo(() => {
    const linked = new Set(events.map((e) => e.source_uid).filter(Boolean))
    const dismissed = new Set(connections.flatMap((c) => c.dismissed || []))
    const at = now ? now.getTime() : 0
    return imported
      .filter((r) => new Date(r.ends_at).getTime() > at && !linked.has(r.event_uid) && !dismissed.has(r.event_uid))
      .map((r) => ({ row: r, guess: looksLikeTest(r, subjects) }))
      .filter((s) => s.guess)
      .slice(0, 6)
  }, [imported, events, connections, subjects, now])

  if (!suggestions.length) return null

  return (
    <section className="mb-10 rounded-[14px] border p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <h3 className="text-[14px] font-semibold tracking-[-0.01em]">From your calendar</h3>
      <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
        These look like tests. Add them and your plan starts preparing you for them.
      </p>
      <ul className="mt-3 flex flex-col">
        {suggestions.map(({ row, guess }) => {
          const subject = subjectFor[row.event_uid] ?? guess.subject ?? ''
          // All-day events are dates (UTC midnight); read them as such.
          const when = new Date(row.starts_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(row.all_day ? { timeZone: 'UTC' } : {}) })
          return (
            <li key={row.event_uid} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-[10rem] flex-1">
                <p className="text-[13px] font-medium">{row.title}</p>
                <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  {when}
                  {row.all_day ? '' : ` · ${new Date(row.starts_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
                </p>
              </div>
              <select
                value={subject}
                onChange={(e) => setSubjectFor((s) => ({ ...s, [row.event_uid]: e.target.value }))}
                aria-label={`Subject for ${row.title}`}
                className="input h-8 w-auto max-w-[13rem] px-2 text-[16px] sm:text-[12.5px]"
              >
                <option value="">Which subject?</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={working === row.event_uid}
                  onClick={async () => {
                    setWorking(row.event_uid)
                    await onAdd(row, { kind: guess.kind, subject: subject || null })
                    setWorking(null)
                  }}
                  className="btn btn-solid control-sm"
                >
                  {guess.kind === 'mock' ? 'Add as mock' : 'Add as test'}
                </button>
                <button
                  type="button"
                  disabled={working === row.event_uid}
                  onClick={async () => {
                    setWorking(row.event_uid)
                    await onDismiss(row)
                    setWorking(null)
                  }}
                  className="text-[12px] font-medium hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Not a test
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
