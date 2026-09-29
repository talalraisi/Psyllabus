'use client'

import { useState } from 'react'
import { displaySubtopic, STATUS_LABELS } from '@/lib/progress'

/**
 * A subject, one level at a time.
 *
 * The first version drew the whole course at once: every theme, every unit and
 * every subtopic on three rings, sixty-eight nodes joined by lines that crossed
 * each other. It looked like a great deal of work had gone into it and it
 * answered no question a student actually has. Three things were wrong with it
 * and they were all the same thing.
 *
 * It was *too detailed*, because everything was on screen whether you had asked
 * for it or not. It was *small*, because sixty-eight things sharing one circle
 * leaves each of them four pixels and its name truncated to "A. Space, time and
 * mot…". And the symmetry was *weird*, because each theme's sector was sized in
 * proportion to how many subtopics it held, so the whole diagram sat lopsided
 * for a reason nobody could see.
 *
 * So: one ring, evenly divided, showing only the children of wherever you are.
 * Six themes to begin with, each big enough to carry its full name and a
 * reading of how much of it is proved. Press one and it becomes its units.
 * Press again and it becomes its subtopics. Depth is still there; it is just
 * no longer all in your face at once.
 *
 * Equal sectors are the point, not a simplification. A theme twice the size of
 * another is not twice as urgent, and sizing by count made the map about the
 * syllabus's shape when it needed to be about yours.
 */

const STATUS_COLOR = {
  not_started: 'var(--status-untested)',
  decaying: 'var(--status-fading)',
  in_progress: 'var(--status-weak)',
  confident: 'var(--status-developing)',
  proficient: 'var(--status-proficient)',
  mastered: 'var(--status-mastered)',
}

/** Statuses that mean "this needs you". The number on a node counts these. */
const NEEDS_WORK = new Set(['not_started', 'in_progress', 'decaying'])

const SIZE = 620
const CENTRE = SIZE / 2
const RING = 208
const HUB = 66

/** Polar to cartesian, 12 o'clock as zero so the first item is on top. */
function at(angle, radius) {
  const rad = (angle - 90) * (Math.PI / 180)
  // Rounded: the server and the browser disagree in the last decimal of a
  // float and React calls that a hydration mismatch.
  const r = (n) => Math.round(n * 100) / 100
  return { x: r(CENTRE + Math.cos(rad) * radius), y: r(CENTRE + Math.sin(rad) * radius) }
}

/** "C.1" + "C.1 Wave model" is "C.1 Wave model", not "C.1 C.1 Wave model". */
function unitLabel(u) {
  if (!u.code) return u.unit
  return u.unit.startsWith(u.code) ? u.unit : `${u.code} ${u.unit}`
}

/** Proportion proved, and how many still want work. */
function tally(items) {
  const done = items.filter((r) => !NEEDS_WORK.has(r.status)).length
  return { total: items.length, done, todo: items.length - done, proved: items.length ? done / items.length : 0 }
}

/**
 * What to draw, given where you are.
 *
 * focus is null for the themes, {topic} for that theme's units, and
 * {topic, unit} for that unit's subtopics. Only one level is ever returned.
 */
function levelOf(rows, focus) {
  if (!focus) {
    const byTopic = new Map()
    for (const r of rows) {
      if (!byTopic.has(r.topic)) byTopic.set(r.topic, [])
      byTopic.get(r.topic).push(r)
    }
    return {
      kind: 'topic',
      hub: null,
      items: [...byTopic.entries()].map(([topic, items]) => ({
        key: topic, label: topic, items, go: { topic },
      })),
    }
  }

  const inTopic = rows.filter((r) => r.topic === focus.topic)

  if (!focus.unit) {
    const byUnit = new Map()
    for (const r of inTopic) {
      const unit = r.unit || r.topic
      if (!byUnit.has(unit)) byUnit.set(unit, { unit, code: r.code, items: [] })
      byUnit.get(unit).items.push(r)
    }
    return {
      kind: 'unit',
      hub: focus.topic,
      items: [...byUnit.values()].map((u) => ({
        key: u.unit, label: unitLabel(u), items: u.items, go: { topic: focus.topic, unit: u.unit },
      })),
    }
  }

  const inUnit = inTopic.filter((r) => (r.unit || r.topic) === focus.unit)
  return {
    kind: 'leaf',
    hub: focus.unit,
    items: inUnit.map((r) => ({
      key: `${r.subtopic}`, label: displaySubtopic(r.subtopic), items: [r], row: r,
    })),
  }
}

