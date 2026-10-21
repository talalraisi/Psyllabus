'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { radialLayout, curve, NODE_W, NODE_H, GRAND_W, GRAND_H, HUB } from '@/lib/map-layout'
import { statusLabel, needsWork } from '@/lib/subject-graph'

/**
 * One level of the subject map, drawn on a surface you can pan and zoom.
 *
 * The view ({ x, y, k }) belongs to the parent, so it can be kept per level
 * and put back when the student returns. This draws, and reports what the
 * student does: a click selects, the arrow on a node opens its own map, the
 * small toggle fans its children out in place, and dragging the background
 * moves the map. Dragging never selects and clicking never drags: a press
 * that moves more than a few pixels is a pan.
 *
 * `relations` is leaf id → related leaf ids (lib/subject-graph `related`),
 * mapped up to whatever is visible here, so the connections show at every
 * level, not only among subtopics.
 */

export const STATUS_VAR = {
  mastered: 'var(--status-mastered)',
  proficient: 'var(--status-proficient)',
  confident: 'var(--status-developing)',
  in_progress: 'var(--status-weak)',
  decaying: 'var(--status-fading)',
  not_started: 'var(--status-untested)',
}

const MIN_K = 0.3
const MAX_K = 2.4

function Ring({ value, size, stroke = 3, color = 'var(--brand)' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      {value > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      )}
    </svg>
  )
}

/** "4 of 12 proved" for a branch, the score for a tested subtopic. */
export function progressLine(node) {
  if (node.kind === 'subtopic') return node.score == null ? 'Not tested yet' : `${node.score}/100`
  return `${node.tally.proved} of ${node.tally.total} proved`
}

