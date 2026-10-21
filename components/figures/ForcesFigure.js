'use client'

import { useId } from 'react'

/**
 * A free-body diagram drawn from the forces on a body.
 *
 * The question gives the surface (nothing, flat ground or a slope at an
 * angle), the body and each force as a direction and a relative size; this
 * draws them from the body's centre with arrowheads and labels placed clear
 * of the arrow. In testing an AI-drawn version of this squashed the friction
 * arrow into the block, which is exactly the force the question was about.
 *
 * Directions are anticlockwise from the positive x axis, as in maths: 0 is
 * right, 90 up, 270 down.
 */

const W = 480
const INK = 'var(--text)'
const ARROW = 'var(--brand)'
const BG = 'var(--surface-sunken)'
const rad = (d) => (d * Math.PI) / 180

export default function ForcesFigure({ figure }) {
  const id = useId().replace(/:/g, '')
  const angle = figure.surface === 'incline' ? Math.min(60, Math.max(10, Number(figure.angle_deg) || 30)) : 0
  const groundY = 270

  // The slope: high end on the left, the angle at the bottom right.
  let surface = null
  let surfaceBox = null
  let cx = W / 2
  let cy = 160
  if (figure.surface === 'incline') {
    const length = Math.min(360, 210 / Math.tan(rad(angle)))
    const x0 = W / 2 - length / 2
    const x1 = W / 2 + length / 2
    const top = groundY - length * Math.tan(rad(angle))
    surface = (
      <g>
        <polygon points={`${x0},${groundY} ${x1},${groundY} ${x0},${top}`} fill="none" stroke={INK} strokeWidth="2" />
        <path d={`M ${x1 - 46} ${groundY} A 46 46 0 0 1 ${x1 - 46 * Math.cos(rad(angle))} ${groundY - 46 * Math.sin(rad(angle))}`} fill="none" stroke={INK} strokeWidth="1.5" />
        <text x={x1 - 60} y={groundY - 8} fontSize="15" textAnchor="end" fill={INK}>
          {angle}°
        </text>
      </g>
    )
    surfaceBox = { x0, x1, y0: top, y1: groundY }
    // The body sits on the middle of the slope.
    const mx = W / 2
    const my = groundY - (length / 2) * Math.tan(rad(angle))
    cx = mx + 16 * Math.sin(rad(angle))
    cy = my - 16 * Math.cos(rad(angle))
  } else if (figure.surface === 'horizontal') {
    surface = <line x1="90" y1={groundY} x2={W - 90} y2={groundY} stroke={INK} strokeWidth="2" />
    surfaceBox = { x0: 90, x1: W - 90, y0: groundY, y1: groundY }
    cx = W / 2
    cy = groundY - 16
  }

  const body =
    figure.body === 'point' ? (
      <circle cx={cx} cy={cy} r="4" fill={INK} />
    ) : figure.body === 'ball' ? (
      <circle cx={cx} cy={cy} r="16" fill={BG} stroke={INK} strokeWidth="2" />
    ) : (
      <rect x={cx - 22} y={cy - 16} width="44" height="32" fill={BG} stroke={INK} strokeWidth="2" transform={`rotate(${angle} ${cx} ${cy})`} />
    )

  const forces = (figure.forces || []).slice(0, 6).map((f) => {
    const length = 40 + 80 * Math.min(1, Math.max(0.3, Number(f.size) || 0.6))
    const dx = Math.cos(rad(f.direction_deg))
    const dy = -Math.sin(rad(f.direction_deg))
    // The label sits past the arrowhead and off to the side of the line that
    // faces up the page, so it never lands on the arrow or on the slope.
    let px = -dy
    let py = dx
    if (py > 0 || (Math.abs(py) < 0.01 && px < 0)) {
      px = -px
      py = -py
    }
    const x2 = cx + dx * length
    const y2 = cy + dy * length
    // Centred, so a label on an arrow running along a slope stays clear of
    // the slope on both sides of its middle.
    return { ...f, x2, y2, lx: x2 + dx * 12 + px * 20, ly: y2 + dy * 12 + py * 20 + 5, anchor: 'middle' }
  })

  // Frame everything: the surface, the body, every arrow and its label, so a
  // long weight arrow below the ground is drawn rather than cut off.
  const xs = [cx - 30, cx + 30, ...forces.flatMap((f) => [f.x2, f.lx - 4.5 * String(f.label).length, f.lx + 4.5 * String(f.label).length])]
  const ys = [cy - 30, cy + 30, ...forces.flatMap((f) => [f.y2, f.ly - 16, f.ly + 4])]
  if (surfaceBox) {
    xs.push(surfaceBox.x0, surfaceBox.x1)
    ys.push(surfaceBox.y0, surfaceBox.y1)
  }
  // Never a sliver: a frame narrower or shorter than this is widened around
  // its centre, so two arrows on a ball do not fill a phone screen.
  const pad = 16
  const span = (lo, hi, min) => {
    const mid = (lo + hi) / 2
    const half = Math.max(min, hi - lo + 2 * pad) / 2
    return [mid - half, 2 * half]
  }
  const [vx, vw] = span(Math.min(...xs), Math.max(...xs), 380)
  const [vy, vh] = span(Math.min(...ys), Math.max(...ys), 240)

  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="mx-auto w-full max-w-[460px]" style={{ maxHeight: 340 }} role="img" aria-label={figure.alt || 'Free-body diagram'}>
      <defs>
        <marker id={`head${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={ARROW} />
        </marker>
      </defs>
      {surface}
      {body}
      {forces.map((f, i) => (
        <g key={i}>
          <line x1={cx} y1={cy} x2={f.x2} y2={f.y2} stroke={ARROW} strokeWidth="2.5" markerEnd={`url(#head${id})`} />
          <text x={f.lx} y={f.ly} fontSize="16" fontWeight="600" fill={ARROW} textAnchor={f.anchor}>
            {f.label}
          </text>
        </g>
      ))}
      <circle cx={cx} cy={cy} r="2.5" fill={INK} />
    </svg>
  )
}
