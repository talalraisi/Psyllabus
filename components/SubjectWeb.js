'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { displaySubtopic, STATUS_LABELS } from '@/lib/progress'

/**
 * A subject as a web.
 *
 * The heatmap answers "how much is green". It cannot answer "where does this
 * sit" — a grid of five hundred squares has no shape, and a course does: four
 * or five themes, each with numbered units, each with the things you actually
 * get asked about. This draws that shape, and colours it with what you have
 * proved.
 *
 * Layout is radial and deterministic, not a force simulation. A physics engine
 * would settle somewhere slightly different every time you opened it, and the
 * one thing a map has to do is be in the same place tomorrow. Each topic gets
 * a sector of the circle proportional to its size; its units sit on the middle
 * ring inside that sector; the subtopics fan out on the rim.
 *
 * Opening a topic re-lays the whole web around that topic instead. Every node
 * moves to its new position with a transition rather than a cut, so the change
 * reads as the same map turning rather than a different picture.
 */

const STATUS_COLOR = {
  not_started: 'var(--status-untested)',
  decaying: 'var(--status-fading)',
  in_progress: 'var(--status-weak)',
  confident: 'var(--status-developing)',
  proficient: 'var(--status-proficient)',
  mastered: 'var(--status-mastered)',
}

const SIZE = 760
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

/**
 * "C.1" + "C.1 Wave model" is "C.1 Wave model", not "C.1 C.1 Wave model".
 * Some outlines carry the code in the unit name and some keep it separate.
 */
function unitLabel(u) {
  if (!u.code) return u.unit
  return u.unit.startsWith(u.code) ? u.unit : `${u.code} ${u.unit}`
}

/**
 * Where everything goes.
 *
 * `focus` is null for the whole subject, {topic} for one theme, or
 * {topic, unit} for one unit. Each step gives what is left the full circle
 * and hides the rest, which is the only way a theme with forty subtopics is
 * readable at this size — and it is what makes the dots grow as you go in,
 * because they are sharing the rim with fewer of their neighbours.
 */
function layout(rows, focus) {
  const byTopic = new Map()
  for (const row of rows) {
    if (!byTopic.has(row.topic)) byTopic.set(row.topic, new Map())
    const units = byTopic.get(row.topic)
    const unit = row.unit || row.topic
    if (!units.has(unit)) units.set(unit, { unit, code: row.code, items: [] })
    units.get(unit).items.push(row)
  }

  const topics = [...byTopic.entries()].map(([topic, units]) => ({
    topic,
    units: [...units.values()],
    size: [...units.values()].reduce((n, u) => n + u.items.length, 0),
  }))

  // Going in narrows what is drawn: one theme, then one unit of it.
  const shown = (focus ? topics.filter((t) => t.topic === focus.topic) : topics).map((t) => {
    const units = focus?.unit ? t.units.filter((u) => u.unit === focus.unit) : t.units
    return { ...t, units, size: units.reduce((n, u) => n + u.items.length, 0) }
  })
  const total = shown.reduce((n, t) => n + t.size, 0) || 1

  const RING_TOPIC = focus ? 118 : 150
  const RING_UNIT = focus ? 212 : 240
  const RING_LEAF = focus ? 318 : 330

  // The dots are sized to the room they have. Nine of them on the rim get to
  // be big; three hundred cannot, and four pixels was what that looked like
  // at every zoom whether there was room or not.
  const spacing = (2 * Math.PI * RING_LEAF) / total
  const leafR = Math.max(4.5, Math.min(11, spacing / 2.8))
  // A dot needs a few pixels; a name needs about a hundred and thirty. Those
  // are different questions, and labelling every leaf the moment the dots got
  // big is how forty names ended up stacked on one rim.
  const leavesLabelled = spacing >= 130

  const nodes = []
  const links = []
  let cursor = 0

  for (const t of shown) {
    // A sector proportional to how much of the course this topic is, with a
    // small gap so neighbouring themes do not run into each other.
    const sweep = (t.size / total) * 360
    const start = cursor + (focus ? 0 : 3)
    const end = cursor + sweep - (focus ? 0 : 3)
    const mid = (start + end) / 2
    cursor += sweep

    const topicPoint = at(mid, RING_TOPIC)
    const topicId = `t:${t.topic}`
    nodes.push({ id: topicId, kind: 'topic', label: t.topic, ...topicPoint, topic: t.topic })
    links.push({ from: { x: CENTRE, y: CENTRE }, to: topicPoint, kind: 'spine' })

    let leafCursor = start
    for (const u of t.units) {
      const unitSweep = (u.items.length / t.size) * (end - start)
      const unitMid = leafCursor + unitSweep / 2
      const unitPoint = at(unitMid, RING_UNIT)
      const unitId = `u:${t.topic}:${u.unit}`
      nodes.push({
        id: unitId,
        kind: 'unit',
        label: unitLabel(u),
        ...unitPoint,
        topic: t.topic,
        unit: u.unit,
      })
      links.push({ from: topicPoint, to: unitPoint, kind: 'branch', topic: t.topic })

      u.items.forEach((row, i) => {
        // Spread the leaves across their unit's slice, leaving the edges alone
        // so two units' leaves never sit on top of each other.
        const step = unitSweep / (u.items.length + 1)
        const leafAngle = leafCursor + step * (i + 1)
        const leafPoint = at(leafAngle, RING_LEAF + (i % 2 ? leafR * 2.4 : 0))
        nodes.push({
          id: `s:${row.subject}:${row.subtopic}`,
          kind: 'leaf',
          label: displaySubtopic(row.subtopic),
          status: row.status || 'not_started',
          row,
          r: leafR,
          // Only once they are big enough for a word to sit under one without
          // landing on its neighbour.
          labelled: leavesLabelled,
          ...leafPoint,
          topic: t.topic,
          unit: u.unit,
        })
        links.push({ from: unitPoint, to: leafPoint, kind: 'twig', topic: t.topic })
      })

      leafCursor += unitSweep
    }
  }

  return { nodes, links, topics }
}

