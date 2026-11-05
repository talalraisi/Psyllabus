'use client'

/**
 * Time spent studying on a screen that is not the timer: flashcards, or a
 * quiz that is left before it is finished.
 *
 * It counts a second only when the tab is in front and the student has done
 * something in the last two minutes, so a deck left open over dinner is not
 * an hour of revision. Whatever has been counted is saved as a study stretch
 * (lib/session-timer.js recordStudyStretch) when the screen goes away: on
 * leaving the page, closing the tab, or `save()` being called. `discard()`
 * drops it instead, for when something else already records that time (a
 * finished quiz writes its own attempt with its length).
 */

import { useEffect, useRef, useState } from 'react'
import { recordStudyStretch } from '@/lib/session-timer'

const IDLE_MS = 2 * 60 * 1000

export function useStudyClock({ running = true, subject = null, subtopic = null } = {}) {
  const seconds = useRef(0)
  const lastActive = useRef(0)
  const label = useRef({ subject, subtopic })
  useEffect(() => {
    label.current = { subject, subtopic }
  })

  useEffect(() => {
    lastActive.current = Date.now()
    const poke = () => {
      lastActive.current = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const e of events) window.addEventListener(e, poke, { passive: true })
    return () => {
      for (const e of events) window.removeEventListener(e, poke)
    }
  }, [])

  useEffect(() => {
    if (!running) return
    lastActive.current = Date.now()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActive.current < IDLE_MS) seconds.current += 1
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  // Made once; its methods read the refs when called, never during render.
  const [api] = useState(() => ({
    save() {
      const s = seconds.current
      seconds.current = 0
      if (s > 0) recordStudyStretch({ seconds: s, ...label.current })
    },
    discard() {
      seconds.current = 0
    },
  }))

  // Closing the tab or leaving the page saves what was counted.
  useEffect(() => {
    const onHide = () => api.save()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      api.save()
    }
  }, [api])

  return api
}
