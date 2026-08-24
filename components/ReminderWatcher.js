'use client'

import { useEffect, useRef } from 'react'
import { notify, notificationPermission } from '@/lib/notify'
import { dueReminders, relativeDay, KIND_LABEL } from '@/lib/calendar'

const SHOWN_KEY = 'psyllabus:reminders-shown'

/**
 * Raises a notification for calendar events whose reminder window has opened.
 *
 * This runs client-side while the app is open. There is no push server, so it
 * cannot wake a closed browser. Ids that have already fired are kept in
 * localStorage so a reload does not re-notify for the same event.
 */
export default function ReminderWatcher({ events = [] }) {
  const shownRef = useRef(null)

  if (shownRef.current === null && typeof window !== 'undefined') {
    try {
      shownRef.current = new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]'))
    } catch {
      shownRef.current = new Set()
    }
  }

  useEffect(() => {
    if (!events.length) return
    if (notificationPermission() !== 'granted') return

    const shown = shownRef.current || new Set()

    const check = () => {
      for (const event of dueReminders(events, shown)) {
        const ok = notify(`${KIND_LABEL[event.kind]}: ${event.title}`, {
          body: `${relativeDay(event.due_at)}${event.subject ? ` · ${event.subject}` : ''}`,
          tag: `psyllabus-event-${event.id}`,
        })
        if (!ok) continue
        shown.add(event.id)
      }
      try {
        localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown]))
      } catch {
        /* private mode, reminders simply repeat next session */
      }
    }

    check()
    const id = setInterval(check, 60000)
    return () => clearInterval(id)
  }, [events])

  return null
}
