'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Scroll behaviour and the graphics that depend on it.
 *
 * Everything here is driven by where the page is rather than by a click, which
 * is what makes a long page feel alive while you read it instead of animating
 * once and then sitting still.
 *
 * Two things deliberately absent, because they are the tells that make an
 * interface look generated: nothing follows the cursor with a glow, and nothing
 * parallaxes at a different speed from the text. Both read as decoration
 * competing with the content. What is here instead is reveal on entry, drawing
 * on entry, counting on entry, and a section that holds still while its
 * illustration changes — all of which direct attention rather than borrow it.
 */

/**
 * True once the element has been seen.
 *
 * Only for work that has to happen on arrival, such as starting a counter.
 * Never use it to decide whether content is visible: if the observer does not
 * report, nothing should disappear. Callers are expected to render their final
 * state when this stays false.
 */
export function useInView({ threshold = 0.25, rootMargin = '0px 0px -12% 0px' } = {}) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setSeen(true)
      return
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold, rootMargin }
    )
    io.observe(el)

    /**
     * Fallback, without giving up scroll triggering.
     *
     * Every reveal starts at opacity zero, so anything that stops the observer
     * firing hides the content rather than merely skipping an animation. The
     * first attempt at guarding that simply revealed everything after a second
     * and a half — which fixed the hiding and broke the feature, because the
     * whole page then appeared at once on load regardless of where you were
     * scrolled to.
     *
     * So the fallback does the observer's job by hand instead: measure against
     * the viewport on scroll. Same behaviour, worse performance, only ever used
     * when the real thing has not reported in.
     */
    let fallbackOn = false
    const check = () => {
      const box = el.getBoundingClientRect()
      if (box.top < window.innerHeight * 0.9 && box.bottom > 0) {
        setSeen(true)
        stopFallback()
      }
    }
    const stopFallback = () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      fallbackOn = false
    }
    const startFallback = () => {
      if (fallbackOn) return
      fallbackOn = true
      window.addEventListener('scroll', check, { passive: true })
      window.addEventListener('resize', check)
      check()
    }

    const arm = setTimeout(startFallback, 1200)

    return () => {
      io.disconnect()
      clearTimeout(arm)
      stopFallback()
    }
  }, [threshold, rootMargin])

  return [ref, seen]
}

/** How far through an element the viewport has scrolled, 0 to 1. */
export function useScrollProgress() {
  const ref = useRef(null)
  const [p, setP] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    const measure = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      if (total <= 0) return setP(0)
      setP(Math.min(1, Math.max(0, -r.top / total)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return [ref, p]
}

/**
 * Wrap anything to have it arrive as you reach it.
 *
 * The animation is CSS, driven by the browser's scroll timeline, so this
 * component only picks a class and an optional stagger. It carries no state,
 * which is the point: every JavaScript version of this started at opacity zero
 * and so had a way of leaving the page blank, twice over.
 */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '', style }) {
  return (
    <Tag
      className={`rv-reveal ${className}`}
      style={delay ? { ...style, animationDelay: `${delay}ms` } : style}
    >
      {children}
    </Tag>
  )
}

/** A hairline at the top of the window showing how far down the page you are. */
export function ScrollBar() {
  const [p, setP] = useState(0)

  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      const total = document.documentElement.scrollHeight - window.innerHeight
      setP(total > 0 ? window.scrollY / total : 0)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="fixed inset-x-0 top-0 z-30 h-[2px]" style={{ background: 'transparent' }}>
      <div
        className="h-full origin-left"
        style={{ transform: `scaleX(${p})`, background: 'var(--brand)' }}
      />
    </div>
  )
}

