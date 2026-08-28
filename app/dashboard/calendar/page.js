'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/cache'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, EmptyState, PageLoading } from '@/components/PageShell'
import { IconCheck, IconClose } from '@/components/Icons'
import ReminderWatcher from '@/components/ReminderWatcher'
import MonthGrid from '@/components/MonthGrid'
import { accessibleSubjects } from '@/lib/access'
import {
  EVENT_KINDS,
  KIND_LABEL,
  KIND_DOT,
  REMINDER_OPTIONS,
  localDateKey,
  fromDateKey,
  daysUntil,
  relativeDay,
  formatEventDate,
  groupByDay,
  upcoming,
} from '@/lib/calendar'

const emptyDraft = (dateKey) => ({
  title: '',
  kind: 'test',
  subject: '',
  date: dateKey,
  time: '',
  remind: '1440',
  notes: '',
})

export default function CalendarPage() {
  const [profile, setProfile] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => localDateKey(new Date()))
  const [draft, setDraft] = useState(null)

  const router = useRouter()
  const supabase = createClient()

  const loadEvents = useCallback(
    async (userId) => {
      const { data, error: err } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .order('due_at', { ascending: true })
      if (err) {
        // The table only exists after migration 012 has been applied.
        setError(
          err.message?.includes('does not exist')
            ? 'The calendar table is not set up yet. Run `npm run setup-db` to apply the latest migration.'
            : err.message
        )
        return
      }
      setEvents(data || [])
    },
    [supabase]
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      const user = await getCurrentUser(supabase)
      if (!user) {
        router.push('/login')
        return
      }
      const profileData = await getProfile(supabase, user.id, { onFresh: setProfile })
      if (cancelled) return
      if (!profileData) {
        router.push('/onboarding')
        return
      }
      setProfile(profileData)
      await loadEvents(user.id)
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router, supabase, loadEvents])

  const byDay = useMemo(() => groupByDay(events), [events])
  const next = useMemo(() => upcoming(events).slice(0, 8), [events])
  const selectedEvents = byDay.get(selected) || []

  const saveEvent = async (e) => {
    e.preventDefault()
    if (saving || !draft?.title.trim() || !draft.date) return
    setSaving(true)
    setError('')

    const base = fromDateKey(draft.date)
    if (draft.time) {
      const [h, m] = draft.time.split(':').map(Number)
      base.setHours(h, m, 0, 0)
    } else {
      base.setHours(23, 59, 0, 0)
    }

    const user = await getCurrentUser(supabase)
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error: err } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        title: draft.title.trim(),
        kind: draft.kind,
        subject: draft.subject || null,
        due_at: base.toISOString(),
        all_day: !draft.time,
        notes: draft.notes.trim() || null,
        remind_minutes_before: draft.remind === '' ? null : parseInt(draft.remind, 10),
      })
      .select()
      .single()

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setEvents((prev) => [...prev, data].sort((a, b) => new Date(a.due_at) - new Date(b.due_at)))
    setSelected(localDateKey(data.due_at))
    setDraft(null)
  }

  const toggleComplete = async (event) => {
    const completed = !event.completed
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, completed } : e)))
    const { error: err } = await supabase
      .from('calendar_events')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', event.id)
    if (err) {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, completed: !completed } : e)))
      setError(err.message)
    }
  }

  const removeEvent = async (event) => {
    const snapshot = events
    setEvents((prev) => prev.filter((e) => e.id !== event.id))
    const { error: err } = await supabase.from('calendar_events').delete().eq('id', event.id)
    if (err) {
      setEvents(snapshot)
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Calendar" width="default" variant="calendar" />
      </DashboardLayout>
    )
  }

  const subjects = accessibleSubjects(profile)
  const shiftMonth = (delta) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))

  return (
    <DashboardLayout profile={profile}>
      <ReminderWatcher events={events} />
      <Page width="default">
        <PageHeader
          title="Calendar"
          subtitle="Tests, mocks, IA deadlines and orals, with a reminder before each one."
          action={
            <button
              onClick={() => setDraft(emptyDraft(selected))}
              className="btn btn-solid control-md"
            >
              Add event
            </button>
          }
        />

        {error && (
          <div className="mb-6 rounded-[var(--r-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3">
            <p className="text-sm text-[var(--status-weak)]">{error}</p>
          </div>
        )}

        {draft && (
          <form onSubmit={saveEvent} className="surface mb-8 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="t-card-title">New event</p>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label="Cancel"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
              >
                <IconClose width={18} height={18} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="t-overline">What is it</span>
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Paper 1 mock"
                  className="input mt-1"
                />
              </label>

              <label>
                <span className="t-overline">Type</span>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                  className="input mt-1"
                >
                  {EVENT_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="t-overline">Subject</span>
                <select
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="input mt-1"
                >
                  <option value="">No subject</option>
                  {(profile.subjects || subjects).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="t-overline">Date</span>
                <input
                  type="date"
                  required
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="input mt-1"
                />
              </label>

              <label>
                <span className="t-overline">Time (optional)</span>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  className="input mt-1"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="t-overline">Remind me</span>
                <select
                  value={draft.remind}
                  onChange={(e) => setDraft({ ...draft, remind: e.target.value })}
                  className="input mt-1"
                >
                  {REMINDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="t-overline">Notes (optional)</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Topics 1–3, calculator paper"
                  className="input mt-1"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              <button type="submit" disabled={saving} className="btn btn-solid control-md">
                {saving ? 'Saving…' : 'Add to calendar'}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="btn btn-quiet control-md"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Month grid */}
        <Section>
          <MonthGrid
            cursor={cursor}
            today={today}
            selected={selected}
            eventsByDay={byDay}
            onSelect={setSelected}
            onShiftMonth={shiftMonth}
            onToday={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          />
        </Section>

        {/* Selected day */}
        <Section
          title={fromDateKey(selected).toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
          action={
            <button
              onClick={() => setDraft(emptyDraft(selected))}
              className="text-sm font-medium text-[var(--brand)] hover:underline"
            >
              Add on this day
            </button>
          }
        >
          {selectedEvents.length === 0 ? (
            <div className="surface px-5 py-6">
              <p className="t-small">Nothing scheduled.</p>
            </div>
          ) : (
            <ul className="surface">
              {selectedEvents.map((event, i) => (
                <li key={event.id} className={i > 0 ? 'border-t border-[var(--border)]' : undefined}>
                  <EventRow
                    event={event}
                    onToggle={() => toggleComplete(event)}
                    onRemove={() => removeEvent(event)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* What is coming */}
        <Section title="Coming up">
          {next.length === 0 ? (
            <EmptyState
              title="Nothing on the calendar yet"
              description="Add your next test or IA deadline and the planner will start prioritising the topics it covers."
              action={
                <button
                  onClick={() => setDraft(emptyDraft(localDateKey(today)))}
                  className="btn btn-solid control-md"
                >
                  Add your first event
                </button>
              }
            />
          ) : (
            <ul className="surface">
              {next.map((event, i) => (
                <li key={event.id} className={i > 0 ? 'border-t border-[var(--border)]' : undefined}>
                  <EventRow
                    event={event}
                    showRelative
                    onToggle={() => toggleComplete(event)}
                    onRemove={() => removeEvent(event)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Page>
    </DashboardLayout>
  )
}

function EventRow({ event, onToggle, onRemove, showRelative = false }) {
  const days = daysUntil(event.due_at)
  const urgent = !event.completed && days >= 0 && days <= 3

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <button
        onClick={onToggle}
        aria-label={event.completed ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={event.completed}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--r-sm)] border transition-colors duration-150 ${
          event.completed
            ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
            : 'border-[var(--border-hover)]'
        }`}
      >
        {event.completed && <IconCheck width={12} height={12} />}
      </button>

      <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[event.kind]}`} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="t-caption truncate">
          {KIND_LABEL[event.kind]}
          {event.subject ? ` · ${event.subject}` : ''}
        </p>
        <p
          className={`truncate text-sm font-medium ${
            event.completed ? 'text-[var(--text-faint)] line-through' : 'text-[var(--text)]'
          }`}
        >
          {event.title}
        </p>
        {event.notes && <p className="t-caption mt-0.5 truncate">{event.notes}</p>}
      </div>

      <div className="shrink-0 text-right">
        <p className="t-caption">{formatEventDate(event.due_at, event.all_day)}</p>
        {showRelative && (
          <p
            className={`text-xs font-medium ${
              urgent ? 'text-[var(--status-weak)]' : 'text-[var(--text-faint)]'
            }`}
          >
            {relativeDay(event.due_at)}
          </p>
        )}
      </div>

      <button
        onClick={onRemove}
        aria-label={`Delete ${event.title}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--status-weak)]"
      >
        <IconClose width={16} height={16} />
      </button>
    </div>
  )
}