export default function SubjectWeb({ subject, rows, onPickSubtopic, fill = false }) {
  const [focus, setFocus] = useState(null)
  const [hovered, setHovered] = useState(null)
  // Drawn once the panel is on screen, so the entrance actually plays.
  const [live, setLive] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setLive(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const { nodes, links, topics } = useMemo(() => layout(rows, focus), [rows, focus])

  const counts = useMemo(() => {
    const out = {}
    for (const row of rows) out[row.status || 'not_started'] = (out[row.status || 'not_started'] || 0) + 1
    return out
  }, [rows])

  const hoveredNode = hovered ? nodes.find((n) => n.id === hovered) : null
  const activeTopic = hoveredNode?.topic || null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFocus(null)}
          disabled={!focus}
          className={focus ? 'btn btn-outline control-sm' : 'btn btn-quiet control-sm'}
        >
          {subject}
        </button>
        {focus && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>›</span>
            <button
              onClick={() => setFocus({ topic: focus.topic })}
              disabled={!focus.unit}
              className={focus.unit ? 'btn btn-outline control-sm' : 'btn btn-quiet control-sm'}
            >
              {focus.topic}
            </button>
          </>
        )}
        {focus?.unit && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>›</span>
            <span className="text-[13px] font-medium">{focus.unit}</span>
          </>
        )}
        <div className="flex-1" />
        <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
          {focus?.unit
            ? 'Click a subtopic to practise it'
            : focus
              ? 'Click a unit to go further in'
              : 'Click a topic or a unit to open it'}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-[16px] border"
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
          {/* Rings, so the three levels read as levels rather than scatter. */}
          {[150, 240, 330].map((r) => (
            <circle
              key={r}
              cx={CENTRE}
              cy={CENTRE}
              r={r}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              opacity={live ? 0.5 : 0}
              style={{ transition: 'opacity 600ms ease' }}
            />
          ))}

          {links.map((l, i) => {
            const dim = activeTopic && l.topic && l.topic !== activeTopic
            return (
              <line
                key={i}
                x1={l.from.x}
                y1={l.from.y}
                x2={live ? l.to.x : l.from.x}
                y2={live ? l.to.y : l.from.y}
                stroke={
                  l.kind === 'spine'
                    ? 'color-mix(in oklab, var(--brand) 55%, transparent)'
                    : l.kind === 'branch'
                      ? 'color-mix(in oklab, var(--brand) 30%, transparent)'
                      : 'var(--border-strong)'
                }
                strokeWidth={l.kind === 'spine' ? 2 : l.kind === 'branch' ? 1.4 : 1}
                opacity={dim ? 0.12 : l.kind === 'twig' ? 0.65 : 1}
                style={{
                  transition: `x2 ${420 + (i % 7) * 40}ms cubic-bezier(0.16,1,0.3,1), y2 ${
                    420 + (i % 7) * 40
                  }ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease`,
                }}
              />
            )
          })}

          {/* The subject itself, and the way back out. */}
          <g
            onClick={() => setFocus(focus?.unit ? { topic: focus.topic } : null)}
            style={{ cursor: focus ? 'pointer' : 'default' }}
          >
            <circle cx={CENTRE} cy={CENTRE} r={52} fill="var(--surface)" stroke="var(--brand)" strokeWidth="1.5" />
            <text
              x={CENTRE}
              y={CENTRE + 6}
              textAnchor="middle"
              style={{ fontSize: focus ? 16 : 24, fontWeight: 600, fill: 'var(--text)' }}
            >
              {focus ? 'Back' : `${Math.round(((counts.mastered || 0) / rows.length) * 100)}%`}
            </text>
          </g>

          {nodes.map((n, i) => {
            const dim = activeTopic && n.topic !== activeTopic
            const isHovered = hovered === n.id
            // Was 9 / 5.5 / 4 on a 760 canvas, which is why the whole thing
            // read as specks rather than a diagram.
            const r = n.kind === 'topic' ? 19 : n.kind === 'unit' ? 12 : n.r
            const fill =
              n.kind === 'leaf'
                ? STATUS_COLOR[n.status] || 'var(--status-untested)'
                : 'var(--surface)'

            return (
              <g
                key={n.id}
                opacity={live ? (dim ? 0.2 : 1) : 0}
                style={{
                  transition: `opacity 300ms ease ${Math.min(i * 4, 500)}ms`,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (n.kind === 'topic') setFocus(focus?.topic === n.topic ? null : { topic: n.topic })
                  else if (n.kind === 'unit') setFocus({ topic: n.topic, unit: n.unit })
                  else if (n.kind === 'leaf') onPickSubtopic?.(n.row)
                }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isHovered ? r * 1.45 : r}
                  fill={fill}
                  stroke={n.kind === 'leaf' ? 'var(--surface-sunken)' : 'var(--border-strong)'}
                  strokeWidth={n.kind === 'leaf' ? 1.5 : 1.6}
                  style={{
                    transition:
                      'cx 520ms cubic-bezier(0.16,1,0.3,1), cy 520ms cubic-bezier(0.16,1,0.3,1), r 180ms ease',
                    filter: isHovered ? 'drop-shadow(0 0 6px color-mix(in oklab, var(--brand) 60%, transparent))' : 'none',
                  }}
                />
                {(n.kind === 'topic' ||
                  (focus && n.kind === 'unit') ||
                  (n.kind === 'leaf' && n.labelled) ||
                  isHovered) && (
                  <text
                    x={n.x}
                    y={n.y + r * (isHovered ? 1.45 : 1) + 15}
                    textAnchor="middle"
                    style={{
                      fontSize: n.kind === 'topic' ? 14 : n.kind === 'unit' ? 12 : 11,
                      fontWeight: n.kind === 'topic' ? 600 : 500,
                      fill: isHovered ? 'var(--text)' : 'var(--text-muted)',
                      // A word crossing a link is a word you decode rather
                      // than read, so it gets the background behind it.
                      paintOrder: 'stroke',
                      stroke: 'var(--surface-sunken)',
                      strokeWidth: 3.5,
                      strokeLinejoin: 'round',
                      pointerEvents: 'none',
                    }}
                  >
                    {n.label.length > 28 ? `${n.label.slice(0, 26)}…` : n.label}
                  </text>
                )}
              </g>
            )
          })}
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
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: STATUS_COLOR[key] }}
            />
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
            <p className="truncate text-[13.5px] font-medium">
              {hoveredNode.label}
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              {hoveredNode.kind === 'leaf'
                ? STATUS_LABELS[hoveredNode.status] || 'Not tested yet'
                : hoveredNode.kind === 'unit'
                  ? 'Unit'
                  : `${topics.find((t) => t.topic === hoveredNode.topic)?.size ?? 0} subtopics`}
            </p>
          </div>
        ) : (
          <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            Point at anything to read it. Click a subtopic to practise it.
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
