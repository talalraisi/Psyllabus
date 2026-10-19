'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * One word at a time, rolling.
 *
 * The hero named three curricula in a list, which reads as a specification. A
 * line that says "for students of AP" and then becomes "for students of
 * A-Levels" says the same thing and says it to one person at a time, which is
 * what a reader is. It also puts a slow, quiet piece of movement at the top of
 * the page, where otherwise nothing happens until you scroll.
 *
 * The outgoing word rolls up and out while the next rises into its place, and
 * nothing else moves. No fade: the line clips what leaves it, so a word on its
 * way out is hidden by the edge rather than dissolved, which is one effect
 * instead of two fighting.
 *
 * The slot is fixed to the widest word and never changes size. It briefly did
 * the opposite — measured each word and animated between the widths — which
 * removed the slack but meant the whole centred line re-centred itself on
 * every change, and a headline that shuffles sideways every three seconds is
 * far more distracting than a little air after a short word. Fixed slot, word
 * centred inside it: the line is nailed down and only the word moves, which is
 * the only thing here that should.
 *
 * Where the slack sits depends on how the line is set, and this line is
 * left-aligned: the word packs to the left of the slot and "the IB Diploma"
 * against "AP" leaves its difference trailing off the end, past where anyone
 * reads. Centre the line and that stops working — the same slack lands
 * between "of" and the word — so centre the word in the slot at the same
 * time.
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
    <span className={`relative inline-grid overflow-hidden align-bottom ${className}`} style={style}>
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
            /* Packed to the left of the slot, which is right while this
               line is left-aligned: a short word's slack trails off the end,
               past where anyone is reading. It was centred in the slot for as
               long as the hero was, because centred the same slack sits
               between "of" and the word and reads as a hole. If this line is
               ever centred again, centre the word in the slot again with it. */
            className="col-start-1 row-start-1 whitespace-nowrap"
            style={{
              /* Only the word on screen is selectable. Every word has to be in
                 the DOM for the roll to work, and without this, selecting the
                 headline copied "APA-LevelsIBDP" — all three run together,
                 including the two nobody could see. */
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