/** Counts up the first time it is seen, rather than on page load where nobody is looking. */
export function CountUp({ to, suffix = '', prefix = '', duration = 1100, className = '', style }) {
  const [ref, seen] = useInView({ threshold: 0.6 })
  const [n, setN] = useState(0)

  /**
   * The number has to be right even if the count never runs.
   *
   * Everything that starts the animation depends on the observer reporting,
   * and when it does not the figure sits at zero — a homepage claiming "0
   * subjects covered", which is worse than no animation at all. This is the
   * backstop: if nothing has moved it shortly after mount, show the real value.
   * Same rule as the reveals. Decoration may fail; the content may not.
   */
  useEffect(() => {
    const backstop = setTimeout(() => setN((current) => (current === 0 ? to : current)), 1800)
    return () => clearTimeout(backstop)
  }, [to])

  useEffect(() => {
    if (!seen) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(to)

    const start = performance.now()
    let raf = 0
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    // requestAnimationFrame is throttled or paused whenever the page is not
    // being painted: a background tab, a hidden window, a phone with the
    // screen off. Without this the number simply stops partway, which is how
    // the coverage line ended up reading "18 subjects" instead of 173 and
    // looking like a bug in the data rather than in the animation. The
    // guarantee is that the true value always lands, animated or not.
    const settle = setTimeout(() => setN(to), duration + 240)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [seen, to, duration])

  return (
    <span ref={ref} className={`tabular-nums ${className}`} style={style}>
      {prefix}
      {n.toLocaleString()}
      {suffix}
    </span>
  )
}

/* ---------------------------------------------------------------- graphics */

/**
 * The forgetting curve, drawn as you arrive at it.
 *
 * Two lines from the same starting point, which is the only way the argument
 * lands: one shows what happens if you never go back, the other shows the same
 * memory retested four times. The retested one falls more shallowly after every
 * retest, and that difference is the entire case for spaced practice.
 *
 * The first version of this was wrong in a way that mattered. Each segment's
 * decay was normalised against the distance to the end of the chart rather than
 * against its own length, so the falls got steeper as they went right instead
 * of shallower — it drew the opposite of the thing it was supposed to show, and
 * looked plausible enough not to notice. Decay is measured in elapsed time now,
 * with the rate falling at each retest, and each retest is drawn as a visible
 * lift rather than left implicit in a gap between two lines.
 */
export function ForgettingCurve() {
  const [ref, seen] = useInView({ threshold: 0.35 })

  const W = 560
  const H = 250
  const pad = { l: 42, r: 16, t: 18, b: 38 }
  /**
   * Rounded, because these numbers are rendered twice.
   *
   * Math.exp is not guaranteed to give bit-identical results in two different
   * JavaScript engines, so the server wrote y1="92.38740335809105" and the
   * browser computed 92.38740335809103 and React reported a hydration
   * mismatch. Two decimal places is far below a pixel and identical everywhere.
   */
  const r2 = (n) => Math.round(n * 100) / 100
  const x = (u) => r2(pad.l + u * (W - pad.l - pad.r))
  const y = (v) => r2(H - pad.b - v * (H - pad.t - pad.b))

  // Time is the x axis, so decay is exp(-rate * elapsed) and nothing is
  // normalised per segment.
  const SPAN = 3
  const retests = [0, 0.26, 0.52, 0.76]
  const rates = [1.0, 0.62, 0.4, 0.24]

  const line = (from, to, rate, at) => {
    const pts = []
    for (let i = 0; i <= 30; i++) {
      const u = from + ((to - from) * i) / 30
      pts.push(`${i ? 'L' : 'M'}${x(u)},${y(Math.exp(-rate * (u - at) * SPAN))}`)
    }
    return pts.join(' ')
  }

  const neverAgain = line(0, 1, rates[0], 0)
  const segments = retests.map((at, i) =>
    line(at, i < retests.length - 1 ? retests[i + 1] : 1, rates[i], at)
  )
  const lowAt = (i) =>
    r2(Math.exp(-rates[i] * ((i < retests.length - 1 ? retests[i + 1] : 1) - retests[i]) * SPAN))

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Two curves from the same start: without revisiting, retention falls to almost nothing by the exam. Retested four times, each fall is shallower and it stays high."
      >
        {[0, 0.5, 1].map((v) => (
          <line key={v} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" />
        ))}
        <text x={pad.l - 8} y={y(1) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">100%</text>
        <text x={pad.l - 8} y={y(0.5) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">50%</text>
        <text x={pad.l - 8} y={y(0) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">0</text>

        {/* Never revisited. */}
        <path
          d={neverAgain}
          fill="none"
          stroke="var(--weak)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: 1000,
            strokeDashoffset: seen ? 0 : 1000,
            transition: 'stroke-dashoffset 1400ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />

        {/* The lift at each retest, drawn so the sawtooth is explicit. */}
        {retests.slice(1).map((at, i) => (
          <line
            key={`lift${at}`}
            x1={x(at)}
            x2={x(at)}
            y1={y(lowAt(i))}
            y2={y(1)}
            stroke="var(--proficient)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            style={{
              opacity: seen ? 1 : 0,
              transition: `opacity 300ms ease ${520 + i * 300}ms`,
            }}
          />
        ))}

        {/* Retested. */}
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--proficient)"
            strokeWidth="2.75"
            strokeLinecap="round"
            style={{
              strokeDasharray: 600,
              strokeDashoffset: seen ? 0 : 600,
              transition: `stroke-dashoffset 700ms cubic-bezier(0.4,0,0.2,1) ${i * 300}ms`,
            }}
          />
        ))}

        {retests.map((at, i) => (
          <circle
            key={`dot${at}`}
            cx={x(at)}
            cy={y(1)}
            r="4"
            fill="var(--proficient)"
            style={{ opacity: seen ? 1 : 0, transition: `opacity 260ms ease ${i * 300}ms` }}
          />
        ))}

        <text x={pad.l} y={H - 12} fontSize="10" fill="var(--faint)">the day you learn it</text>
        <text x={W - pad.r} y={H - 12} fontSize="10" fill="var(--faint)" textAnchor="end">the exam</text>
      </svg>

      <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
        <span className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>
          <span className="h-[2px] w-5 rounded-full" style={{ background: 'var(--weak)' }} />
          never went back
        </span>
        <span className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>
          <span className="h-[3px] w-5 rounded-full" style={{ background: 'var(--proficient)' }} />
          retested four times
        </span>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--faint)' }}>
        Same memory, same starting point. Each dotted line is a retest, and every fall after one
        is shallower than the last.
      </p>
    </div>
  )
}

