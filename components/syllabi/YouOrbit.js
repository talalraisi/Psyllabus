'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { tone, stars } from '@/components/map/OrbitCanvas'
import { statusLabel } from '@/lib/subject-graph'
import { shortName, subjectCode } from '@/lib/subject-short'

/**
 * You, mapped: the start of a Syllabi chat, drawn the way the subject map is.
 *
 *   Sun       you, with a thin ring of how much of all your subjects is proved
 *   Planets   your subjects on one true circle, clockwise from the top. Size
 *             is how much is in the subject; the flat tint is where you stand
 *             in it, quiet like the map's (untested is grey). The one the chat
 *             is about wears a ring. Tap another to talk about that instead.
 *
 * Planets float a few pixels and never revolve, so nothing moves out from
 * under a finger; a moon goes slowly round the orbit and stars glint behind.
 * With reduced motion nothing moves.
 *
 * standing: { [subject]: { status, proved, total } }, or nothing while it loads.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function arc(cx, cy, r, frac) {
  const f = clamp(frac, 0, 0.9999)
  const a = -Math.PI / 2 + f * 2 * Math.PI
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
}

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'You'

export default function YouOrbit({ subjects, subject, standing = {}, you = '', onPick, compact = false }) {
  const box = useRef(null)
  const [w, setW] = useState(0)
  const h = compact ? 230 : 300

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = useMemo(() => {
    if (!w) return null
    const list = subjects.slice(0, 12)
    const n = list.length
    const cx = w / 2
    const cy = h / 2
    const narrow = w < 440 || compact
    const hub = narrow ? 34 : 42
    const most = Math.max(1, ...list.map((s) => standing[s]?.total || 1))
    const sizeOf = (s) => (narrow ? 9 : 11) + (narrow ? 7 : 9) * Math.sqrt((standing[s]?.total || most * 0.6) / most)
    const big = Math.max(...list.map(sizeOf), 12)
    const labelW = narrow ? 80 : 104
    // As large as fits with a name under the lowest planet.
    const R = Math.max(hub + 40, Math.min(w / 2 - labelW / 2 - 6, h / 2 - big - 22))
    const planets = list.map((s, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, n)) * 2 * Math.PI
      const x = cx + R * Math.cos(a)
      const y = cy + R * Math.sin(a)
      const r = sizeOf(s)
      // Under the planet, except along the top where under is the sun.
      const above = Math.sin(a) < -0.75
      return { s, i, x, y, r, label: narrow ? (n > 6 ? subjectCode(s) : shortName(s)) : shortName(s), lx: x - labelW / 2, ly: above ? y - r - 21 : y + r + 6, lw: labelW }
    })
    return { cx, cy, hub, R, planets, sky: stars(w, h, Math.round((w * h) / 4200)) }
  }, [w, h, subjects, standing, compact])

  const all = Object.values(standing).reduce((a, x) => ({ proved: a.proved + (x.proved || 0), total: a.total + (x.total || 0) }), { proved: 0, total: 0 })
  const proved = all.total ? all.proved / all.total : 0

  return (
    <div ref={box} className="relative w-full select-none" style={{ height: h }}>
      <style>{`
        .you-planet { animation: you-in 800ms cubic-bezier(.16,1,.3,1) both; }
        .you-float { animation: you-float 8s ease-in-out infinite; }
        .you-moon { transform-box: view-box; animation: you-turn 80s linear infinite; }
        .you-star { animation: you-glint 5s ease-in-out infinite; }
        .you-glow { transform-box: fill-box; transform-origin: center; animation: you-breathe 7s ease-in-out infinite; }
        @keyframes you-in { from { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.3); } to { opacity: 1; transform: none; } }
        @keyframes you-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes you-turn { to { transform: rotate(360deg); } }
        @keyframes you-glint { 0%, 100% { opacity: .15; } 50% { opacity: .7; } }
        @keyframes you-breathe { 0%, 100% { opacity: .85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @media (prefers-reduced-motion: reduce) { .you-planet, .you-float, .you-moon, .you-star, .you-glow { animation: none; } }
        .you-dot { transition: transform 260ms cubic-bezier(.16,1,.3,1), box-shadow 260ms; }
        .you-dot:hover, .you-dot:focus-visible { transform: scale(1.12); }
      `}</style>

      {layout && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="you-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.24" />
              <stop offset="45%" stopColor="var(--brand)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {layout.sky.map((st, i) => (
            <circle key={i} className={st.twinkle ? 'you-star' : undefined} cx={st.x} cy={st.y} r={st.r} fill="var(--text-faint)" opacity={st.o} style={st.twinkle ? { animationDelay: `${-i * 0.7}s` } : undefined} />
          ))}
          <circle className="you-glow" cx={layout.cx} cy={layout.cy} r={layout.hub * 3} fill="url(#you-sun)" />
          <circle cx={layout.cx} cy={layout.cy} r={layout.R} fill="none" stroke="var(--text-faint)" strokeOpacity="0.22" />
          <g className="you-moon" style={{ transformOrigin: `${layout.cx}px ${layout.cy}px` }}>
            <circle cx={layout.cx + layout.R} cy={layout.cy} r={2.2} fill="var(--text-muted)" opacity="0.7" />
          </g>
          <circle cx={layout.cx} cy={layout.cy} r={layout.hub + 6} fill="none" stroke="var(--border)" strokeWidth="2" />
          {proved > 0 && <path d={arc(layout.cx, layout.cy, layout.hub + 6, proved)} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />}
        </svg>
      )}

      {layout && (
        <>
          <div
            className="absolute flex flex-col items-center justify-center rounded-full text-center"
            title={all.total ? `${all.proved} of ${all.total} subtopics proved across your subjects` : undefined}
            style={{
              left: layout.cx - layout.hub,
              top: layout.cy - layout.hub,
              width: layout.hub * 2,
              height: layout.hub * 2,
              background: 'color-mix(in oklab, var(--brand) 10%, var(--surface))',
              border: '1px solid color-mix(in oklab, var(--brand) 32%, var(--border))',
            }}
          >
            <span className="font-semibold leading-none tracking-[-0.02em]" style={{ fontSize: layout.hub * 0.48, color: 'var(--text)' }}>
              {initials(you)}
            </span>
            <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-faint)' }}>
              You
            </span>
          </div>

          {layout.planets.map((p) => {
            const st = standing[p.s]
            const c = tone(st?.status)
            const on = p.s === subject
            return (
              <div key={p.s} className="you-planet absolute left-0 top-0" style={{ '--dx': `${layout.cx - p.x}px`, '--dy': `${layout.cy - p.y}px`, animationDelay: `${p.i * 40}ms` }}>
                <div className="you-float" style={{ animationDelay: `${-p.i * 1.3}s`, animationDuration: `${7 + (p.i % 4)}s` }}>
                  <button
                    type="button"
                    onClick={() => onPick(p.s)}
                    aria-label={`Talk about ${p.s}${st ? `: ${statusLabel(st.status)}, ${st.proved} of ${st.total} proved` : ''}`}
                    aria-pressed={on}
                    title={`${p.s}${st ? ` · ${st.proved} of ${st.total} proved` : ''}`}
                    className="you-dot absolute rounded-full"
                    style={{
                      left: p.x - p.r,
                      top: p.y - p.r,
                      width: p.r * 2,
                      height: p.r * 2,
                      background: c,
                      border: `1px solid color-mix(in oklab, ${c} 70%, var(--text))`,
                      boxShadow: on ? `0 0 0 3px var(--bg), 0 0 0 4.5px ${c}, 0 0 24px 4px color-mix(in oklab, ${c} 35%, transparent)` : 'none',
                    }}
                  />
                  <button type="button" tabIndex={-1} onClick={() => onPick(p.s)} className="absolute truncate text-center text-[11.5px] leading-[15px]" style={{ left: p.lx, top: p.ly, width: p.lw, color: on ? 'var(--text)' : 'var(--text-muted)', fontWeight: on ? 600 : 450 }}>
                    {p.label}
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
