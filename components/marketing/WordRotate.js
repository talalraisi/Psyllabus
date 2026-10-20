'use client'

import { useEffect, useState } from 'react'

/**
 * One word at a time: the current word lifts up and fades out, and only then
 * does the next rise in from below (the "wait" pattern, one word on screen at
 * any moment). Each move takes 200ms, eased in and out.
 *
 * Plain CSS rather than an animation library, so the landing page carries
 * nothing extra for one line. The window clips the words as they travel, and
 * the live region reads each word once for screen readers. With reduced
 * motion the words still change, without the movement.
 */
export default function WordRotate({ words, duration = 2000, className = '', style }) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (words.length < 2) return
    if (leaving) {
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length)
        setLeaving(false)
      }, 200)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setLeaving(true), duration)
    return () => clearTimeout(t)
  }, [leaving, duration, words.length])

  return (
    <span className="-my-2 inline-block overflow-hidden py-2 align-bottom">
      <span
        key={`${index}-${leaving ? 'out' : 'in'}`}
        aria-hidden="true"
        className={`inline-block whitespace-nowrap ${leaving ? 'word-out' : 'word-in'} ${className}`}
        style={style}
      >
        {words[index]}
      </span>
      <span className="sr-only" aria-live="polite">
        {words[index]}
      </span>
    </span>
  )
}
