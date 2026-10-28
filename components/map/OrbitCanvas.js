'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_VAR } from '@/components/map/MapCanvas'
import { statusLabel } from '@/lib/subject-graph'

/**
 * The subject map as an orbit, drawn like the Syllabi hub it started from.
 *
 *   Hub        the level you are on (the subject, a topic or a unit), a green
 *              disc that breathes, with a pulse going out from it. Click it to
 *              go back up.
 *   Rings      a solid outer orbit, dashed ones inside it.
 *   Planets    what the level holds: small round tokens with their code in
 *              them, in syllabus order clockwise from the top, circling
 *              slowly. The edge is where you stand (untested is plain); the
 *              one selected is filled. Pointing at any of them stops the whole
 *              system so nothing moves out from under the pointer. Click to
 *              read about it, double-click to fly into it.
 *
 * Names sit under the planets when there are few enough to read; with more,
 * the code is enough and the name is on hover and in the panel. With reduced
 * motion nothing turns.
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

/** Two letters for a title with no code: "Cell biology" is CB. */
const initialsOf = (title) => {
  const words = String(title).split(/[\s:&,-]+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(and|of|the|in|to|for)$/i.test(w))
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase()
}

/** What goes inside a planet: "A. Unity and diversity" is A, "Unit 2 - Micro" is 2, a unit's own code as it is. */
const codeOf = (node) => {
  const title = String(node.title)
  return (
    node.code ||
    title.match(/^(?:Theme|Topic|Unit|Part|Option|Paper)\s+([A-Z0-9]{1,3})\b/i)?.[1] ||
    title.match(/^([A-Z]?\d+(?:\.\d+)*|[A-Z])(?=[.:)\s])/)?.[1] ||
    initialsOf(title)
  )
}

/** A status colour, softened towards grey so no planet shouts. */
const tone = (status) =>
  !status || status === 'not_started' ? 'color-mix(in oklab, var(--text-faint) 55%, var(--surface))' : `color-mix(in oklab, ${STATUS_VAR[status]} 62%, var(--text-faint))`

