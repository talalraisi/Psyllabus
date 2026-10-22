'use client'

import { useId } from 'react'

/**
 * A free-body diagram drawn from the forces on a body.
 *
 * The question gives the surface (nothing, flat ground or a slope at an
 * angle), the body and each force as a direction and a relative size; this
 * draws them with arrowheads and labels placed clear of the arrows and the
 * surface. Forces that act at the surface (the normal reaction, friction)
 * can start there rather than at the centre. An angle the question depends on
 * is drawn as an arc with its value, and the direction of motion can be shown
 * under the body: a diagram that says "30°" in the text but not on the page
 * makes the student work out what the question already knows.
 *
 * Directions are anticlockwise from the positive x axis, as in maths: 0 is
 * right, 90 up, 270 down.
 */

const W = 480
const INK = 'var(--text)'
const ARROW = 'var(--brand)'
const MOTION = 'var(--heat-hot)'
const BG = 'var(--surface-sunken)'
const rad = (d) => (d * Math.PI) / 180
const norm360 = (d) => ((d % 360) + 360) % 360

/** The smallest signed turn from a to b, in degrees. */
function turn(a, b) {
  const d = norm360(b - a)
  return d > 180 ? d - 360 : d
}

export default function ForcesFigure({ figure }) {
  const id = useId().replace(/:/g, '')
  const incline = figure.surface === 'incline'
  const angle = incline ? Math.min(60, Math.max(10, Number(figure.angle_deg) || 30)) : 0
  const groundY = 280
  const half = figure.body === 'point' ? 0 : 22

  let surface = null
  let surfaceBox = null
  let cx = W / 2
  let cy = 170
  let contact = null
  // Directions along the surface, for angle arcs: flat ground is 0/180, a slope
  // falling to the right is -angle (down) and 180 - angle (up).
  let along = []

  if (incline) {
    const length = Math.min(380, 220 / Math.tan(rad(angle)))
    const x0 = W / 2 - length / 2
    const x1 = W / 2 + length / 2
    const top = groundY - length * Math.tan(rad(angle))
    surface = (
      <g>
        <polygon points={`${x0},${groundY} ${x1},${groundY} ${x0},${top}`} fill="color-mix(in oklab, var(--text) 5%, transparent)" stroke={INK} strokeWidth="2" />
        <path d={`M ${x1 - 46} ${groundY} A 46 46 0 0 1 ${x1 - 46 * Math.cos(rad(angle))} ${groundY - 46 * Math.sin(rad(angle))}`} fill="none" stroke={INK} strokeWidth="1.5" />
        <text x={x1 - 62} y={groundY - 8} fontSize="15" textAnchor="end" fill={INK}>
          {angle}°
        </text>
      </g>
    )
    surfaceBox = { x0, x1, y0: top, y1: groundY }
    const mx = W / 2
    const my = groundY - (length / 2) * Math.tan(rad(angle))
    contact = { x: mx, y: my }
    cx = mx + half * Math.sin(rad(angle))
    cy = my - half * Math.cos(rad(angle))
    along = [-angle, 180 - angle]
  } else if (figure.surface === 'horizontal') {
    surface = (
      <g>
        <line x1="70" y1={groundY} x2={W - 70} y2={groundY} stroke={INK} strokeWidth="2" />
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={84 + i * 24} y1={groundY} x2={74 + i * 24} y2={groundY + 10} stroke="var(--text-faint)" strokeWidth="1.2" />
        ))}
      </g>
    )
    surfaceBox = { x0: 70, x1: W - 70, y0: groundY, y1: groundY + 10 }
    contact = { x: W / 2, y: groundY }
    cx = W / 2
    cy = groundY - half
    along = [0, 180]
  }

  const body =
    figure.body === 'point' ? (
      <circle cx={cx} cy={cy} r="5" fill={INK} />
    ) : figure.body === 'ball' ? (
      <circle cx={cx} cy={cy} r={half} fill={BG} stroke={INK} strokeWidth="2" />
    ) : (
      <rect x={cx - 34} y={cy - half} width="68" height={half * 2} rx="4" fill={BG} stroke={INK} strokeWidth="2" transform={`rotate(${angle} ${cx} ${cy})`} />
    )

  const forces = (figure.forces || []).slice(0, 6).map((f) => {
    const dir = Number(f.direction_deg) || 0
    const length = 46 + 84 * Math.min(1, Math.max(0.3, Number(f.size) || 0.6))
    const dx = Math.cos(rad(dir))
    const dy = -Math.sin(rad(dir))
    const start = f.from === 'contact' && contact ? contact : { x: cx, y: cy }
    // The label sits past the arrowhead and off to the side facing up the page.
    let px = -dy
    let py = dx
    if (py > 0 || (Math.abs(py) < 0.01 && px < 0)) {
      px = -px
      py = -py
    }
    const x2 = start.x + dx * length
    const y2 = start.y + dy * length
    return { ...f, dir, start, x2, y2, lx: x2 + dx * 14 + px * 18, ly: y2 + dy * 14 + py * 18 + 5 }
  })

  // An angle the question names, as an arc from the nearest reference line.
  const arcs = forces
    .filter((f) => f.angle_label)
    .map((f) => {
      const refs = [...along, 0, 90, 180, 270].filter((r) => Math.abs(turn(r, f.dir)) > 2)
      const ref = refs.sort((a, b) => Math.abs(turn(a, f.dir)) - Math.abs(turn(b, f.dir)))[0]
      const sweep = turn(ref, f.dir)
      const r = 38
      const a0 = rad(ref)
      const a1 = rad(ref + sweep)
      const mid = rad(ref + sweep / 2)
      const sx = f.start.x
      const sy = f.start.y
      return {
        key: f.label,
        guide: { x2: sx + Math.cos(a0) * 70, y2: sy - Math.sin(a0) * 70 },
        d: `M ${sx + r * Math.cos(a0)} ${sy - r * Math.sin(a0)} A ${r} ${r} 0 0 ${sweep > 0 ? 0 : 1} ${sx + r * Math.cos(a1)} ${sy - r * Math.sin(a1)}`,
        lx: sx + (r + 16) * Math.cos(mid),
        ly: sy - (r + 16) * Math.sin(mid) + 5,
        label: f.angle_label,
        sx,
        sy,
      }
    })

  // The direction of motion, below and to one side of the body.
  let motion = null
  if (figure.motion && Number.isFinite(Number(figure.motion.direction_deg))) {
    const d = rad(Number(figure.motion.direction_deg))
    // To the side of the body, clear of the weight arrow straight down from it.
    const base = contact ? { x: contact.x - 120, y: contact.y + 32 } : { x: cx - 120, y: cy + 60 }
    motion = {
      x1: base.x - Math.cos(d) * 40,
      y1: base.y + Math.sin(d) * 40,
      x2: base.x + Math.cos(d) * 40,
      y2: base.y - Math.sin(d) * 40,
      label: figure.motion.label || 'motion',
      lx: base.x,
      ly: base.y + 24,
    }
  }

  // Frame everything so nothing is cut off, and never a sliver.
  const xs = [cx - 40, cx + 40, ...forces.flatMap((f) => [f.x2, f.lx - 4.5 * String(f.label).length, f.lx + 4.5 * String(f.label).length])]
  const ys = [cy - 40, cy + 40, ...forces.flatMap((f) => [f.y2, f.ly - 16, f.ly + 4])]
  for (const a of arcs) {
    xs.push(a.lx - 20, a.lx + 20)
    ys.push(a.ly - 14, a.ly + 4)
  }
  if (motion) {
    xs.push(motion.x1, motion.x2)
    ys.push(motion.y1, motion.y2, motion.ly + 4)
  }
  if (surfaceBox) {
    xs.push(surfaceBox.x0, surfaceBox.x1)
    ys.push(surfaceBox.y0, surfaceBox.y1)
  }
  const pad = 18
  const span = (lo, hi, min) => {
    const mid = (lo + hi) / 2
    const h = Math.max(min, hi - lo + 2 * pad) / 2
    return [mid - h, 2 * h]
  }
  const [vx, vw] = span(Math.min(...xs), Math.max(...xs), 400)
  const [vy, vh] = span(Math.min(...ys), Math.max(...ys), 260)

  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="mx-auto w-full max-w-[480px]" style={{ maxHeight: 360 }} role="img" aria-label={figure.alt || 'Free-body diagram'}>
      <defs>
        <marker id={`head${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={ARROW} />
        </marker>
        <marker id={`move${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={MOTION} />
        </marker>
      </defs>
      {surface}
      {body}
      {arcs.map((a) => (
        <g key={a.key}>
          <line x1={a.sx} y1={a.sy} x2={a.guide.x2} y2={a.guide.y2} stroke="var(--text-faint)" strokeWidth="1.2" strokeDasharray="4 4" />
          <path d={a.d} fill="none" stroke={INK} strokeWidth="1.5" />
          <text x={a.lx} y={a.ly} fontSize="14" textAnchor="middle" fill={INK}>
            {a.label}
          </text>
        </g>
      ))}
      {forces.map((f, i) => (
        <g key={i}>
          <line x1={f.start.x} y1={f.start.y} x2={f.x2} y2={f.y2} stroke={ARROW} strokeWidth="2.6" markerEnd={`url(#head${id})`} />
          <text x={f.lx} y={f.ly} fontSize="16" fontWeight="600" fill={ARROW} textAnchor="middle">
            {f.label}
          </text>
        </g>
      ))}
      {motion && (
        <g>
          <line x1={motion.x1} y1={motion.y1} x2={motion.x2} y2={motion.y2} stroke={MOTION} strokeWidth="2.2" markerEnd={`url(#move${id})`} />
          <text x={motion.lx} y={motion.ly} fontSize="13" textAnchor="middle" fill={MOTION}>
            {motion.label}
          </text>
        </g>
      )}
      <circle cx={cx} cy={cy} r="2.5" fill={INK} />
    </svg>
  )
}