/** Circular progress, drawn on entry. Reads as a dial rather than a bar. */
export function MasteryRing({ pct, label, tone = 'proficient', size = 132 }) {
  const [ref, seen] = useInView({ threshold: 0.5 })
  const r = size / 2 - 9
  const c = 2 * Math.PI * r

  return (
    <div ref={ref} className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(--${tone})`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          style={{
            strokeDashoffset: seen ? c * (1 - pct / 100) : c,
            transition: 'stroke-dashoffset 1100ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      <p className="-mt-[calc(50%+6px)] text-[22px] font-semibold tabular-nums">{pct}%</p>
      <p className="mt-[calc(50%-14px)] text-[12.5px]" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
    </div>
  )
}

/**
 * A section that holds still while its illustration changes.
 *
 * The reader scrolls, the text on the left advances, and the graphic on the
 * right swaps to match. It is the one scroll technique that adds meaning rather
 * than movement, because it lets one picture explain three steps in sequence
 * instead of three pictures competing.
 */
export function StickySteps({ steps, render }) {
  const [ref, p] = useScrollProgress()
  const active = Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999))

  // Pinning needs two columns and a tall viewport to make sense. On a phone
  // the text and the illustration have to share one column, so a pinned
  // section becomes a cramped screen you cannot scroll out of. Below the
  // breakpoint this is an ordinary stack, and every step shows its body.
  return (
    <div ref={ref} className="md:[height:var(--pin-h)]" style={{ '--pin-h': `${steps.length * 85}vh` }}>
      <div className="md:sticky md:top-0 md:flex md:min-h-screen md:items-center">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 md:grid-cols-2 md:gap-16 md:px-8 md:py-0">
          <div className="flex flex-col justify-center gap-8">
            {steps.map((s, i) => {
              const on = i === active
              return (
                <div
                  key={s.title}
                  className="step border-l-2 pl-5 transition-all duration-500"
                  data-on={on ? 'true' : 'false'}
                  style={{ borderColor: on ? 'var(--brand)' : 'var(--border)' }}
                >
                  <p className="mb-1.5 text-[12px] font-semibold tabular-nums" style={{ color: on ? 'var(--brand)' : 'var(--faint)' }}>
                    {s.step}
                  </p>
                  <h3 className="text-[19px] font-semibold tracking-[-0.018em]">{s.title}</h3>
                  <p className="step-body mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--body)' }}>
                    {s.body}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="flex items-center">{render(active)}</div>
        </div>
      </div>
    </div>
  )
}
