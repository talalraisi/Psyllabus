'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_VAR } from '@/components/map/MapCanvas'
import { statusLabel } from '@/lib/subject-graph'

/**
 * The subject map as an orbit: where you are is a small sun in the middle,
 * and what it holds are planets circling it.
 *
 *   Sun        the level you are on (the subject, a topic or a unit), with a
 *              thin ring of how much of it is proved. Click it to go back up.
 *   Planets    what it holds, in syllabus order clockwise from the top, on
 *              true circles. Size is how much is inside; the planet's tint is
 *              where you stand, kept quiet (untested is grey, weak is a warm
 *              tint rather than an alarm), flat, no shading. Only the name sits under each one;
 *              the numbers are in the panel. Click to read about it, double-
 *              click to fly into it.
 *
 * Alive but never in the way: the planets float a few pixels where they are
 * (they do not revolve, so nothing moves out from under the pointer), a moon
 * runs slowly round each orbit, stars glint behind. With reduced motion,
 * nothing moves at all.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Two short lines from a long title, cut at a word. */
function lines(title, max) {
  const words = String(title).split(/\s+/)
  const out = ['']
  for (const w of words) {
    const cur = out[out.length - 1]
    if (!cur) out[out.length - 1] = w
    else if ((cur + ' ' + w).length <= max) out[out.length - 1] = cur + ' ' + w
    else if (out.length < 2) out.push(w)
    else {
      out[1] = (out[1] + ' ' + w).slice(0, max - 1).replace(/\s+\S*$/, '') + '…'
      break
    }
  }
  return out
}

/** An arc from the top, clockwise, for `frac` of the way round. */
function arc(cx, cy, r, frac) {
  const f = clamp(frac, 0, 0.9999)
  const a = -Math.PI / 2 + f * 2 * Math.PI
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
}

/** A status colour, softened towards grey so no planet shouts. */
const tone = (status) =>
  !status || status === 'not_started' ? 'color-mix(in oklab, var(--text-faint) 55%, var(--surface))' : `color-mix(in oklab, ${STATUS_VAR[status]} 62%, var(--text-faint))`

/** The same few dozen stars every time for a given size, so they do not jump about. */
function stars(w, h, count) {
  let seed = Math.round(w * 7 + h * 13) || 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  return Array.from({ length: count }, (_, i) => ({ x: rand() * w, y: rand() * h, r: 0.5 + rand() * 1.1, o: 0.12 + rand() * 0.35, twinkle: i % 6 === 0 }))
}

