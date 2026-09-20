'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A number that arrives rather than appears.
 *
 * Used on the few figures a student actually came to see — how much is
 * mastered, what they scored, how many are waiting. Counting up for half a
 * second makes the number feel like a result instead of a label, and it draws
 * the eye to the one thing on the screen worth reading first.
 *
 * Only on mount, never on every render: a figure that re-counts each time
 * something else on the page changes is a fidget, not a flourish. Anyone who
 * has asked for less motion gets the final value immediately.
 */
export default function CountUp({ value, duration = 600, decimals = 0, className, style }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(target)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      setShown(target)
      return
    }
    started.current = true

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || target === 0 || duration <= 0) {
      setShown(target)
      return
    }

    setShown(0)
    let frame
    const startedAt = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / duration)
      // Ease out: fast at the start, settling rather than stopping.
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(target * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
      else setShown(target)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return (
    <span className={className} style={style}>
      {decimals > 0 ? shown.toFixed(decimals) : Math.round(shown)}
    </span>
  )
}