export default function OrbitCanvas({ graph, focusId, selectedId, weakOnly = false, onSelect, onEnter, onUp, onBackground, upFromRoot = false, controls = null }) {
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
    const hub = clamp(side * 0.1, 44, 72)
    const n = children.length
    const rings = n <= 10 ? 1 : n <= 22 ? 2 : 3
    const narrow = w < 520
    // A token big enough for its code: smaller when there are many.
    const r = clamp((n > 22 ? 15 : n > 10 ? 17 : 21) * s, 13, 24)
    // Names only while they can be read without colliding as the ring turns.
    const named = !narrow ? n <= 12 : n <= 6
    const labelW = narrow ? 92 : clamp(w * 0.16, 96, 140)
    const R = Math.max(hub + 56 * s, Math.min(w / 2 - (named ? labelW / 2 : r) - 12, h / 2 - r - (named ? 40 : 14) - (narrow ? 60 : 44)))
    const radii = Array.from({ length: rings }, (_, k) => (rings === 1 ? R : R * (0.6 + (0.4 * k) / (rings - 1))))
    const planets = children.map((c, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * 2 * Math.PI
      const ring = rings === 1 ? 0 : rings - 1 - (i % rings)
      const x = cx + radii[ring] * Math.cos(a)
      const y = cy + radii[ring] * Math.sin(a)
      const code = codeOf(c)
      const [l1, l2] = lines(c.title, Math.round(labelW / 6.4))
      return { node: c, x, y, r, a, i, code, l1, l2 }
    })
    return { cx, cy, hub, radii, planets, s, named, labelW }
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
        .orbit-spin { animation: orbit-turn 120s linear infinite; }
        .orbit-upright { animation: orbit-turn 120s linear infinite reverse; }
        .orbit:has(.orbit-dot:hover) .orbit-spin, .orbit:has(.orbit-dot:hover) .orbit-upright,
        .orbit:has(.orbit-dot:focus-visible) .orbit-spin, .orbit:has(.orbit-dot:focus-visible) .orbit-upright { animation-play-state: paused; }
        .orbit-planet { animation: orbit-in 800ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-hub { animation: orbit-hub 700ms cubic-bezier(.16,1,.3,1) both; }
        .orbit-pulse { animation: orbit-pulse 2.8s cubic-bezier(0,0,.2,1) infinite; }
        @keyframes orbit-turn { to { transform: rotate(360deg); } }
        @keyframes orbit-in { from { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.3); } to { opacity: 1; transform: none; } }
        @keyframes orbit-hub { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
        @keyframes orbit-pulse { 0% { transform: scale(1); opacity: .9; } 75%, 100% { transform: scale(1.45); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .orbit-spin, .orbit-upright, .orbit-planet, .orbit-hub, .orbit-pulse { animation: none; } }
        .orbit-dot { transition: transform 220ms cubic-bezier(.16,1,.3,1), background-color 200ms, color 200ms; }
        .orbit-dot:hover, .orbit-dot:focus-visible { transform: scale(1.12); }
      `}</style>

      {layout && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {layout.radii.map((R, k) => (
            <circle
              key={k}
              cx={layout.cx}
              cy={layout.cy}
              r={R}
              fill="none"
              stroke={k === layout.radii.length - 1 ? 'var(--border-strong)' : 'var(--border)'}
              strokeWidth="1"
              strokeDasharray={k === layout.radii.length - 1 ? undefined : '4 5'}
            />
          ))}
          {/* An inner dashed ring close round the hub, as on the Syllabi hub. */}
          <circle cx={layout.cx} cy={layout.cy} r={layout.hub + 22 * layout.s} fill="none" stroke="var(--border)" strokeDasharray="4 5" />
          {/* How much of this level is proved, as a thin arc. */}
          {proved > 0 && <path d={arc(layout.cx, layout.cy, layout.hub + 22 * layout.s, proved)} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      )}

      {layout && (
        <>
          {/* Everything that circles: one layer turning about the hub. */}
          <div className="orbit-spin pointer-events-none absolute inset-0" style={{ transformOrigin: `${layout.cx}px ${layout.cy}px` }}>
            {layout.planets.map((p) => {
              const n = p.node
              const c = tone(n.status)
              const sel = n.id === selectedId
              const dim = weakOnly && !needsWork(n)
              const leaf = n.kind === 'subtopic'
              const untested = !n.status || n.status === 'not_started'
              const pick = (e) => {
                e.stopPropagation()
                onSelect?.(sel ? null : n.id)
              }
              return (
                <div key={`${focusId}-${n.id}`} className="absolute h-0 w-0" style={{ left: p.x, top: p.y }}>
                  {/* Upright: turns back the other way, so codes and names stay level. */}
                  <div className="orbit-upright absolute left-0 top-0 h-0 w-0" style={{ transformOrigin: '0 0' }}>
                    <div
                      className="orbit-planet pointer-events-auto absolute left-0 top-0 h-0 w-0"
                      style={{ '--dx': `${layout.cx - p.x}px`, '--dy': `${layout.cy - p.y}px`, animationDelay: `${Math.min(p.i, 24) * 30}ms`, opacity: dim ? 0.25 : 1, transition: 'opacity 300ms' }}
                    >
                      <button
                        type="button"
                        onClick={pick}
                        onDoubleClick={() => !leaf && onEnter?.(n.id)}
                        aria-label={`${n.title}: ${statusLabel(n.status)}${n.score != null ? `, ${n.score}%` : ''}`}
                        aria-pressed={sel}
                        title={`${n.title} · ${statusLabel(n.status)}${n.score != null ? ` · ${n.score}%` : ''}${leaf ? '' : ` · ${n.tally?.total} subtopics`}`}
                        className="orbit-dot absolute flex items-center justify-center rounded-full font-semibold"
                        style={{
                          left: -p.r,
                          top: -p.r,
                          width: p.r * 2,
                          height: p.r * 2,
                          fontSize: clamp(p.r * 0.5, 8.5, 11),
                          background: sel ? 'var(--text)' : 'var(--surface)',
                          color: sel ? 'var(--bg)' : 'var(--text-muted)',
                          border: `${untested ? 1 : 2}px solid ${sel ? 'var(--text)' : untested ? 'var(--border-strong)' : c}`,
                        }}
                      >
                        <span className="max-w-full truncate px-0.5">{p.code}</span>
                      </button>
                      {(layout.named || sel) && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={pick}
                          onDoubleClick={() => !leaf && onEnter?.(n.id)}
                          className="absolute text-center leading-[15px]"
                          style={{ left: -layout.labelW / 2, top: p.r + 6, width: layout.labelW }}
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
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* The hub, breathing, with a pulse going out from it. */}
          <div key={`hub-${focusId}`} className="orbit-hub absolute" style={{ left: layout.cx - layout.hub, top: layout.cy - layout.hub, width: layout.hub * 2, height: layout.hub * 2 }}>
            <span aria-hidden="true" className="orbit-pulse absolute inset-0 rounded-full" style={{ border: '1px solid color-mix(in srgb, var(--brand) 45%, transparent)' }} />
            <button
              type="button"
              onClick={() => (isRoot && !upFromRoot ? onSelect?.(null) : onUp?.())}
              title={isRoot && !upFromRoot ? focus.title : isRoot ? 'Back to you' : 'Back up a level'}
              className="relative flex h-full w-full flex-col items-center justify-center rounded-full text-center transition-[filter] hover:brightness-110"
              style={{ padding: layout.hub * 0.2, background: 'var(--brand)', color: '#fff', boxShadow: '0 0 40px color-mix(in srgb, var(--brand) 45%, transparent)' }}
            >
              <span className={`font-semibold leading-tight tracking-[-0.01em] ${layout.hub >= 64 ? 'line-clamp-3' : 'line-clamp-2'}`} style={{ fontSize: clamp(layout.hub / 6, 10.5, 14.5) }}>
                {focus.title}
              </span>
              <span className="mt-1 text-[10px] tabular-nums" style={{ opacity: 0.8 }}>
                {layout.hub >= 64 ? `${t.proved} of ${t.total} proved` : `${t.proved}/${t.total}`}
              </span>
              {(!isRoot || upFromRoot) && layout.hub >= 64 && (
                <span className="mt-0.5 text-[10px] font-semibold" style={{ opacity: 0.9 }}>
                  ↑ {isRoot ? 'You' : 'Back'}
                </span>
              )}
            </button>
          </div>
        </>
      )}

      {/* Legend, quiet, out of the way. */}
      <div data-ui className="pointer-events-none absolute right-4 top-4 hidden max-w-[15rem] flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] sm:flex" style={{ color: 'var(--text-faint)' }}>
        {['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started'].map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className="h-[8px] w-[8px] rounded-full" style={{ border: `2px solid ${st === 'not_started' ? 'var(--border-strong)' : tone(st)}` }} />
            {statusLabel(st)}
          </span>
        ))}
      </div>
      {controls}
    </div>
  )
}
