'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { displaySubtopic, STATUS_LABELS } from '@/lib/progress'

/**
 * A subject as a web you can walk into.
 *
 * The heatmap answers "how much is green". It cannot answer "where does this
 * sit" — a grid of five hundred squares has no shape, and a course does: four
 * or five themes, each with numbered units, each with the things you actually
 * get asked about.
 *
 * The first version drew all three of those levels at once, which is how you
 * get a picture rather than a diagram: three hundred four-pixel dots on one
 * rim, none of them labelled, none of them big enough to aim at. So it zooms
 * instead. Each level draws one ring of things big enough to read and click,
 * and going in replaces the ring rather than adding to it:
 *
 *   subject   the themes, sized by how much of the course they are
 *   theme     its units, and its subtopics as a colour field around them
 *   unit      its subtopics, big, labelled, one click from a quiz
 *
 * Topics and units wear a donut of their own progress — how much is strong,
 * how much wants work — so the shape of the course and how you are doing in
 * it are the same picture.
 *
 * Layout is radial and deterministic, not a force simulation. A physics engine
 * would settle somewhere slightly different every time you opened it, and the
 * one thing a map has to do is be in the same place tomorrow.
 */

const STATUS_COLOR = {
  not_started: 'var(--status-untested)',
  decaying: 'var(--status-fading)',
  in_progress: 'var(--status-weak)',
  confident: 'var(--status-developing)',
  proficient: 'var(--status-proficient)',
  mastered: 'var(--status-mastered)',
}

const SIZE = 920
const CENTRE = SIZE / 2

/** Polar to cartesian, with 12 o'clock as zero so the first topic is on top. */
function at(angle, radius) {
  const rad = (angle - 90) * (Math.PI / 180)
  // Rounded, because the server and the browser disagree in the last decimal
  // place of a float and React calls that a hydration mismatch. Two decimals
  // is well below a pixel at this size.
  const round = (n) => Math.round(n * 100) / 100
  return { x: round(CENTRE + Math.cos(rad) * radius), y: round(CENTRE + Math.sin(rad) * radius) }
}

