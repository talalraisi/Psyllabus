'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * The green line across the top that says the app is doing something.
 *
 * Two different waits look identical to a student and neither had any sign of
 * life: moving between pages, and a page that has arrived but is still
 * fetching. Skeletons cover the second one only once the new route has
 * rendered, which on a slow connection is exactly the part that feels broken —
 * you press a link and nothing happens at all.
 *
 * So this covers both. Clicking an internal link starts it, the route arriving
 * finishes it, and any page can drive it directly through `startLoading()` /
 * `stopLoading()` for its own fetches.
 *
 * It creeps rather than reports a percentage, because there is no percentage
 * to report: a request either has not come back or has. Creeping toward 90%
 * and snapping to 100 is honest about that — it says "still going" without
 * claiming to know how far.
 *
 * `useLinkStatus` is the built-in way to do the first half, but it only works
 * inside the Link that was clicked, so it cannot drive one bar for the whole
 * site.
 */

const listeners = new Set()
let depth = 0

/** Something slow started. Safe to nest; the bar clears when the last one ends. */
export function startLoading() {
  depth += 1
  for (const l of listeners) l(depth)
}

/** Something slow finished. */
export function stopLoading() {
  depth = Math.max(0, depth - 1)
  for (const l of listeners) l(depth)
}

export default function LoadingBar() {
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const pathname = usePathname()
  const timer = useRef(null)
  const hideTimer = useRef(null)

  // Manual control, for pages fetching their own data.
  useEffect(() => {
    const onChange = (d) => setActive(d > 0)
    listeners.add(onChange)
    return () => listeners.delete(onChange)
  }, [])

  // A click on an internal link is the earliest moment we know a navigation is
  // coming — earlier than any router event, and much earlier than the new
  // route rendering.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      const link = e.target.closest?.('a[href]')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return

      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page, or only a hash away: nothing is loading.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      setActive(true)
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  // The new route is here. Anything the page starts for itself will turn the
  // bar back on through startLoading().
  useEffect(() => {
    setActive(false)
  }, [pathname])

  useEffect(() => {
    clearTimeout(hideTimer.current)
    clearInterval(timer.current)

    if (active) {
      setProgress((p) => (p > 0 && p < 90 ? p : 8))
      // Slower the further it gets, so it never quite arrives while waiting.
      timer.current = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(0.4, (90 - p) / 14)))
      }, 120)
      return () => clearInterval(timer.current)
    }

    if (progress > 0) {
      setProgress(100)
      hideTimer.current = setTimeout(() => setProgress(0), 320)
    }
    return () => {
      clearTimeout(hideTimer.current)
      clearInterval(timer.current)
    }
    // progress is deliberately not a dependency: it is what this effect sets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
      style={{ opacity: progress > 0 && progress < 100 ? 1 : progress === 100 ? 1 : 0 }}
    >
      <div
        className="h-full origin-left"
        style={{
          width: `${progress}%`,
          background: 'var(--brand)',
          boxShadow: '0 0 8px color-mix(in oklab, var(--brand) 60%, transparent)',
          transition:
            progress === 0
              ? 'none'
              : progress === 100
                ? 'width 180ms ease-out, opacity 300ms ease 180ms'
                : 'width 180ms ease-out',
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  )
}
