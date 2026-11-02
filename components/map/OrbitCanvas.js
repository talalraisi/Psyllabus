'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_VAR } from '@/components/map/MapCanvas'
import { statusLabel } from '@/lib/subject-graph'

/**
 * The subject map as a constellation: where you are is the bright centre,
 * and what it holds are stars around it, each joined to the centre by a fine
 * line. Nothing moves: the map is something to read, and a star never slides
 * out from under the pointer.
 *
 *   Centre   the level you are on (you, a subject, a topic or a unit), with
 *            a thin arc of how much of it is proved. Click it to go back up.
 *   Stars    what it holds, in syllabus order clockwise from the top. The more
 *            of it you have proved, the bigger and brighter the star; one
 *            nobody has tested is a faint outline. Every star is named.
 *            Click to read about it, double-click to go into it.
 *
 * Flat, never glowing, but alive: the lines draw out from the centre and the
 * stars appear along them when a level opens, the proved arc draws itself
 * round, each star drifts a few pixels on its own rhythm, the centre
 * breathes, the sky moves very slowly, a selection springs in. With reduced
 * motion all of it is simply there, still.
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
export const tone = (status) =>
  !status || status === 'not_started' ? 'color-mix(in oklab, var(--text-faint) 55%, var(--surface))' : `color-mix(in oklab, ${STATUS_VAR[status]} 62%, var(--text-faint))`

/** How much of a node is known, 0 to 1: proved counts fully, tested a little. */
const STATUS_KNOWN = { not_started: 0, in_progress: 0.25, decaying: 0.35, confident: 0.55, proficient: 0.8, mastered: 1 }
export function knownOf(n) {
  if (n.kind === 'subtopic') return STATUS_KNOWN[n.status] ?? 0
  const t = n.tally
  if (!t?.total) return 0
  return Math.min(1, (t.proved + 0.35 * Math.max(0, t.assessed - t.proved)) / t.total)
}

/** The same few dozen background stars every time for a given size. */
function sky(w, h, count) {
  let seed = Math.round(w * 7 + h * 13) || 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  return Array.from({ length: count }, () => ({ x: rand() * w, y: rand() * h, r: 0.5 + rand() * 1, o: 0.1 + rand() * 0.25 }))
}

/**
 * insets: room kept clear at the top and bottom for what floats over the
 * canvas (the back button, the Next strip), so no star sits under them.
 * legend: the key to brightness, top right; off where there is no room.
 */