const Node = memo(function Node({ node, role, selected, expanded, dim, onSelect, onEnter, onExpand }) {
  const branch = node.kind !== 'subtopic'
  const grand = role === 'grand'
  const color = STATUS_VAR[node.status] || STATUS_VAR.not_started
  const pct = branch ? (node.tally.total ? (node.tally.proved / node.tally.total) * 100 : 0) : node.score ?? 0

  if (grand) {
    return (
      <button
        type="button"
        data-node
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => branch && onEnter(node.id)}
        aria-pressed={selected}
        className="flex h-full w-full items-center gap-2 rounded-full border px-3 text-left text-[11.5px] font-medium transition-[box-shadow,border-color,opacity] duration-200"
        style={{
          borderColor: selected ? 'var(--brand)' : 'var(--border-strong)',
          background: 'var(--surface)',
          boxShadow: selected ? '0 0 0 3px var(--brand-tint)' : '0 6px 16px -12px rgb(0 0 0 / 0.5)',
          opacity: dim ? 0.3 : 1,
          color: 'var(--text-body)',
        }}
        title={`${node.title} · ${statusLabel(node.status)}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="line-clamp-1">{node.title}</span>
      </button>
    )
  }

  return (
    <div
      data-node
      className="group relative h-full w-full"
      style={{ opacity: dim ? 0.28 : 1, transition: 'opacity 200ms' }}
    >
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => branch && onEnter(node.id)}
        aria-pressed={selected}
        aria-label={`${node.title}. ${statusLabel(node.status)}. ${progressLine(node)}.${branch ? ' Double-click to open.' : ''}`}
        className={`flex h-full w-full flex-col justify-between rounded-[14px] border p-3 text-left transition-[box-shadow,border-color,transform] duration-200 group-hover:-translate-y-0.5 ${branch ? 'pr-6' : ''}`}
        style={{
          borderColor: selected ? 'var(--brand)' : 'var(--border-strong)',
          background: 'var(--surface)',
          boxShadow: selected
            ? '0 0 0 3px var(--brand-tint), 0 14px 30px -18px rgb(0 0 0 / 0.6)'
            : '0 10px 26px -20px rgb(0 0 0 / 0.55)',
        }}
      >
        <span className="flex items-center gap-1.5 text-[10.5px] font-medium" style={{ color: 'var(--text-faint)' }}>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate">{statusLabel(node.status)}</span>
          {node.hl && <span className="ml-auto rounded px-1 text-[9.5px] font-semibold" style={{ background: 'var(--surface-sunken)' }}>HL</span>}
        </span>
        <span className="line-clamp-2 text-[12.5px] font-semibold leading-[1.3] tracking-[-0.01em]" style={{ color: 'var(--text)' }}>
          {node.title}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 600ms' }} />
          </span>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {branch ? `${node.tally.proved}/${node.tally.total}` : node.score == null ? '—' : node.score}
          </span>
        </span>
      </button>

      {branch && (
        <span className="absolute -right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1">
          <button
            type="button"
            onClick={() => onEnter(node.id)}
            title="Open its map"
            aria-label={`Open the map of ${node.title}`}
            className="flex h-7 w-7 items-center justify-center rounded-full border transition-[transform,background-color] hover:scale-110"
            style={{ borderColor: 'var(--border-strong)', background: selected ? 'var(--brand)' : 'var(--surface)', color: selected ? '#fff' : 'var(--text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 6h7M6.5 3l3 3-3 3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onExpand(node.id)}
            title={expanded ? 'Fold away' : 'Show what is inside here'}
            aria-label={expanded ? `Fold away ${node.title}` : `Show what is inside ${node.title}`}
            aria-expanded={expanded}
            className="flex h-7 w-7 items-center justify-center rounded-full border text-[14px] leading-none transition-transform hover:scale-110"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)' }}
          >
            {expanded ? '−' : '+'}
          </button>
        </span>
      )}
    </div>
  )
})

function Hub({ node, onSelect, selected }) {
  const pct = node.tally.total ? (node.tally.proved / node.tally.total) * 100 : 0
  return (
    <button
      type="button"
      data-node
      onClick={() => onSelect(node.id)}
      aria-pressed={selected}
      className="relative flex h-full w-full flex-col items-center justify-center rounded-full border px-5 text-center"
      style={{
        borderColor: selected ? 'var(--brand)' : 'var(--border-strong)',
        background: 'radial-gradient(circle at 50% 35%, var(--surface), var(--surface-sunken))',
        boxShadow: '0 20px 50px -28px rgb(0 0 0 / 0.7)',
      }}
    >
      <Ring value={pct} size={HUB} stroke={3} />
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
        {node.kind === 'subject' ? 'Subject' : node.kind === 'topic' ? 'Topic' : 'Unit'}
      </span>
      <span className="mt-1 line-clamp-3 text-[13px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
        {node.title}
      </span>
      <span className="mt-1.5 text-[10.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {node.tally.proved}/{node.tally.total} proved
      </span>
    </button>
  )
}

export default function MapCanvas({
  graph,
  focusId,
  selectedId,
  expandedId,
  view,
  onView,
  animating = false,
  fade = 1,
  weakOnly = false,
  showConnections = false,
  relations,
  onSelect,
  onEnter,
  onExpand,
  onSize,
  onBackground,
  minimap = true,
  controls = null,
  interactive = true,
}) {
  const box = useRef(null)
  const drag = useRef(null)
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const [size, setSize] = useState({ w: 0, h: 0 })

  const layout = useMemo(() => radialLayout(graph, focusId, expandedId), [graph, focusId, expandedId])
  const at = useMemo(() => new Map(layout.nodes.map((p) => [p.id, p])), [layout])

  // Size, reported up so the parent can frame a level.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const s = { w: e.contentRect.width, h: e.contentRect.height }
      setSize(s)
      onSize?.(s)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [onSize])

  // Wheel: pinch-zoom and ctrl+wheel zoom round the pointer; a two-finger
  // swipe pans. Bound by hand because React's wheel listener is passive and
  // cannot stop the page scrolling.
  useEffect(() => {
    const el = box.current
    if (!el || !interactive) return
    const onWheel = (e) => {
      e.preventDefault()
      const v = viewRef.current
      const r = el.getBoundingClientRect()
      const mouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && e.deltaX === 0 && Number.isInteger(e.deltaY))
      if (e.ctrlKey || mouseWheel) {
        const k = Math.max(MIN_K, Math.min(MAX_K, v.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
        const px = e.clientX - r.left
        const py = e.clientY - r.top
        onView({ k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k })
      } else {
        onView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onView, interactive])

  const onPointerDown = (e) => {
    if (!interactive) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), view: viewRef.current, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
      drag.current = null
      return
    }
    // Nodes, the zoom and Center buttons and the minimap handle their own
    // presses. Starting a drag on them captured the pointer, so the release
    // landed on the map instead and the button never saw its click.
    if (e.target.closest('[data-node], [data-ui], button, a')) {
      pointers.current.delete(e.pointerId)
      return
    }
    drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const p = pinch.current
      const r = box.current.getBoundingClientRect()
      const k = Math.max(MIN_K, Math.min(MAX_K, p.view.k * (Math.hypot(a.x - b.x, a.y - b.y) / p.d)))
      const px = p.mid.x - r.left
      const py = p.mid.y - r.top
      onView({ k, x: px - ((px - p.view.x) / p.view.k) * k, y: py - ((py - p.view.y) / p.view.k) * k })
      return
    }
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    onView({ ...d.view, x: d.view.x + dx, y: d.view.y + dy })
  }
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const d = drag.current
    drag.current = null
    if (d && !d.moved && !e.target.closest('[data-node], [data-ui], button, a')) onBackground?.()
  }

  // Connections, lifted to whatever is drawn at this level.
  const links = useMemo(() => {
    if (!showConnections || !relations) return []
    const visible = new Set(layout.nodes.filter((p) => p.role !== 'hub').map((p) => p.id))
    const up = (id) => {
      let n = graph.nodes.get(id)
      while (n && !visible.has(n.id)) n = n.parentId ? graph.nodes.get(n.parentId) : null
      return n?.id || null
    }
    const seen = new Map()
    for (const [leaf, rel] of relations) {
      const a = up(leaf)
      if (!a) continue
      for (const other of rel) {
        const b = up(other)
        if (!b || b === a) continue
        const key = a < b ? `${a}|${b}` : `${b}|${a}`
        seen.set(key, (seen.get(key) || 0) + 1)
      }
    }
    return [...seen.entries()].map(([key, weight]) => {
      const [a, b] = key.split('|')
      return { a, b, weight, hot: a === selectedId || b === selectedId }
    })
  }, [showConnections, relations, layout, graph, selectedId])

  const anyHot = links.some((l) => l.hot)
  const { x, y, k } = view
  const grid = 28 * k

  return (
    <div
      ref={box}
      className="relative h-full w-full touch-none select-none overflow-hidden active:cursor-grabbing"
      style={{
        cursor: interactive ? 'grab' : 'default',
        backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1.2px)',
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${x}px ${y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${x}px, ${y}px) scale(${k})`,
          transformOrigin: '0 0',
          transition: animating ? 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease' : 'none',
          opacity: fade,
          willChange: 'transform',
        }}
      >
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0 }} width="1" height="1" aria-hidden="true">
          {layout.edges.map((e) => {
            const a = at.get(e.from)
            const b = at.get(e.to)
            const on = e.to === selectedId || e.from === selectedId
            return (
              <path
                key={`${e.from}>${e.to}`}
                d={curve(a, b, e.kind === 'tree' ? 0.06 : 0.1)}
                fill="none"
                stroke={on ? 'var(--brand)' : 'var(--border-strong)'}
                strokeWidth={(on ? 1.6 : 1.1) / Math.max(0.6, k)}
                strokeDasharray={e.kind === 'branch' ? '4 5' : undefined}
                style={{ transition: 'stroke 200ms' }}
              />
            )
          })}
          {links.map((l) => {
            const a = at.get(l.a)
            const b = at.get(l.b)
            if (!a || !b) return null
            return (
              <path
                key={`${l.a}~${l.b}`}
                d={curve(a, b, 0.35)}
                fill="none"
                stroke={l.hot ? 'var(--brand)' : 'var(--text-faint)'}
                strokeWidth={(l.hot ? 1.8 : 1) / Math.max(0.6, k)}
                strokeDasharray="2 6"
                strokeLinecap="round"
                opacity={anyHot && !l.hot ? 0.15 : l.hot ? 0.95 : 0.45}
              />
            )
          })}
        </svg>

        {layout.nodes.map((p) => {
          const node = graph.nodes.get(p.id)
          const w = p.role === 'hub' ? HUB : p.role === 'grand' ? GRAND_W : NODE_W
          const h = p.role === 'hub' ? HUB : p.role === 'grand' ? GRAND_H : NODE_H
          return (
            <div
              key={p.id}
              className="absolute"
              style={{ left: p.x - w / 2, top: p.y - h / 2, width: w, height: h, animation: 'map-node-in 380ms cubic-bezier(0.22,1,0.36,1) backwards' }}
            >
              {p.role === 'hub' ? (
                <Hub node={node} onSelect={onSelect} selected={selectedId === p.id} />
              ) : (
                <Node
                  node={node}
                  role={p.role}
                  selected={selectedId === p.id}
                  expanded={expandedId === p.id}
                  dim={weakOnly && !needsWork(node)}
                  onSelect={onSelect}
                  onEnter={onEnter}
                  onExpand={onExpand}
                />
              )}
            </div>
          )
        })}
      </div>

      {minimap && size.w > 0 && <Minimap layout={layout} graph={graph} view={view} size={size} onView={onView} />}
      {controls}
    </div>
  )
}

