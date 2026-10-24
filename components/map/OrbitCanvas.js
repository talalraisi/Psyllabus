'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_VAR } from '@/components/map/MapCanvas'
import { statusLabel } from '@/lib/subject-graph'

/**
 * The subject map as an orbit: where you are sits in the middle, and what is
 * inside it circles round.
 *
 *   Hub        the level you are on (the subject, a topic or a unit), with a
 *              ring of how much of it is proved. Click it to go back up.
 *   Planets    what it holds, in syllabus order clockwise from the top. Size
 *              is how much is inside; colour is where you stand; the thin arc
 *              round each is its score. Click to read about it (the panel beside
 *              has Open its map), double-click to fly into it.
 *
 * More than seven planets share two or three rings, alternating, so neighbours
 * sit at different distances and their names never collide. Labels point
 * outward, away from the hub. Nothing spins under the pointer: only the faint
 * orbit lines drift, and not at all with reduced motion.
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

/** An arc of a circle as a path, from the top, clockwise, for `frac` of the way round. */
function arc(cx, cy, r, frac) {
  const f = clamp(frac, 0, 0.9999)
  const a = -Math.PI / 2 + f * 2 * Math.PI
  const x = cx + r * Math.cos(a)
  const y = cy + r * Math.sin(a)
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`
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
    const s = clamp(side / 720, 0.55, 1.25)
    const cx = w / 2
    const cy = h / 2
    const hub = clamp(side * 0.13, 46, 92)
    const n = children.length
    const rings = n <= 7 ? 1 : n <= 18 ? 2 : 3
    const most = Math.max(1, ...children.map((c) => c.tally?.total || 1))
    const sizeOf = (c) => (c.kind === 'subtopic' ? 11 * s + 3 : (16 + 18 * Math.sqrt((c.tally?.total || 1) / most)) * s)
    const big = Math.max(12, ...children.map(sizeOf))
    // On a phone there is no room beside a planet: every name sits above or below it.
    const narrow = w < 520
    // Too many to name in full on a phone: each shows its code (D1.2), and a
    // tap shows the rest in the panel.
    const compact = narrow && n > 8
    const labelW = compact ? 64 : narrow ? clamp(w * 0.27, 84, 110) : clamp(w * 0.2, 84, 170)
    // Orbits are ellipses that fill the space: wide enough for a name beside
    // the planets at the sides, tall enough for one above and below.
    const outerX = narrow ? w / 2 - labelW / 2 - 8 : Math.max(hub + 70 * s, w / 2 - labelW - big - 14)
    // Clear of the back button above and the Next strip below, more so on a phone.
    const outerY = Math.max(hub + 70 * s, h / 2 - big - (narrow ? 96 : 64))
    const frac = (k) => (rings === 1 ? 1 : 0.62 + (0.38 * k) / (rings - 1))
    const radii = Array.from({ length: rings }, (_, k) => ({ x: outerX * frac(k), y: outerY * frac(k) }))
    const planets = children.map((c, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * 2 * Math.PI
      // The first planet, at the top, is on the outer ring, so the inner rings
      // sit between the outer ones rather than straight above or below the hub.
      const ring = rings === 1 ? 0 : rings - 1 - (i % rings)
      const R = radii[ring]
      const x = cx + R.x * Math.cos(a)
      const y = cy + R.y * Math.sin(a)
      const r = sizeOf(c)
      // The name, outward from the hub: beside the planet at the left and
      // right, above it at the top and below it at the bottom.
      const out = { x: Math.cos(a), y: Math.sin(a) }
      // Inner rings have no room above or below (the outer ring is there), so their names go to the side.
      const side = !narrow && (Math.abs(out.x) > 0.35 || ring < rings - 1)
      if (side && Math.abs(out.x) < 0.05) out.x = 0.05
      const short = c.code || String(c.title).match(/^[A-Z0-9][\w.]{0,5}(?=[.\s])/)?.[0]
      const [l1, l2] = compact && short ? [short, null] : lines(c.title, Math.round(labelW / 6.6))
      const lh = (l2 ? 32 : 16) + 15
      const gap = r + 8
      // A full planet's width clear of its own planet, whatever the angle.
      const lx = side ? (out.x > 0 ? x + gap : x - gap - labelW) : x - labelW / 2
      const ly = side ? y - lh / 2 : out.y < 0 ? y - gap - lh : y + gap
      return { node: c, x, y, r, a, i, out, side, l1, l2, lx, ly, lw: labelW, lh, compact }
    })

    // Names that land on another name or planet are nudged up or down until
    // they are clear, staying inside the canvas.
    const hit = (A, B) => A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h
    for (let pass = 0; pass < 60; pass++) {
      let moved = false
      for (const P of planets) {
        const L = { x: P.lx, y: P.ly, w: P.lw, h: P.lh }
        for (const Q of planets) {
          // Every planet, its own included; every other name.
          const disc = { x: Q.x - Q.r - 3, y: Q.y - Q.r - 3, w: 2 * Q.r + 6, h: 2 * Q.r + 6 }
          for (const O of Q === P ? [disc] : [{ x: Q.lx, y: Q.ly, w: Q.lw, h: Q.lh }, disc]) {
            if (!hit(L, O)) continue
            const up = L.y + L.h / 2 < O.y + O.h / 2
            P.ly += up ? -3 : 3
            L.y = P.ly
            moved = true
          }
        }
        P.ly = clamp(P.ly, 4, h - P.lh - 4)
      }
      if (!moved) break
    }
    return { cx, cy, hub, radii, planets, s, labelW }
  }, [size, children])

  const needsWork = (n) => (n.kind === 'subtopic' ? ['in_progress', 'decaying'].includes(n.status) : (n.tally?.weak || 0) + (n.tally?.fading || 0) > 0)
  const t = focus.tally || { total: 0, proved: 0, assessed: 0 }
  const proved = t.total ? t.proved / t.total : 0
  const tested = t.total ? t.assessed / t.total : 0
  const isRoot = focusId === graph.rootId
  const selected = layout?.planets.find((p) => p.node.id === selectedId)

  return (
    <div
      ref={box}
      className="orbit relative h-full w-full select-none overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target.dataset?.bg) onBackground?.()
      }}
    >
      <style>{`
        .orbit-planet { animation: orbit-in 700ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-hub { animation: orbit-hub 600ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-ring { transform-origin: center; transform-box: fill-box; animation: orbit-drift 140s linear infinite; }
        .orbit-ring:nth-of-type(2n) { animation-direction: reverse; animation-duration: 190s; }
        @keyframes orbit-in { from { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.25); } to { opacity: 1; transform: none; } }
        @keyframes orbit-hub { from { opacity: 0; transform: scale(.8); } to { opacity: 1; transform: none; } }
        @keyframes orbit-drift { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .orbit-planet, .orbit-hub, .orbit-ring { animation: none; } }
        .orbit-dot { transition: transform 220ms cubic-bezier(.16,1,.3,1), box-shadow 220ms; }
        .orbit-dot:hover { transform: scale(1.09); }
      `}</style>

      {layout && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="orbit-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.16" />
              <stop offset="60%" stopColor="var(--brand)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx={layout.cx} cy={layout.cy} rx={layout.radii.at(-1).x + 40 * layout.s} ry={layout.radii.at(-1).y + 40 * layout.s} fill="url(#orbit-glow)" />
          {layout.radii.map((R, k) => (
            <ellipse key={k} className="orbit-ring" cx={layout.cx} cy={layout.cy} rx={R.x} ry={R.y} fill="none" stroke="var(--border-strong)" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="1 7" strokeLinecap="round" />
          ))}
          {/* A thread from the hub to what is selected. */}
          {selected && (
            <line
              x1={layout.cx}
              y1={layout.cy}
              x2={selected.x}
              y2={selected.y}
              stroke={STATUS_VAR[selected.node.status] || 'var(--brand)'}
              strokeOpacity="0.55"
              strokeWidth="1.5"
              strokeDasharray="3 5"
            />
          )}
          {/* The hub's ring: tested, then proved, on top. */}
          <circle cx={layout.cx} cy={layout.cy} r={layout.hub + 7} fill="none" stroke="var(--border)" strokeWidth="4" />
          {tested > 0 && <path d={arc(layout.cx, layout.cy, layout.hub + 7, tested)} fill="none" stroke="var(--status-developing)" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />}
          {proved > 0 && <path d={arc(layout.cx, layout.cy, layout.hub + 7, proved)} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" />}
        </svg>
      )}

      {layout && (
        <>
          {/* Hub */}
          <button
            key={`hub-${focusId}`}
            type="button"
            onClick={() => (isRoot ? onSelect?.(null) : onUp?.())}
            title={isRoot ? focus.title : 'Back up a level'}
            className="orbit-hub absolute flex flex-col items-center justify-center rounded-full border text-center shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)] transition-colors hover:border-[var(--brand)]"
            style={{ left: layout.cx - layout.hub, top: layout.cy - layout.hub, width: layout.hub * 2, height: layout.hub * 2, background: 'var(--surface)', borderColor: 'var(--border-strong)', padding: layout.hub * 0.18 }}
          >
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              {isRoot ? 'Subject' : focus.kind === 'unit' ? 'Unit' : 'Topic'}
            </span>
            <span className="mt-1 line-clamp-3 font-semibold leading-tight tracking-[-0.01em]" style={{ fontSize: clamp(layout.hub / 6.2, 10.5, 15), color: 'var(--text)' }}>
              {focus.title}
            </span>
            <span className="mt-1 text-[10.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {t.proved}/{t.total} proved
            </span>
            {!isRoot && (
              <span className="mt-0.5 text-[10px] font-semibold" style={{ color: 'var(--brand)' }}>
                ↑ Back
              </span>
            )}
          </button>

          {/* Planets */}
          {layout.planets.map((p) => {
            const n = p.node
            const color = STATUS_VAR[n.status] || STATUS_VAR.not_started
            const sel = n.id === selectedId
            const dim = weakOnly && !needsWork(n)
            const leaf = n.kind === 'subtopic'
            const { out, side, l1, l2, lx, ly } = p
            const labelW = p.lw
            return (
              <div
                key={`${focusId}-${n.id}`}
                className="orbit-planet absolute left-0 top-0"
                style={{ '--dx': `${layout.cx - p.x}px`, '--dy': `${layout.cy - p.y}px`, animationDelay: `${Math.min(p.i, 24) * 28}ms`, opacity: dim ? 0.28 : 1, transition: 'opacity 300ms' }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect?.(sel ? null : n.id)
                  }}
                  onDoubleClick={() => !leaf && onEnter?.(n.id)}
                  aria-label={`${n.title}: ${statusLabel(n.status)}${n.score != null ? `, ${n.score}%` : ''}`}
                  aria-pressed={sel}
                  className="orbit-dot absolute flex items-center justify-center rounded-full"
                  style={{
                    left: p.x - p.r,
                    top: p.y - p.r,
                    width: p.r * 2,
                    height: p.r * 2,
                    background: leaf ? color : `color-mix(in oklab, ${color} 22%, var(--surface))`,
                    border: `1.5px solid ${color}`,
                    boxShadow: sel ? `0 0 0 4px var(--bg), 0 0 0 6px ${color}, 0 0 28px 4px color-mix(in oklab, ${color} 45%, transparent)` : `0 6px 20px -8px color-mix(in oklab, ${color} 70%, transparent)`,
                  }}
                >
                  {!leaf && (
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                      {n.tally?.total}
                    </span>
                  )}
                  {/* Score as a thin arc round the planet. */}
                  {n.score != null && !leaf && (
                    <svg className="pointer-events-none absolute" style={{ inset: -6 }} width={p.r * 2 + 12} height={p.r * 2 + 12} aria-hidden="true">
                      <path d={arc(p.r + 6, p.r + 6, p.r + 4, n.score / 100)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect?.(sel ? null : n.id)
                  }}
                  onDoubleClick={() => !leaf && onEnter?.(n.id)}
                  className="absolute leading-tight"
                  style={{ left: lx, top: ly, width: labelW, textAlign: side ? (out.x > 0 ? 'left' : 'right') : 'center' }}
                >
                  <span className="block text-[12px] tracking-[-0.005em]" style={{ color: sel ? 'var(--text)' : 'var(--text-body)', fontWeight: sel ? 650 : 500 }}>
                    {l1}
                  </span>
                  {l2 && (
                    <span className="block text-[12px]" style={{ color: sel ? 'var(--text)' : 'var(--text-body)', fontWeight: sel ? 650 : 500 }}>
                      {l2}
                    </span>
                  )}
                  <span className="mt-0.5 block text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                    {p.compact ? (n.score != null ? `${n.score}%` : statusLabel(n.status)) : `${n.score != null ? `${n.score}% · ` : ''}${statusLabel(n.status)}`}
                  </span>
                </button>
              </div>
            )
          })}
        </>
      )}

      {/* Legend */}
      <div data-ui className="pointer-events-none absolute right-4 top-4 hidden max-w-[16rem] flex-wrap justify-end gap-x-3 gap-y-1 text-[10.5px] sm:flex" style={{ color: 'var(--text-faint)' }}>
        {['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started'].map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_VAR[s] }} />
            {statusLabel(s)}
          </span>
        ))}
      </div>
      {controls}
    </div>
  )
}