export default function SubjectWeb({ subject, rows, onPickSubtopic, fill = false }) {
  const [focus, setFocus] = useState(null)
  const [hover, setHover] = useState(null)

  const level = levelOf(rows || [], focus)
  const n = level.items.length || 1
  const whole = tally(rows || [])
  const here = tally(level.items.flatMap((i) => i.items))

  /* Nodes grow into the space they have. Six themes get to be large; thirty
     subtopics cannot, but they still get more room than they did sharing a rim
     with everything else in the course. */
  const step = 360 / n
  const nodeR = Math.max(13, Math.min(34, (Math.PI * RING) / n / 1.9))
  const labelled = n <= 14

  const up = () =>
    setFocus((f) => (!f ? null : f.unit ? { topic: f.topic } : null))

  return (
    <div className="flex flex-col">
      {/* Where you are, and the way back. A diagram you can walk into needs to
          say so in words as well as by redrawing itself. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <button
          onClick={() => setFocus(null)}
          className="font-medium"
          style={{ color: focus ? 'var(--brand)' : 'var(--text)' }}
        >
          {subject}
        </button>
        {focus && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <button
              onClick={() => setFocus({ topic: focus.topic })}
              className="font-medium"
              style={{ color: focus.unit ? 'var(--brand)' : 'var(--text)' }}
            >
              {focus.topic}
            </button>
          </>
        )}
        {focus?.unit && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span className="font-medium">{focus.unit}</span>
          </>
        )}
        <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
          {here.todo > 0 ? `${here.todo} of ${here.total} need work` : `all ${here.total} proved`}
        </span>
      </div>

      <div
        className="relative rounded-[14px] border"
        style={{
          borderColor: 'var(--border-strong)',
          background: 'var(--surface)',
          ...(fill ? { aspectRatio: '1 / 1', maxHeight: 'min(74vh, 720px)' } : null),
        }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={fill ? 'h-full w-full' : 'h-auto w-full'}
          role="img"
          aria-label={`${subject}, ${Math.round(whole.proved * 100)}% proved: ${here.todo} of ${here.total} shown need work`}
        >
          {/* One faint guide ring. The old version drew a line from the centre
              to every node, which at sixty-eight nodes was a ball of string. */}
          <circle
            cx={CENTRE} cy={CENTRE} r={RING}
            fill="none" stroke="var(--border)" strokeWidth="1"
          />

          {level.items.map((item, i) => {
            const p = at(i * step, RING)
            const t = tally(item.items)
            const isLeaf = level.kind === 'leaf'
            const colour = isLeaf
              ? STATUS_COLOR[item.row.status] || STATUS_COLOR.not_started
              : 'var(--surface-sunken)'
            const active = hover === item.key

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHover(item.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  if (isLeaf) onPickSubtopic?.(item.row)
                  else setFocus(item.go)
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* How much of this is proved, as an arc round the node.
                    One fact, read at a glance, no legend needed. */}
                {!isLeaf && (
                  <circle
                    cx={p.x} cy={p.y} r={nodeR + 5}
                    fill="none"
                    stroke="var(--status-proficient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * (nodeR + 5) * t.proved} ${2 * Math.PI * (nodeR + 5)}`}
                    transform={`rotate(-90 ${p.x} ${p.y})`}
                    opacity="0.85"
                  />
                )}
                <circle
                  cx={p.x} cy={p.y} r={nodeR}
                  fill={colour}
                  stroke={active ? 'var(--text)' : 'var(--border-strong)'}
                  strokeWidth={active ? 2 : 1}
                />
                {!isLeaf && (
                  <text
                    x={p.x} y={p.y}
                    textAnchor="middle" dominantBaseline="central"
                    style={{ fontSize: nodeR * 0.8, fontWeight: 600, fill: 'var(--text)' }}
                  >
                    {t.todo || '✓'}
                  </text>
                )}

                {labelled && (
                  <text
                    x={p.x}
                    y={p.y + nodeR + 20}
                    textAnchor="middle"
                    style={{ fontSize: 13, fill: 'var(--text-body)' }}
                  >
                    {item.label.length > 30 ? `${item.label.slice(0, 29)}…` : item.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* The hub reads whatever you are standing in, not the subject.
              Left on the whole-subject figure it said 44% while you were
              inside one theme, which everybody read as that theme's 44%. */}
          <circle
            cx={CENTRE} cy={CENTRE} r={HUB}
            fill="var(--surface-sunken)" stroke="var(--border-strong)" strokeWidth="1"
          />
          <text
            x={CENTRE} y={CENTRE - 8}
            textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 30, fontWeight: 600, fill: 'var(--text)' }}
          >
            {Math.round(here.proved * 100)}%
          </text>
          <text
            x={CENTRE} y={CENTRE + 18}
            textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 11, fill: 'var(--text-faint)' }}
          >
            proved
          </text>
        </svg>

        {/* Read-out rather than a tooltip: it appears in the same place every
            time, it is there for keyboard users, and it does not vanish. */}
        <div
          className="absolute inset-x-0 bottom-0 border-t px-4 py-3 text-[13px]"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {(() => {
            const item = level.items.find((i) => i.key === hover)
            if (!item) {
              return (
                <span style={{ color: 'var(--text-faint)' }}>
                  {level.kind === 'leaf'
                    ? 'Press a subtopic to open it.'
                    : `Press one to open its ${level.kind === 'topic' ? 'units' : 'subtopics'}.`}
                </span>
              )
            }
            const t = tally(item.items)
            return (
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{item.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {level.kind === 'leaf'
                    ? STATUS_LABELS[item.row.status]
                    : t.todo > 0
                      ? `${t.todo} of ${t.total} need work`
                      : `all ${t.total} proved`}
                </span>
              </span>
            )
          })()}
        </div>
      </div>

      {focus && (
        <button onClick={up} className="btn btn-quiet control-sm mt-3 self-start">
          Back
        </button>
      )}
    </div>
  )
}
