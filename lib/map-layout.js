/**
 * Where things go on the subject map, for one level at a time.
 *
 * The level's own node sits in the middle; its children sit on a ring round
 * it, starting at twelve o'clock and going clockwise in syllabus order. Past
 * ten children the ring staggers, every other node a step further out, so
 * eighteen still fit without their labels touching. A node that is expanded
 * fans its own children out beyond it, along its own direction, so the rest
 * of the ring does not move.
 *
 * Positions are in map units with the middle at 0,0. The canvas scales them;
 * nothing here knows about pixels on screen. The hierarchy itself lives in
 * lib/subject-graph.js; this only places it.
 */

export const NODE_W = 184
export const NODE_H = 86
export const GRAND_W = 150
export const GRAND_H = 40
export const HUB = 150

const STAGGER = 128
const GAP = 14

/**
 * The smallest ring on which no two cards touch each other or the hub,
 * found by trying it: every syllabus has at most eighteen children on a
 * level, so this is a few dozen cheap checks, once per level.
 */
function ringRadius(n, slots, staggered) {
  for (let r = 230; r < 1400; r += 10) {
    const pts = []
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / Math.max(1, slots)) * Math.PI * 2
      const rr = staggered && i % 2 ? r + STAGGER : r
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr])
    }
    let ok = pts.every(([x, y]) => Math.abs(x) >= (HUB + NODE_W) / 2 + GAP || Math.abs(y) >= (HUB + NODE_H) / 2 + GAP)
    for (let i = 0; ok && i < n; i++)
      for (let j = i + 1; ok && j < n; j++)
        if (Math.abs(pts[i][0] - pts[j][0]) < NODE_W + GAP && Math.abs(pts[i][1] - pts[j][1]) < NODE_H + GAP) ok = false
    if (ok) return r
  }
  return 1400
}

export function radialLayout(graph, focusId, expandedId = null) {
  const focus = graph.nodes.get(focusId)
  if (!focus) return { nodes: [], edges: [], bounds: { x0: -200, y0: -200, x1: 200, y1: 200 } }
  const kids = focus.childIds
  const n = kids.length
  const staggered = n > 10
  // Staggered rings alternate inner and outer, so an odd count would put the
  // first and last side by side on the inner ring. One empty slot at the
  // end keeps the alternation all the way round.
  const slots = staggered && n % 2 ? n + 1 : n
  const inner = ringRadius(n, slots, staggered)
  const outer = inner + STAGGER

  const nodes = [{ id: focusId, x: 0, y: 0, role: 'hub', angle: 0 }]
  const edges = []

  kids.forEach((id, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(1, slots)) * Math.PI * 2
    const r = staggered && i % 2 ? outer : inner
    nodes.push({ id, x: Math.cos(angle) * r, y: Math.sin(angle) * r, role: 'child', angle, r })
    edges.push({ from: focusId, to: id, kind: 'tree' })
  })

  const open = expandedId && kids.includes(expandedId) ? graph.nodes.get(expandedId) : null
  if (open && open.childIds.length) {
    const parent = nodes.find((p) => p.id === open.id)
    const m = open.childIds.length
    const spread = Math.min(Math.PI * 0.95, 0.2 + m * 0.2)
    const base = parent.r + 200
    open.childIds.forEach((id, j) => {
      const t = m === 1 ? 0 : j / (m - 1) - 0.5
      const angle = parent.angle + t * spread
      const r = base + (m > 6 && j % 2 ? 72 : 0)
      nodes.push({ id, x: Math.cos(angle) * r, y: Math.sin(angle) * r, role: 'grand', angle, r })
      edges.push({ from: open.id, to: id, kind: 'branch' })
    })
  }

  let x0 = -HUB / 2
  let y0 = -HUB / 2
  let x1 = HUB / 2
  let y1 = HUB / 2
  for (const p of nodes) {
    const w = (p.role === 'grand' ? GRAND_W : NODE_W) / 2
    const h = (p.role === 'grand' ? GRAND_H : NODE_H) / 2
    x0 = Math.min(x0, p.x - w)
    x1 = Math.max(x1, p.x + w)
    y0 = Math.min(y0, p.y - h)
    y1 = Math.max(y1, p.y + h)
  }
  return { nodes, edges, bounds: { x0, y0, x1, y1 } }
}

/** The view that frames bounds in a w × h box, never zoomed in past `max`. */
export function fitView(bounds, w, h, { pad = 56, max = 1.1, min = 0.3 } = {}) {
  const bw = bounds.x1 - bounds.x0 + pad * 2
  const bh = bounds.y1 - bounds.y0 + pad * 2
  const k = Math.max(min, Math.min(max, w / bw, h / bh))
  const cx = (bounds.x0 + bounds.x1) / 2
  const cy = (bounds.y0 + bounds.y1) / 2
  return { k, x: w / 2 - cx * k, y: h / 2 - cy * k }
}

/** A short curve from a to b, bowed a little so lines do not read as spokes. */
export function curve(a, b, bow = 0.12) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  return `M${a.x},${a.y} Q${mx - dy * bow},${my + dx * bow} ${b.x},${b.y}`
}
