'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * One word at a time, rolling.
 *
 * The hero named three curricula in a list, which reads as a specification. A
 * line that says "for students of IB" and then becomes "for students of
 * A-Levels" says the same thing and says it to one person at a time, which is
 * what a reader is. It also puts a slow, quiet piece of movement at the top of
 * the page, where otherwise nothing happens until you scroll.
 *
 * The outgoing word rolls up and out while the next rises into its place, so
 * the two are never both at rest. Restraint is in the timing rather than the
 * distance: three and a half seconds a word, and a single line that never
 * resizes the layout around it.
 *
 * The widest word reserves the space. Without that the line jumps every time
 * "AP" follows "A-Levels", and a hero that twitches is worse than a hero that
 * is still.
 */
export default function Roller({ words, ms = 3500, className = '', style }) {
  const [at, setAt] = useState(0)
  const [reduced, setReduced] = useState(false)
  const timer = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setReduced(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  useEffect(() => {
    if (reduced || words.length < 2) return
    timer.current = setTimeout(() => setAt((i) => (i + 1) % words.length), ms)
    return () => clearTimeout(timer.current)
  }, [at, ms, reduced, words.length])

  return (
    <span
      className={`relative inline-grid overflow-hidden align-bottom ${className}`}
      style={style}
    >
      {/* Sets the width to the longest word and is never seen. Everything that
          rolls is positioned on top of it. */}
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {words.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>

      {words.map((word, i) => {
        const current = i === at
        const previous = i === (at - 1 + words.length) % words.length
        return (
          <span
            key={word}
            aria-hidden={!current}
            className="col-start-1 row-start-1 whitespace-nowrap"
            style={{
              transition: reduced ? 'none' : 'transform 620ms cubic-bezier(0.16,1,0.3,1), opacity 420ms ease',
              transform: current ? 'translateY(0)' : previous ? 'translateY(-105%)' : 'translateY(105%)',
              opacity: current ? 1 : 0,
            }}
          >
            {word}
          </span>
        )
      })}

      {/* The live region announces the word once rather than on every frame,
          so a screen reader hears three names, not a ticker. */}
      <span className="sr-only" aria-live="polite">
        {words[at]}
      </span>
    </span>
  )
}