export default function OrbitCanvas({ graph, focusId, selectedId, weakOnly = false, onSelect, onEnter, onUp, onBackground, controls = null }) {
  const box = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const focus = graph.nodes.get(focusId)
  const children = useMemo(() => focus.childIds.map((id) => graph.nodes.get(id)), [graph, focus])

  const layout = useMemo(() => {
    const { w, h } = size
    if (!w || !h) return null
    const side = Math.min(w, h)
    const s = clamp(side / 720, 0.6, 1.2)
    const cx = w / 2
    const cy = h / 2
    const hub = clamp(side * 0.12, 48, 84)
    const n = children.length
    const rings = n <= 8 ? 1 : n <= 20 ? 2 : 3
    const most = Math.max(1, ...children.map((c) => c.tally?.total || 1))
    const sizeOf = (c) => (c.kind === 'subtopic' ? 8 * s + 4 : (13 + 13 * Math.sqrt((c.tally?.total || 1) / most)) * s)
    const big = Math.max(12, ...children.map(sizeOf))
    const narrow = w < 520
    // Too many to name in full on a phone: each shows its code (D1.2), and a
    // tap shows the rest in the panel.
    const compact = narrow && n > 8
    const labelW = compact ? 60 : narrow ? clamp(w * 0.28, 84, 112) : clamp(w * 0.19, 96, 150)
    const lineH = 15
    // True circles: as large as fits with a name under the lowest planet,
    // clear of the back button above and the Next strip below.
    const R = Math.max(hub + 64 * s, Math.min(w / 2 - labelW / 2 - 10, h / 2 - big - 8 - 2 * lineH - (narrow ? 72 : 58)))
    const radii = Array.from({ length: rings }, (_, k) => (rings === 1 ? R : R * (0.64 + (0.36 * k) / (rings - 1))))
    const planets = children.map((c, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * 2 * Math.PI
      // The top planet is on the outer ring; the inner rings sit between.
      const ring = rings === 1 ? 0 : rings - 1 - (i % rings)
      const x = cx + radii[ring] * Math.cos(a)
      const y = cy + radii[ring] * Math.sin(a)
      const r = sizeOf(c)
      const short = c.code || String(c.title).match(/^[A-Z0-9][\w.]{0,5}(?=[.\s])/)?.[0]
      const [l1, l2] = compact && short ? [short, null] : lines(c.title, Math.round(labelW / 6.4))
      const lh = (l2 ? 2 : 1) * lineH
      // The name under the planet, centred; above it for the planets on the top half of the inner rings, where below is the sun.
      const above = ring < rings - 1 && Math.sin(a) < -0.2
      const lx = x - labelW / 2
      const ly = above ? y - r - 8 - lh : y + r + 7
      return { node: c, x, y, r, a, i, l1, l2, lx, ly, lw: labelW, lh, compact }
    })

    // Names that land on another name or planet are nudged up or down until
    // they are clear, staying inside the canvas.
    const hit = (A, B) => A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h
    for (let pass = 0; pass < 60; pass++) {
      let moved = false
      for (const P of planets) {
        const L = { x: P.lx, y: P.ly, w: P.lw, h: P.lh }
        for (const Q of planets) {
          const disc = { x: Q.x - Q.r - 3, y: Q.y - Q.r - 3, w: 2 * Q.r + 6, h: 2 * Q.r + 6 }
          for (const O of Q === P ? [disc] : [{ x: Q.lx, y: Q.ly, w: Q.lw, h: Q.lh }, disc]) {
            if (!hit(L, O)) continue
            P.ly += L.y + L.h / 2 < O.y + O.h / 2 ? -3 : 3
            L.y = P.ly
            moved = true
          }
        }
        P.ly = clamp(P.ly, 4, h - P.lh - 4)
      }
      if (!moved) break
    }
    return { cx, cy, hub, radii, planets, s, sky: stars(w, h, Math.round((w * h) / 9000)) }
  }, [size, children])

  const needsWork = (n) => (n.kind === 'subtopic' ? ['in_progress', 'decaying'].includes(n.status) : (n.tally?.weak || 0) + (n.tally?.fading || 0) > 0)
  const t = focus.tally || { total: 0, proved: 0, assessed: 0 }
  const proved = t.total ? t.proved / t.total : 0
  const isRoot = focusId === graph.rootId

  return (
    <div
      ref={box}
      className="orbit relative h-full w-full select-none overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target.dataset?.bg) onBackground?.()
      }}
    >
      <style>{`
        .orbit-planet { animation: orbit-in 800ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-float { animation: orbit-float 8s ease-in-out infinite; }
        .orbit-hub { animation: orbit-hub 700ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-moon { transform-box: view-box; animation: orbit-turn linear infinite; }
        .orbit-star { animation: orbit-glint 5s ease-in-out infinite; }
        .orbit-sun-glow { transform-box: fill-box; transform-origin: center; animation: orbit-breathe 7s ease-in-out infinite; }
        @keyframes orbit-in { from { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.3); } to { opacity: 1; transform: none; } }
        @keyframes orbit-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes orbit-hub { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
        @keyframes orbit-turn { to { transform: rotate(360deg); } }
        @keyframes orbit-glint { 0%, 100% { opacity: .15; } 50% { opacity: .7; } }
        @keyframes orbit-breathe { 0%, 100% { opacity: .85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
        @media (prefers-reduced-motion: reduce) { .orbit-planet, .orbit-float, .orbit-hub, .orbit-moon, .orbit-star, .orbit-sun-glow { animation: none; } }
        .orbit-dot { transition: transform 260ms cubic-bezier(.16,1,.3,1), box-shadow 260ms; }
        .orbit-dot:hover, .orbit-dot:focus-visible { transform: scale(1.1); }
      `}</style>

      {layout && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="orbit-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="45%" stopColor="var(--brand)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {layout.sky.map((st, i) => (
            <circle key={i} className={st.twinkle ? 'orbit-star' : undefined} cx={st.x} cy={st.y} r={st.r} fill="var(--text-faint)" opacity={st.o} style={st.twinkle ? { animationDelay: `${-i * 0.7}s` } : undefined} />
          ))}
          <circle className="orbit-sun-glow" cx={layout.cx} cy={layout.cy} r={layout.hub * 3} fill="url(#orbit-sun)" />
          {layout.radii.map((R, k) => (
            <g key={k}>
              <circle cx={layout.cx} cy={layout.cy} r={R} fill="none" stroke="var(--text-faint)" strokeOpacity="0.22" strokeWidth="1" />
              {/* A moon on each orbit, taking a minute or two to go round. */}
              <g className="orbit-moon" style={{ transformOrigin: `${layout.cx}px ${layout.cy}px`, animationDuration: `${70 + k * 35}s`, animationDirection: k % 2 ? 'reverse' : 'normal', animationDelay: `${-k * 23}s` }}>
                <circle cx={layout.cx + R} cy={layout.cy} r={2.2} fill="var(--text-muted)" opacity="0.7" />
              </g>
            </g>
          ))}
          {/* How much of this level is proved, as a thin ring round the sun. */}
          <circle cx={layout.cx} cy={layout.cy} r={layout.hub + 6} fill="none" stroke="var(--border)" strokeWidth="2" />
          {proved > 0 && <path d={arc(layout.cx, layout.cy, layout.hub + 6, proved)} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />}
        </svg>
      )}

      {layout && (
        <>
          <button
            key={`hub-${focusId}`}
            type="button"
            onClick={() => (isRoot ? onSelect?.(null) : onUp?.())}
            title={isRoot ? focus.title : 'Back up a level'}
            className="orbit-hub absolute flex flex-col items-center justify-center rounded-full text-center transition-[filter] hover:brightness-110"
            style={{
              left: layout.cx - layout.hub,
              top: layout.cy - layout.hub,
              width: layout.hub * 2,
              height: layout.hub * 2,
              padding: layout.hub * 0.2,
              background: 'color-mix(in oklab, var(--brand) 8%, var(--surface))',
              border: '1px solid color-mix(in oklab, var(--brand) 30%, var(--border))',
            }}
          >
            {/* A small sun (a phone) keeps only the name and the count. */}
            {layout.hub >= 64 && (
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-faint)' }}>
                {isRoot ? 'Subject' : focus.kind === 'unit' ? 'Unit' : 'Topic'}
              </span>
            )}
            <span className={`mt-1 font-semibold leading-tight tracking-[-0.01em] ${layout.hub >= 64 ? 'line-clamp-3' : 'line-clamp-2'}`} style={{ fontSize: clamp(layout.hub / 6, 10.5, 14.5), color: 'var(--text)' }}>
              {focus.title}
            </span>
            <span className="mt-1 text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {layout.hub >= 64 ? `${t.proved} of ${t.total} proved` : `${t.proved}/${t.total}`}
            </span>
            {!isRoot && layout.hub >= 64 && (
              <span className="mt-0.5 text-[10px] font-medium" style={{ color: 'var(--brand)' }}>
                ↑ Back
              </span>
            )}
          </button>

          {layout.planets.map((p) => {
            const n = p.node
            const c = tone(n.status)
            const sel = n.id === selectedId
            const dim = weakOnly && !needsWork(n)
            const leaf = n.kind === 'subtopic'
            const pick = (e) => {
              e.stopPropagation()
              onSelect?.(sel ? null : n.id)
            }
            return (
              <div
                key={`${focusId}-${n.id}`}
                className="orbit-planet absolute left-0 top-0"
                style={{ '--dx': `${layout.cx - p.x}px`, '--dy': `${layout.cy - p.y}px`, animationDelay: `${Math.min(p.i, 24) * 30}ms`, opacity: dim ? 0.25 : 1, transition: 'opacity 300ms' }}
              >
                <div className="orbit-float" style={{ animationDelay: `${-p.i * 1.3}s`, animationDuration: `${7 + (p.i % 4)}s` }}>
                  <button
                    type="button"
                    onClick={pick}
                    onDoubleClick={() => !leaf && onEnter?.(n.id)}
                    aria-label={`${n.title}: ${statusLabel(n.status)}${n.score != null ? `, ${n.score}%` : ''}`}
                    aria-pressed={sel}
                    title={`${n.title} · ${statusLabel(n.status)}${n.score != null ? ` · ${n.score}%` : ''}${leaf ? '' : ` · ${n.tally?.total} subtopics`}`}
                    className="orbit-dot absolute rounded-full"
                    style={{
                      left: p.x - p.r,
                      top: p.y - p.r,
                      width: p.r * 2,
                      height: p.r * 2,
                      // Flat: one even colour and a fine edge, no shading.
                      background: c,
                      border: `1px solid color-mix(in oklab, ${c} 70%, var(--text))`,
                      boxShadow: sel ? `0 0 0 3px var(--bg), 0 0 0 4.5px ${c}, 0 0 28px 4px color-mix(in oklab, ${c} 35%, transparent)` : 'none',
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={pick}
                    onDoubleClick={() => !leaf && onEnter?.(n.id)}
                    className="absolute text-center leading-[15px]"
                    style={{ left: p.lx, top: p.ly, width: p.lw }}
                  >
                    <span className="block text-[12px]" style={{ color: sel ? 'var(--text)' : 'var(--text-muted)', fontWeight: sel ? 600 : 450 }}>
                      {p.l1}
                    </span>
                    {p.l2 && (
                      <span className="block text-[12px]" style={{ color: sel ? 'var(--text)' : 'var(--text-muted)', fontWeight: sel ? 600 : 450 }}>
                        {p.l2}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Legend, quiet, out of the way. */}
      <div data-ui className="pointer-events-none absolute right-4 top-4 hidden max-w-[15rem] flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] sm:flex" style={{ color: 'var(--text-faint)' }}>
        {['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started'].map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: tone(st) }} />
            {statusLabel(st)}
          </span>
        ))}
      </div>
      {controls}
    </div>
  )
}
