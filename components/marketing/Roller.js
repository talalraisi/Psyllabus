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
 * The outgoing word rolls up and out while the next rises into its place, and
 * nothing else moves. No fade: the line clips what leaves it, so a word on its
 * way out is hidden by the edge rather than dissolved, which is one effect
 * instead of two fighting. Restraint is in the timing rather than the
 * distance: three and a half seconds a word, and a single line that never
 * resizes the layout around it.
 *
 * The widest word reserves the space. Without that the line jumps every time
 * "AP" follows "A-Levels", and a hero that twitches is worse than a hero that
 * is still.
 *
 * Words fill the slot from the left, which is only correct while the line is
 * left-aligned. The hero was briefly centred and this had to change with it: a
 * short word left its slack at the end of the slot, which nobody sees in a
 * left-aligned line and which became a visible hole — "For students of" then a
 * gap then "AP" — the moment the line was centred. If this line is ever
 * centred again, the word needs centring in the slot too, and it reads better
 * on a line of its own.
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
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
        style={{ userSelect: 'none' }}
      >
        {words.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>

      {words.map((word, i) => {
        const current = i === at
        const leaving = i === (at - 1 + words.length) % words.length
        return (
          <span
            key={word}
            aria-hidden={!current}
            className="col-start-1 row-start-1 whitespace-nowrap"
            style={{
              /* Only the word on screen is selectable. Every word has to be in
                 the DOM for the roll to work, and without this, selecting the
                 headline copied "the IB DiplomaA-LevelsAP" — all three run
                 together, including the two nobody could see. */
              userSelect: current ? 'auto' : 'none',
              /* Exactly two words move: the one going up and out, and the one
                 rising into its place. Everything else is parked below with no
                 transition at all, because a word travelling from the top slot
                 back to the bottom one animates straight through the line you
                 are reading. That was the muddiness — three things sliding at
                 once, one of them backwards. */
              transition: reduced || !(current || leaving) ? 'none' : 'transform 560ms cubic-bezier(0.22,1,0.3,1)',
              transform: current ? 'translateY(0)' : leaving ? 'translateY(-100%)' : 'translateY(100%)',
            }}
          >
            {word}
          </span>
        )
      })}

      {/* The live region announces the word once rather than on every frame,
          so a screen reader hears three names, not a ticker. */}
      <span className="sr-only" aria-live="polite" style={{ userSelect: 'none' }}>
        {words[at]}
      </span>
    </span>
  )
}