export default function OrbitCanvas({ graph, focusId, selectedId, weakOnly = false, onSelect, onEnter, onUp, onBackground, upFromRoot = false, controls = null, insets = {}, legend = true }) {
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
    const top = insets.top ?? 28
    const bottom = insets.bottom ?? 28
    const side = Math.min(w, h - top - bottom)
    const s = clamp(side / 720, 0.6, 1.1)
    const cx = w / 2
    const cy = top + (h - top - bottom) / 2
    const hub = clamp(side * 0.1, 40, 62)
    const n = children.length
    const narrow = w < 520
    const labelW = narrow ? 88 : clamp(w * 0.15, 96, 150)
    // One circle of stars for a few, two alternating for many, so names have room.
    const twoRings = n > 10
    // As large as fits with names at the top and bottom, and no larger: on a
    // big screen a sprawling map reads as empty, not as more room.
    const R = Math.max(hub + 56, Math.min(w / 2 - labelW / 2 - 8, (h - top - bottom) / 2 - 40, 250 * s))
    const planets = children.map((c, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * 2 * Math.PI
      const rr = twoRings && i % 2 ? R * 0.68 : R
      const x = cx + rr * Math.cos(a)
      const y = cy + rr * Math.sin(a)
      const k = knownOf(c)
      // A star is never smaller than a fingertip can find; knowing it makes it grow.
      const r = clamp((narrow ? 7 : 8) + k * (narrow ? 9 : 13) * Math.max(s, 0.85), 7, 24)
      const [l1, l2] = lines(c.title, Math.round(labelW / 6.4))
      // The name sits outward from the centre, so it never crosses a line.
      const below = Math.sin(a) > -0.25
      return { node: c, x, y, r, a, i, k, l1, l2, below }
    })
    return { cx, cy, hub, R, planets, s, labelW, stars: sky(w, h, Math.round((w * h) / 5200)) }
  }, [size, children, insets.top, insets.bottom])

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
        .orbit-hub { animation: orbit-hub 700ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-planet { animation: orbit-in 700ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-line { animation: orbit-draw 900ms cubic-bezier(.16,1,.3,1) both; }
        @keyframes orbit-hub { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
        @keyframes orbit-in { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
        @keyframes orbit-draw { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
        .orbit-float { animation: orbit-float 7s ease-in-out infinite; }
        .orbit-sel { transform-box: fill-box; transform-origin: center; animation: orbit-sel 420ms cubic-bezier(.34,1.56,.64,1) both; }
        .orbit-arc { stroke-dasharray: 1; animation: orbit-arc 1.4s cubic-bezier(.16,1,.3,1) 250ms both; }
        .orbit-breathe { animation: orbit-breathe 6s ease-in-out infinite; }
        .orbit-sky { animation: orbit-sky 70s ease-in-out infinite alternate; }
        @keyframes orbit-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes orbit-sel { from { opacity: 0; transform: scale(.5); } to { opacity: 1; transform: none; } }
        @keyframes orbit-arc { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes orbit-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
        @keyframes orbit-sky { from { transform: translate(0, 0); } to { transform: translate(-18px, 10px); } }
        @media (prefers-reduced-motion: reduce) { .orbit-hub, .orbit-planet, .orbit-line, .orbit-float, .orbit-sel, .orbit-arc, .orbit-breathe, .orbit-sky { animation: none; } }
        .orbit-dot { transition: transform 200ms cubic-bezier(.16,1,.3,1); transform-box: fill-box; transform-origin: center; }
        .orbit-hit:hover .orbit-dot, .orbit-hit:focus-visible .orbit-dot { transform: scale(1.18); }
      `}</style>

      {layout && (
        <svg className="absolute inset-0 h-full w-full" aria-hidden="false" role="group" aria-label={`${focus.title} and what it holds`}>
          <g className="orbit-sky">
            {layout.stars.map((st, i) => (
              <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="var(--text-faint)" opacity={st.o} data-bg />
            ))}
          </g>
          {layout.planets.map((p) => {
            const len = Math.hypot(p.x - layout.cx, p.y - layout.cy)
            const sel = p.node.id === selectedId
            return (
              <line
                key={`l-${focusId}-${p.node.id}`}
                className="orbit-line"
                x1={layout.cx}
                y1={layout.cy}
                x2={p.x}
                y2={p.y}
                stroke={sel ? 'var(--brand)' : 'var(--border-strong)'}
                strokeWidth={sel ? 1.4 : 0.8}
                strokeDasharray={len}
                style={{ '--len': len, animationDelay: `${Math.min(p.i, 24) * 25}ms` }}
              />
            )
          })}
          {layout.planets.map((p) => {
            const n = p.node
            const sel = n.id === selectedId
            const dim = weakOnly && !needsWork(n)
            const leaf = n.kind === 'subtopic'
            const untested = p.k === 0
            const pick = (e) => {
              e.stopPropagation()
              onSelect?.(sel ? null : n.id)
            }
            const ly = p.below ? p.y + p.r + 15 : p.y - p.r - (p.l2 ? 22 : 8)
            return (
              <g
                key={`${focusId}-${n.id}`}
                className="orbit-hit orbit-planet cursor-pointer"
                style={{ transformOrigin: `${p.x}px ${p.y}px`, animationDelay: `${Math.min(p.i, 24) * 25 + 150}ms`, opacity: dim ? 0.25 : 1, transition: 'opacity 300ms' }}
                role="button"
                tabIndex={0}
                aria-pressed={sel}
                aria-label={`${n.title}: ${statusLabel(n.status)}${n.score != null ? `, ${n.score}%` : ''}`}
                onClick={pick}
                onDoubleClick={() => !leaf && onEnter?.(n.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (leaf ? pick(e) : onEnter?.(n.id))
                  if (e.key === ' ') pick(e)
                }}
              >
                <title>{`${n.title} · ${statusLabel(n.status)}${n.score != null ? ` · ${n.score}%` : ''}${leaf ? '' : ` · ${n.tally?.proved || 0} of ${n.tally?.total} proved`}`}</title>
                <g className="orbit-float" style={{ animationDelay: `${-p.i * 1.1}s`, animationDuration: `${6 + (p.i % 4)}s` }}>
                {sel && <circle className="orbit-sel" cx={p.x} cy={p.y} r={p.r + 6} fill="none" stroke="var(--brand)" strokeWidth="1.5" />}
                <circle
                  className="orbit-dot"
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  fill={untested ? 'var(--bg)' : 'var(--brand)'}
                  fillOpacity={untested ? 1 : 0.35 + 0.65 * p.k}
                  stroke={untested ? 'var(--border-strong)' : 'var(--brand)'}
                  strokeWidth={untested ? 1.2 : 0}
                />
                <text x={p.x} y={ly} textAnchor="middle" fontSize="12" fill={sel ? 'var(--text)' : 'var(--text-muted)'} fontWeight={sel ? 600 : 450}>
                  <tspan x={p.x}>{p.l1}</tspan>
                  {p.l2 && (
                    <tspan x={p.x} dy="14">
                      {p.l2}
                    </tspan>
                  )}
                </text>
                </g>
              </g>
            )
          })}
          {/* How much of this level is proved, as a thin arc round the centre. */}
          <circle cx={layout.cx} cy={layout.cy} r={layout.hub + 8} fill="none" stroke="var(--border)" strokeWidth="2" />
          {proved > 0 && <path key={`arc-${focusId}`} className="orbit-arc" pathLength="1" d={arc(layout.cx, layout.cy, layout.hub + 8, proved)} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />}
        </svg>
      )}

      {layout && (
        <div key={`hub-${focusId}`} className="orbit-hub absolute" style={{ left: layout.cx - layout.hub, top: layout.cy - layout.hub, width: layout.hub * 2, height: layout.hub * 2 }}>
          <button
            type="button"
            onClick={() => (isRoot && !upFromRoot ? onSelect?.(null) : onUp?.())}
            title={isRoot && !upFromRoot ? focus.title : isRoot ? 'Back to you' : 'Back up a level'}
            className="orbit-breathe relative flex h-full w-full flex-col items-center justify-center rounded-full text-center transition-[filter] hover:brightness-110"
            style={{ padding: layout.hub * 0.2, background: 'var(--brand)', color: '#fff' }}
          >
            <span className={`font-semibold leading-tight tracking-[-0.01em] ${layout.hub >= 64 ? 'line-clamp-3' : 'line-clamp-2'}`} style={{ fontSize: clamp(layout.hub / 5.5, 11, 15) }}>
              {focus.title}
            </span>
            <span className="mt-1 text-[10.5px] tabular-nums" style={{ opacity: 0.85 }}>
              {layout.hub >= 56 ? `${Math.round(proved * 100)}% proved` : `${Math.round(proved * 100)}%`}
            </span>
            {(!isRoot || upFromRoot) && layout.hub >= 56 && (
              <span className="mt-0.5 text-[10px] font-semibold" style={{ opacity: 0.9 }}>
                ↑ {isRoot ? 'You' : 'Back'}
              </span>
            )}
          </button>
        </div>
      )}

      {/* What brightness means, quiet and out of the way. */}
      {legend && <div data-ui className="pointer-events-none absolute right-4 top-4 hidden items-center gap-3 text-[10.5px] sm:flex" style={{ color: 'var(--text-faint)' }}>
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-[9px] rounded-full border" style={{ borderColor: 'var(--border-strong)' }} />
          Untested
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[8px] w-[8px] rounded-full" style={{ background: 'var(--brand)', opacity: 0.45 }} />
          Started
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[11px] w-[11px] rounded-full" style={{ background: 'var(--brand)' }} />
          Proved
        </span>
      </div>}
      {controls}
    </div>
  )
}