/** The level in miniature, with the part on screen outlined. Click to go there. */
function Minimap({ layout, graph, view, size, onView }) {
  const W = 148
  const H = 104
  const b = layout.bounds
  const s = Math.min(W / (b.x1 - b.x0 + 80), H / (b.y1 - b.y0 + 80))
  const ox = W / 2 - ((b.x0 + b.x1) / 2) * s
  const oy = H / 2 - ((b.y0 + b.y1) / 2) * s
  const vx = (-view.x / view.k) * s + ox
  const vy = (-view.y / view.k) * s + oy
  const vw = (size.w / view.k) * s
  const vh = (size.h / view.k) * s
  return (
    <svg
      data-ui
      width={W}
      height={H}
      className="absolute bottom-4 left-4 hidden rounded-[12px] border md:block"
      style={{ borderColor: 'var(--border-strong)', background: 'color-mix(in oklab, var(--surface) 92%, transparent)' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        const r = e.currentTarget.getBoundingClientRect()
        const mx = (e.clientX - r.left - ox) / s
        const my = (e.clientY - r.top - oy) / s
        onView({ ...view, x: size.w / 2 - mx * view.k, y: size.h / 2 - my * view.k })
      }}
      role="img"
      aria-label="Overview of this level. Click to move there."
    >
      {layout.nodes.map((p) => (
        <circle
          key={p.id}
          cx={p.x * s + ox}
          cy={p.y * s + oy}
          r={p.role === 'hub' ? 5 : p.role === 'grand' ? 1.8 : 3}
          fill={STATUS_VAR[graph.nodes.get(p.id)?.status] || 'var(--text-faint)'}
        />
      ))}
      <rect x={vx} y={vy} width={vw} height={vh} fill="none" stroke="var(--brand)" strokeWidth="1.2" rx="3" />
    </svg>
  )
}
