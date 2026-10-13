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
 * instead of two fighting.
 *
 * The slot resizes to each word, and that is the part with history.
 *
 * It used to reserve the width of the longest word and never move, because a
 * line that jumps every time "AP" follows "A-Levels" is worse than a line that
 * is still. That was invisible while the hero was left-aligned — a short word
 * simply left its slack at the end, past where anyone was reading. The moment
 * the hero was centred the slack became a hole in the middle of a sentence:
 * "For students of" then a gap then "AP".
 *
 * Splitting it onto its own line fixed the hole and read like a splash screen.
 * So the slot animates instead: each word's width is measured once, and the
 * container transitions between them on the same curve and duration as the
 * roll. There is no jump because nothing is instant, and no hole because the
 * slot is never wider than the word in it. It is correct centred or left,
 * which is what the previous two attempts were not.
 *
 * Before the measurement lands — server render, first paint, JavaScript off —
 * the longest word sits in the flow and sizes the slot the old way, so the
 * line is never too narrow for its contents. Once measured it is taken out of
 * flow and the explicit width takes over.
 */
export default function Roller({ words, ms = 3500, className = '', style }) {
  const [at, setAt] = useState(0)
  const [reduced, setReduced] = useState(false)
  const [widths, setWidths] = useState(null)
  const spans = useRef([])
  const timer = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setReduced(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  /* Measured in a frame rather than in the effect body, because setting state
     straight out of an effect is what react-hooks/set-state-in-effect is for.
     Measured again after the webfont resolves: the fallback face is a
     different width, and a slot sized against it would be wrong by a few
     pixels for the life of the page. */
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = requestAnimationFrame(() => {
        const next = spans.current.map((el) => (el ? Math.ceil(el.getBoundingClientRect().width) : 0))
        if (next.length === words.length && next.every((n) => n > 0)) setWidths(next)
      })
    }
    measure()
    let live = true
    document.fonts?.ready.then(() => {
      if (live) measure()
    })
    return () => {
      live = false
      cancelAnimationFrame(raf)
    }
  }, [words])

  useEffect(() => {
    if (reduced || words.length < 2) return
    timer.current = setTimeout(() => setAt((i) => (i + 1) % words.length), ms)
    return () => clearTimeout(timer.current)
  }, [at, ms, reduced, words.length])

  const roll = 'cubic-bezier(0.22,1,0.3,1)'

  return (
    <span
      className={`relative inline-grid overflow-hidden align-bottom ${className}`}
      style={{
        ...style,
        width: widths ? widths[at] : undefined,
        transition: reduced || !widths ? 'none' : `width 560ms ${roll}`,
      }}
    >
      {/* Sizes the slot until the measurement lands, then leaves the flow so
          the explicit width above is free to be narrower than it. */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
        style={{ userSelect: 'none', position: widths ? 'absolute' : 'static' }}
      >
        {words.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>

      {words.map((word, i) => {
        const current = i === at
        const leaving = i === (at - 1 + words.length) % words.length
        return (
          <span
            key={word}
            ref={(el) => {
              spans.current[i] = el
            }}
            aria-hidden={!current}
            /* justify-self-start keeps each one content-sized, which is what
               makes it measurable: stretched to the column it would report the
               column's width and every word would measure the same. */
            className="col-start-1 row-start-1 justify-self-start whitespace-nowrap"
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
              transition: reduced || !(current || leaving) ? 'none' : `transform 560ms ${roll}`,
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
