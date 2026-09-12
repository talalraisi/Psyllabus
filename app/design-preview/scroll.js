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

/** True once the element has been seen. Does not flip back, so nothing re-animates on the way up. */
export function useInView({ threshold = 0.25, rootMargin = '0px 0px -12% 0px' } = {}) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    return () => io.disconnect()
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

/** Wrap anything to have it arrive as you reach it. */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '', style }) {
  const [ref, seen] = useInView()
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: seen ? 1 : 0,
        transform: seen ? 'none' : 'translateY(14px)',
        transition: `opacity 620ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 620ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
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

  useEffect(() => {
    if (!seen) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(to)
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
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
 * This is the one graphic that had to exist. The whole argument for decay is a
 * shape, and a shape is better shown than described: memory falls away steeply
 * and then flattens, and each retest lifts it back up a little higher and
 * flattens it a little more. The stepped line is why spaced practice works,
 * and nobody has to read a paragraph to see it.
 */
export function ForgettingCurve() {
  const [ref, seen] = useInView({ threshold: 0.4 })
  const W = 560
  const H = 260
  const pad = { l: 38, r: 14, t: 16, b: 34 }

  // Four study events; after each one retention starts higher and falls slower.
  const events = [0, 0.26, 0.54, 0.8]
  const decay = [2.6, 1.9, 1.3, 0.85]
  const peak = [1, 0.94, 0.97, 1]

  const x = (u) => pad.l + u * (W - pad.l - pad.r)
  const y = (v) => H - pad.b - v * (H - pad.t - pad.b)

  const segments = events.map((startU, i) => {
    const endU = i < events.length - 1 ? events[i + 1] : 1
    const pts = []
    const steps = 26
    for (let s = 0; s <= steps; s++) {
      const u = startU + ((endU - startU) * s) / steps
      const local = (u - startU) / Math.max(0.0001, 1 - startU)
      const retention = peak[i] * Math.exp(-decay[i] * local * 1.7)
      pts.push(`${x(u).toFixed(1)},${y(Math.max(0.06, retention)).toFixed(1)}`)
    }
    return pts.join(' ')
  })

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Retention falls after each study session and falls more slowly each time it is retested">
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <line
            key={v}
            x1={pad.l}
            x2={W - pad.r}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        <text x={pad.l - 8} y={y(1) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">
          100%
        </text>
        <text x={pad.l - 8} y={y(0) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">
          0
        </text>
        <text x={pad.l} y={H - 10} fontSize="10" fill="var(--faint)">
          learned it
        </text>
        <text x={W - pad.r} y={H - 10} textAnchor="end" fontSize="10" fill="var(--faint)">
          exam
        </text>

        {segments.map((pts, i) => (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke={i === 0 ? 'var(--weak)' : 'var(--proficient)'}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              strokeDasharray: 900,
              strokeDashoffset: seen ? 0 : 900,
              transition: `stroke-dashoffset 1200ms cubic-bezier(0.4,0,0.2,1) ${i * 260}ms`,
            }}
          />
        ))}

        {/* retest markers */}
        {events.slice(1).map((u, i) => (
          <g
            key={u}
            style={{
              opacity: seen ? 1 : 0,
              transition: `opacity 420ms ease ${700 + i * 260}ms`,
            }}
          >
            <line x1={x(u)} x2={x(u)} y1={y(0)} y2={y(1)} stroke="var(--border-strong)" strokeDasharray="3 3" />
            <circle cx={x(u)} cy={y(peak[i + 1])} r="4.5" fill="var(--proficient)" />
          </g>
        ))}
      </svg>

      <p className="mt-4 text-[13.5px] leading-relaxed" style={{ color: 'var(--faint)' }}>
        Red is what happens if you never go back. Each dotted line is a retest, and the curve
        after it falls more slowly than the one before.
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
