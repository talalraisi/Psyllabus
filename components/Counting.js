'use client'

import { useEffect, useState } from 'react'

/**
 * A number that arrives rather than appears.
 *
 * Six figures rendered finished read as a table. The same six counting up over
 * three-quarters of a second read as a result, and the eye follows them. It
 * runs once, on mount, and then the page is still — this is the only thing
 * moving on the progress page and that is why it is allowed to.
 *
 * Every setState is inside a frame callback rather than the effect body, so
 * there is no render-then-correct-the-render, which is what the lint rule
 * about cascading renders is for.
 */
export default function Counting({ to = 0, ms = 750 }) {
  const [n, setN] = useState(0)

  useEffect(() => {
    let raf = 0
    const straightThere = () => {
      raf = requestAnimationFrame(() => setN(to))
    }

    if (!to) return straightThere()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return straightThere()

    const started = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - started) / ms)
      // Eased out, so it decelerates into the figure instead of stopping dead.
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])

  return <>{n}</>
}