/** SVG will not wrap text, so the wrapping happens here. */
function wrap(text, max, maxLines = 2) {
  const words = String(text).split(/\s+/)
  const lines = ['']
  for (const w of words) {
    const i = lines.length - 1
    if (!lines[i]) lines[i] = w
    else if ((lines[i] + ' ' + w).length <= max) lines[i] += ' ' + w
    else lines.push(w)
  }
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, max - 1).trimEnd()}…`
  return kept
}

/**
 * "C.1" + "C.1 Wave model" is "C.1 Wave model", not "C.1 C.1 Wave model".
 * Some outlines carry the code in the unit name and some keep it separate.
 */
function unitLabel(u) {
  if (!u.code) return u.unit
  return u.unit.startsWith(u.code) ? u.unit : `${u.code} ${u.unit}`
}

/** How a pile of subtopics is going. */
function tally(items) {
  const counts = {}
  for (const row of items) {
    const s = row.status || 'not_started'
    counts[s] = (counts[s] || 0) + 1
  }
  const n = items.length || 1
  return {
    counts,
    total: items.length,
    // Two numbers, because they mean opposite things and the donut shows both.
    strong: ((counts.mastered || 0) + (counts.proficient || 0)) / n,
    weak: ((counts.in_progress || 0) + (counts.decaying || 0)) / n,
  }
}

/** The course, grouped once, whatever the zoom is doing. */
function tree(rows) {
  const byTopic = new Map()
  for (const row of rows) {
    if (!byTopic.has(row.topic)) byTopic.set(row.topic, new Map())
    const units = byTopic.get(row.topic)
    const unit = row.unit || row.topic
    if (!units.has(unit)) units.set(unit, { unit, code: row.code, items: [] })
    units.get(unit).items.push(row)
  }
  return [...byTopic.entries()].map(([topic, units]) => {
    const list = [...units.values()]
    const items = list.flatMap((u) => u.items)
    return { topic, units: list, items, size: items.length, ...tally(items) }
  })
}

/**
 * Where everything goes, for the level we are on.
 *
 * `focus` is null (the whole subject), {topic}, or {topic, unit}. Each level
 * gets the full circle for what it is showing, which is the only way a theme
 * with forty subtopics is ever readable at this size.
 */
function layout(topics, focus) {
  const nodes = []
  const links = []
  const hub = { x: CENTRE, y: CENTRE }

  // Level three: one unit, its subtopics big enough to read and aim at.
  if (focus?.unit) {
    const topic = topics.find((t) => t.topic === focus.topic)
    const unit = topic?.units.find((u) => u.unit === focus.unit)
    if (!unit) return { nodes, links }
    const items = unit.items
    const ring = 300
    // Two rings once one would have them touching, and a radius that shrinks
    // before that happens, so a unit of six and a unit of thirty both work.
    const rows = items.length > 18 ? 2 : 1
    const perRow = Math.ceil(items.length / rows)
    const spacing = (2 * Math.PI * ring) / perRow
    const r = Math.max(11, Math.min(34, spacing / 2.9))
    items.forEach((row, i) => {
      const band = i % rows
      const idx = Math.floor(i / rows)
      const radius = ring + (band ? r * 2.9 : 0)
      const point = at((idx / perRow) * 360, radius)
      // These radiate straight off the middle, so they carry the weight of a
      // branch rather than the hairline of a twig hanging off a unit.
      links.push({ from: hub, to: point, kind: 'branch' })
      nodes.push({
        id: `s:${row.subject}:${row.subtopic}`,
        kind: 'leaf',
        label: displaySubtopic(row.subtopic),
        status: row.status || 'not_started',
        row,
        r,
        labelled: r >= 15,
        ...point,
      })
    })
    return { nodes, links }
  }

  // Level two: one theme, its units, and its subtopics as a colour field.
  if (focus?.topic) {
    const topic = topics.find((t) => t.topic === focus.topic)
    if (!topic) return { nodes, links }
    const total = topic.size || 1
    let cursor = 0
    for (const u of topic.units) {
      const sweep = (u.items.length / total) * 360
      const mid = cursor + sweep / 2
      const point = at(mid, 190)
      const stat = tally(u.items)
      links.push({ from: hub, to: point, kind: 'spine' })
      nodes.push({
        id: `u:${topic.topic}:${u.unit}`,
        kind: 'unit',
        label: unitLabel(u),
        topic: topic.topic,
        unit: u.unit,
        r: 26,
        count: u.items.length,
        ...stat,
        ...point,
      })

      const step = sweep / (u.items.length + 1)
      const leafR = Math.max(5, Math.min(11, ((2 * Math.PI * 340) / total) / 2.6))
      u.items.forEach((row, i) => {
        const leaf = at(cursor + step * (i + 1), 340 + (i % 2 ? leafR * 2.4 : 0))
        links.push({ from: point, to: leaf, kind: 'twig', topic: topic.topic, unit: u.unit })
        nodes.push({
          id: `s:${row.subject}:${row.subtopic}`,
          kind: 'leaf',
          label: displaySubtopic(row.subtopic),
          status: row.status || 'not_started',
          row,
          unit: u.unit,
          topic: topic.topic,
          r: leafR,
          ...leaf,
        })
      })
      cursor += sweep
    }
    return { nodes, links }
  }

  // Level one: the whole subject, as themes and units. No individual
  // subtopics — three hundred dots is the picture this is trying not to be.
  const total = topics.reduce((n, t) => n + t.size, 0) || 1
  let cursor = 0
  for (const t of topics) {
    const sweep = (t.size / total) * 360
    const start = cursor + 2
    const end = cursor + sweep - 2
    const point = at((start + end) / 2, 200)
    links.push({ from: hub, to: point, kind: 'spine', topic: t.topic })
    nodes.push({
      id: `t:${t.topic}`,
      kind: 'topic',
      label: t.topic,
      topic: t.topic,
      r: 34,
      count: t.size,
      strong: t.strong,
      weak: t.weak,
      ...point,
    })

    let leafCursor = start
    for (const u of t.units) {
      const unitSweep = (u.items.length / t.size) * (end - start)
      const unitPoint = at(leafCursor + unitSweep / 2, 350)
      const stat = tally(u.items)
      links.push({ from: point, to: unitPoint, kind: 'branch', topic: t.topic })
      nodes.push({
        id: `u:${t.topic}:${u.unit}`,
        kind: 'unit',
        label: unitLabel(u),
        topic: t.topic,
        unit: u.unit,
        r: Math.max(13, Math.min(22, 5 + u.items.length * 1.6)),
        count: u.items.length,
        ...stat,
        ...unitPoint,
      })
      leafCursor += unitSweep
    }
    cursor += sweep
  }
  return { nodes, links }
}

/** Progress worn as a ring: how much is strong, then how much wants work. */
function Donut({ cx, cy, r, strong, weak, live, delay }) {
  const C = 2 * Math.PI * r
  // Brand rather than the mastered colour: this is an aggregate of a whole
  // topic, not one subtopic's status, and borrowing a legend colour for it
  // would say something the ring does not mean.
  const segments = [
    { frac: strong, color: 'var(--brand)', from: 0 },
    { frac: weak, color: 'var(--status-weak)', from: strong },
  ]
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="3.5" opacity="0.7" />
      {segments.map((s, i) =>
        s.frac > 0.001 ? (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="3.5"
            strokeLinecap="butt"
            strokeDasharray={C}
            strokeDashoffset={live ? C * (1 - s.frac) : C}
            transform={`rotate(${-90 + s.from * 360} ${cx} ${cy})`}
            style={{
              transition: `stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, cx 620ms cubic-bezier(0.16,1,0.3,1), cy 620ms cubic-bezier(0.16,1,0.3,1)`,
            }}
          />
        ) : null
      )}
    </g>
  )
}

export default function SubjectWeb({ subject, rows, onPickSubtopic, fill = false }) {
  const [focus, setFocus] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [ripple, setRipple] = useState(null)
  // Drawn once the panel is on screen, so the entrance actually plays.
  const [live, setLive] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setLive(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const topics = useMemo(() => tree(rows), [rows])
  const { nodes, links } = useMemo(() => layout(topics, focus), [topics, focus])

  const counts = useMemo(() => tally(rows).counts, [rows])

  const hoveredNode = hovered ? nodes.find((n) => n.id === hovered) : null
  // Hovering a branch quietens the rest of the map rather than shouting louder.
  const activeKey = hoveredNode ? hoveredNode.unit || hoveredNode.topic : null

  // What the middle is showing, at whatever level we are on.
  const scope = useMemo(() => {
    if (focus?.unit) {
      const t = topics.find((x) => x.topic === focus.topic)
      const u = t?.units.find((x) => x.unit === focus.unit)
      return { label: u?.code || 'Unit', items: u?.items || [] }
    }
    if (focus?.topic) {
      const t = topics.find((x) => x.topic === focus.topic)
      return { label: t?.topic || '', items: t?.items || [] }
    }
    return { label: subject, items: rows }
  }, [focus, topics, rows, subject])

  const scopeStat = useMemo(() => tally(scope.items), [scope])
  const percent = Math.round(scopeStat.strong * 100)

  const zoomOut = () => setFocus(focus?.unit ? { topic: focus.topic } : null)

  const tap = (n) => {
    setRipple({ x: n.x, y: n.y, r: n.r, key: Date.now() })
    if (n.kind === 'topic') setFocus({ topic: n.topic })
    else if (n.kind === 'unit') setFocus({ topic: n.topic, unit: n.unit })
    else if (n.kind === 'leaf') onPickSubtopic?.(n.row)
  }

  const crumb = (label, onClick, current) => (
    <button
      onClick={onClick}
      disabled={current}
      className={current ? 'btn btn-quiet control-sm' : 'btn btn-outline control-sm'}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {crumb(subject, () => setFocus(null), !focus)}
        {focus && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>›</span>
            {crumb(
              wrap(focus.topic, 28, 1)[0],
              () => setFocus({ topic: focus.topic }),
              !focus.unit
            )}
          </>
        )}
        {focus?.unit && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>›</span>
            {crumb(wrap(focus.unit, 28, 1)[0], () => {}, true)}
          </>
        )}
        <div className="flex-1" />
        <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
          {focus?.unit
            ? 'Click a subtopic to practise it'
            : focus
              ? 'Click a unit to open it'
              : 'Click a theme, or a unit on the rim'}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-[18px] border"
        style={{
          borderColor: 'var(--border-strong)',
          background: 'var(--surface-sunken)',
          // On its own page the map takes the height it can get, and the
          // square sits centred in it. Inline it just follows the column.
          ...(fill ? { height: 'min(72vh, 840px)' } : null),
        }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={fill ? 'h-full w-full' : 'h-auto w-full'}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${subject} as a map of topics and subtopics`}
        >
          <defs>
            {/* A breath of brand under the middle, so the centre reads as the
                light source rather than another circle. */}
            <radialGradient id="web-core">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.20" />
              <stop offset="70%" stopColor="var(--brand)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={CENTRE} cy={CENTRE} r={330} fill="url(#web-core)" opacity={live ? 1 : 0}
            style={{ transition: 'opacity 900ms ease' }} />

          {/* Rings, so the levels read as levels rather than scatter. */}
          {[200, 350].map((r, i) => (
            <circle
              key={r}
              className="web-ring"
              cx={CENTRE}
              cy={CENTRE}
              r={r}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="2 7"
              opacity={live ? 0.55 : 0}
              style={{ transition: 'opacity 700ms ease', animationDelay: `${i * -14}s` }}
            />
          ))}

          {links.map((l, i) => {
            const key = l.unit || l.topic
            const dim = activeKey && key && key !== activeKey
            const len = Math.round(Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y) * 100) / 100
            return (
              <line
                key={`${l.from.x},${l.from.y},${l.to.x},${l.to.y},${i}`}
                x1={l.from.x}
                y1={l.from.y}
                x2={l.to.x}
                y2={l.to.y}
                stroke={
                  l.kind === 'spine'
                    ? 'color-mix(in oklab, var(--brand) 60%, transparent)'
                    : l.kind === 'branch'
                      ? 'color-mix(in oklab, var(--brand) 32%, transparent)'
                      : 'var(--border-strong)'
                }
                strokeWidth={l.kind === 'spine' ? 2.2 : l.kind === 'branch' ? 1.6 : 1}
                strokeLinecap="round"
                // Drawn outwards from the middle rather than faded in, because
                // the thing being shown is that these hang off that.
                strokeDasharray={len}
                strokeDashoffset={live ? 0 : len}
                opacity={dim ? 0.1 : l.kind === 'twig' ? 0.6 : 0.95}
                style={{
                  transition: `stroke-dashoffset ${520 + (i % 9) * 45}ms cubic-bezier(0.16,1,0.3,1), opacity 220ms ease`,
                }}
              />
            )
          })}

          {nodes.map((n, i) => {
            const key = n.unit || n.topic
            const dim = activeKey && key !== activeKey
            const isHovered = hovered === n.id
            const grow = isHovered ? 1.22 : 1
            const fill =
              n.kind === 'leaf'
                ? `color-mix(in oklab, ${STATUS_COLOR[n.status]} 72%, var(--surface))`
                : 'var(--surface)'

            return (
              <g
                key={n.id}
                className="web-node"
                opacity={live ? (dim ? 0.22 : 1) : 0}
                style={{
                  transition: `opacity 340ms ease ${Math.min(i * 6, 420)}ms`,
                  animationDelay: `${Math.min(i * 22, 700)}ms`,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => tap(n)}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r * grow}
                  fill={fill}
                  stroke={
                    n.kind === 'leaf'
                      ? STATUS_COLOR[n.status]
                      : isHovered
                        ? 'var(--brand)'
                        : 'var(--border-strong)'
                  }
                  strokeWidth={n.kind === 'leaf' ? 1.6 : 1.5}
                  style={{
                    transition:
                      'cx 620ms cubic-bezier(0.16,1,0.3,1), cy 620ms cubic-bezier(0.16,1,0.3,1), r 220ms cubic-bezier(0.16,1,0.3,1), stroke 200ms ease',
                    filter: isHovered
                      ? 'drop-shadow(0 0 10px color-mix(in oklab, var(--brand) 70%, transparent))'
                      : 'none',
                  }}
                />

                {(n.kind === 'topic' || n.kind === 'unit') && (
                  <Donut
                    cx={n.x}
                    cy={n.y}
                    r={n.r * grow + 7}
                    strong={n.strong || 0}
                    weak={n.weak || 0}
                    live={live}
                    delay={Math.min(i * 30, 600)}
                  />
                )}

                {/* How many things are in there, inside the circle it is about. */}
                {(n.kind === 'topic' || (n.kind === 'unit' && n.r >= 13)) && (
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    style={{
                      fontSize: n.kind === 'topic' ? 14 : 11,
                      fontWeight: 600,
                      fill: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    {n.count}
                  </text>
                )}

                {/* Labels get a halo, because a word crossing a link is a word
                    you have to decode rather than read. */}
                {(n.kind === 'topic' ||
                  (n.kind === 'unit' && focus?.topic) ||
                  (n.kind === 'leaf' && n.labelled) ||
                  isHovered) && (
                  <text
                    x={n.x}
                    y={n.y + n.r * grow + 16}
                    textAnchor="middle"
                    style={{
                      fontSize: n.kind === 'leaf' ? 11.5 : 12.5,
                      fontWeight: n.kind === 'leaf' ? 500 : 600,
                      fill: isHovered ? 'var(--text)' : 'var(--text-muted)',
                      paintOrder: 'stroke',
                      stroke: 'var(--surface-sunken)',
                      strokeWidth: 3.5,
                      strokeLinejoin: 'round',
                      pointerEvents: 'none',
                    }}
                  >
                    {wrap(n.label, n.kind === 'leaf' ? 18 : 24, 2).map((line, li) => (
                      <tspan key={li} x={n.x} dy={li === 0 ? 0 : 13}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            )
          })}

          {/* The press, answered. */}
          {ripple && (
            <circle
              key={ripple.key}
              className="web-ripple"
              cx={ripple.x}
              cy={ripple.y}
              r={ripple.r}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2"
            />
          )}

          {/* The middle: where you are, how it is going, and the way back out. */}
          <g onClick={zoomOut} style={{ cursor: focus ? 'pointer' : 'default' }}>
            <circle className="web-pulse" cx={CENTRE} cy={CENTRE} r={62}
              fill="none" stroke="var(--brand)" strokeWidth="1.5" />
            <circle cx={CENTRE} cy={CENTRE} r={58} fill="var(--surface)"
              stroke="var(--border-strong)" strokeWidth="1.5" />
            <Donut
              cx={CENTRE}
              cy={CENTRE}
              r={50}
              strong={scopeStat.strong}
              weak={scopeStat.weak}
              live={live}
              delay={120}
            />
            <text x={CENTRE} y={CENTRE + 2} textAnchor="middle"
              style={{ fontSize: 26, fontWeight: 600, fill: 'var(--text)', pointerEvents: 'none' }}>
              {percent}%
            </text>
            <text x={CENTRE} y={CENTRE + 20} textAnchor="middle"
              style={{ fontSize: 10.5, fontWeight: 500, fill: 'var(--text-faint)', pointerEvents: 'none' }}>
              {focus ? 'back' : 'strong'}
            </text>
          </g>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {[
          ['mastered', 'Mastered'],
          ['proficient', 'Proficient'],
          ['confident', 'Developing'],
          ['in_progress', 'Weak'],
          ['decaying', 'Fading'],
          ['not_started', 'Untested'],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[key] }} />
            <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              {label}
              {counts[key] ? ` ${counts[key]}` : ''}
            </span>
          </span>
        ))}
      </div>

      {/* What the pointer is on, under the map rather than floating over it. */}
      <div className="mt-3 flex min-h-[44px] flex-wrap items-center justify-between gap-3">
        {hoveredNode ? (
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium">{hoveredNode.label}</p>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              {hoveredNode.kind === 'leaf'
                ? STATUS_LABELS[hoveredNode.status] || 'Not tested yet'
                : `${hoveredNode.count} subtopics · ${Math.round((hoveredNode.strong || 0) * 100)}% strong`}
            </p>
          </div>
        ) : (
          <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            Point at anything to read it. Click to go in.
          </p>
        )}

        {hoveredNode?.kind === 'leaf' && (
          <Link
            href={`/dashboard/quiz?subject=${encodeURIComponent(hoveredNode.row.subject)}&topic=${encodeURIComponent(hoveredNode.row.topic)}&subtopic=${encodeURIComponent(hoveredNode.row.subtopic)}&count=5&review=practice&back=/dashboard/progress`}
            className="btn btn-outline control-sm shrink-0"
          >
            Quick 5
          </Link>
        )}
      </div>
    </div>
  )
}
