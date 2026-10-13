'use client'

import { useEffect, useState } from 'react'

/**
 * The product, at the top of the page.
 *
 * The hero had a sentence, then three cards of course counts, then a line that
 * rolled through the three curricula one at a time. All of it was words about
 * the thing rather than the thing, and the rolling line had a wart besides:
 * every curriculum sat in the DOM so that one could be shown, which meant
 * selecting the headline copied "the IB DiplomaA-LevelsAP".
 *
 * So this is a subject, coloured the way a real one is. One cell per subtopic,
 * grouped under its topic, drawing itself in as the page settles. Somebody who
 * has never heard of this understands it in about a second, which is more than
 * any sentence in that space managed.
 *
 * The data is fixed and honest about being an example: it is the shape of a
 * science subject part way through a year, with a plausible spread rather than
 * a flattering one. Two of the three topics are mostly unproved, because that
 * is what October looks like and a hero full of green would be a lie about the
 * product's whole argument.
 */

const TONE = {
  u: 'var(--status-untested)',
  w: 'var(--status-weak)',
  f: 'var(--status-fading)',
  d: 'var(--status-developing)',
  p: 'var(--status-proficient)',
  m: 'var(--status-mastered)',
}

const TOPICS = [
  { name: 'A. Space, time and motion', cells: 'mmpdpmdwpduuuuu' },
  { name: 'B. The particulate nature of matter', cells: 'pdwfduuuuuuu' },
  { name: 'C. Wave behaviour', cells: 'dwuuwuuuuuuuuu' },
]

export default function HeroMap() {
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  let n = 0

  return (
    <div
      className="elev-lg rounded-[18px] border p-5 md:p-6"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      aria-label="An example subject map: every subtopic coloured by what has been proved"
      role="img"
    >
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <span className="text-[14px] font-semibold tracking-[-0.015em]">Physics SL</span>
        <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
          example
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {TOPICS.map((topic) => (
          <div key={topic.name}>
            <p className="mb-2 truncate text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              {topic.name}
            </p>
            <div className="flex flex-wrap gap-[5px]">
              {[...topic.cells].map((c, i) => {
                /* Each cell waits a little longer than the one before it, so
                   the map fills in reading order rather than appearing. 18ms
                   is slow enough to read as drawing and fast enough that the
                   whole thing has settled before anybody has finished the
                   headline. */
                const delay = n++ * 18
                return (
                  <span
                    key={i}
                    className="h-[17px] w-[17px] rounded-[4px]"
                    style={{
                      background: TONE[c],
                      opacity: drawn ? 1 : 0,
                      transform: drawn ? 'none' : 'scale(0.6)',
                      transition: `opacity 320ms ease ${delay}ms, transform 320ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4"
        style={{ borderColor: 'var(--border)' }}
      >
        {[
          ['m', 'Mastered'],
          ['p', 'Proficient'],
          ['d', 'Developing'],
          ['w', 'Weak'],
          ['f', 'Fading'],
          ['u', 'Untested'],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: TONE[key] }} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
