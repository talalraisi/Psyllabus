'use client'

import { useEffect, useRef, useState } from 'react'
import { displaySubtopic, STATUS_LABELS } from '@/lib/progress'

/**
 * A subject as an orbit, one level at a time.
 *
 * Themes circle a hub that reads how much of where you are is proved. The
 * ring turns slowly until you touch it; pick a node and it swings to the top
 * and opens a card: how it stands, and what is inside it to jump to. Open a
 * theme and the orbit becomes its units, open a unit and it becomes its
 * subtopics, and a subtopic's card starts a quiz on it.
 *
 * Equal spacing on purpose: a theme with twice the subtopics is not twice as
 * urgent. What needs work is told by the node itself, which glows.
 */

const STATUS_COLOR = {
  not_started: 'var(--status-untested)',
  decaying: 'var(--status-fading)',
  in_progress: 'var(--status-weak)',
  confident: 'var(--status-developing)',
  proficient: 'var(--status-proficient)',
  mastered: 'var(--status-mastered)',
}

/** Statuses that mean "this needs you". */
const NEEDS_WORK = new Set(['not_started', 'in_progress', 'decaying'])

const RADIUS = 38 // % of the stage
const SPEED = 4 // degrees per second

/** "C.1" + "C.1 Wave model" is "C.1 Wave model", not "C.1 C.1 Wave model". */
function unitLabel(u) {
  if (!u.code) return u.unit
  return u.unit.startsWith(u.code) ? u.unit : `${u.code} ${u.unit}`
}

/** The short code a node wears: "A" for "A. Space…", "C.1" for "C.1 Wave…". */
function shortCode(label, i) {
  const m = String(label).match(/^([A-Z]?\d*(?:\.\d+)*)[.\s]/)
  return m && m[1] ? m[1] : String(i + 1)
}

function tally(items) {
  const done = items.filter((r) => !NEEDS_WORK.has(r.status)).length
  return { total: items.length, done, todo: items.length - done, proved: items.length ? done / items.length : 0 }
}

/** What to draw, given where you are. Only one level is ever returned. */
function levelOf(rows, focus) {
  if (!focus) {
    const byTopic = new Map()
    for (const r of rows) {
      if (!byTopic.has(r.topic)) byTopic.set(r.topic, [])
      byTopic.get(r.topic).push(r)
    }
    return {
      kind: 'topic',
      items: [...byTopic.entries()].map(([topic, items]) => ({ key: topic, label: topic, items, go: { topic } })),
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
      items: [...byUnit.values()].map((u) => ({
        key: u.unit,
        label: unitLabel(u),
        items: u.items,
        go: { topic: focus.topic, unit: u.unit },
      })),
    }
  }

  return {
    kind: 'leaf',
    items: inTopic
      .filter((r) => (r.unit || r.topic) === focus.unit)
      .map((r) => ({ key: r.subtopic, label: displaySubtopic(r.subtopic), items: [r], row: r })),
  }
}

/** Shortest signed turn from a to b, in degrees. */
const turn = (a, b) => ((((b - a) % 360) + 540) % 360) - 180

export default function SubjectWeb({ subject, rows, onPickSubtopic, fill = false }) {
  const [focus, setFocus] = useState(null)
  const [active, setActive] = useState(null)
  const [held, setHeld] = useState(false) // pointer or focus on a node
  const [angle, setAngle] = useState(0)
  const angleRef = useRef(0)
  const targetRef = useRef(null)

  const level = levelOf(rows || [], focus)
  const n = level.items.length || 1
  const here = tally(level.items.flatMap((i) => i.items))
  const picked = level.items.find((i) => i.key === active) || null
  const pickedIndex = picked ? level.items.indexOf(picked) : -1
  const labelled = n <= 12

  // Bring the picked node to the top (-90deg, 12 o'clock).
  useEffect(() => {
    targetRef.current = pickedIndex >= 0 ? -90 - (pickedIndex / n) * 360 : null
  }, [pickedIndex, n])

  // One loop for both the slow turn and the swing to a picked node. It stops
  // itself when there is nothing to move, and never turns for anyone who has
  // asked their system for less motion.
  const spinning = !held && pickedIndex < 0
  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    const tick = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const target = targetRef.current
      let a = angleRef.current
      if (target != null) {
        const d = turn(a, target)
        a = Math.abs(d) < 0.2 ? target : a + d * Math.min(1, dt * 7)
      } else if (spinning && !still) {
        a = (a + SPEED * dt) % 360
      } else {
        return
      }
      angleRef.current = a
      setAngle(a)
      if (target == null || a !== target) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spinning, pickedIndex])

  const go = (next) => {
    setActive(null)
    setHeld(false)
    setFocus(next)
  }

  const pick = (item) => setActive((k) => (k === item.key ? null : item.key))

  const open = (item) => {
    if (item.row) onPickSubtopic?.(item.row)
    else go(item.go)
  }

  // What the card offers to jump to: a theme's units, a unit's subtopics,
  // or, for a subtopic, the others in its unit that still need work.
  const inside = (() => {
    if (!picked) return []
    if (level.kind === 'topic') return levelOf(rows || [], picked.go).items
    if (level.kind === 'unit') return levelOf(rows || [], picked.go).items
    return level.items.filter((i) => i.key !== picked.key && NEEDS_WORK.has(i.row.status))
  })()

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <button onClick={() => go(null)} className="font-medium" style={{ color: focus ? 'var(--brand)' : 'var(--text)' }}>
          {subject}
        </button>
        {focus && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <button
              onClick={() => go({ topic: focus.topic })}
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
        <span className="ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {here.todo > 0 ? `${here.todo} of ${here.total} need work` : `all ${here.total} proved`}
        </span>
      </div>

      <div
        className="relative mx-auto w-full rounded-[18px] border transition-[margin] duration-300"
        style={{
          borderColor: 'var(--border)',
          background: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--brand) 9%, var(--surface)) 0%, var(--surface) 62%)',
          aspectRatio: '1 / 1',
          maxWidth: fill ? 'min(100%, 74vh, 720px)' : '100%',
          // On a small stage the open card hangs past the bottom edge; make
          // room for it below rather than clipping its button.
          marginBottom: picked ? 'max(0px, calc(330px - 86%))' : 0,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setActive(null)
        }}
      >
        {/* Orbits */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full border"
          style={{ inset: `${50 - RADIUS}%`, borderColor: 'var(--border-strong)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full border border-dashed"
          style={{ inset: `${50 - RADIUS * 0.62}%`, borderColor: 'var(--border)' }}
        />

        {/* Hub: how much of where you are is proved. Gives way to the card. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-opacity duration-300"
          style={{ opacity: picked ? 0 : 1 }}
        >
          <span
            aria-hidden="true"
            className="absolute h-20 w-20 rounded-full animate-ping sm:h-24 sm:w-24"
            style={{ border: '1px solid color-mix(in srgb, var(--brand) 40%, transparent)', animationDuration: '2.6s' }}
          />
          <div
            className="relative flex h-20 w-20 flex-col items-center justify-center rounded-full sm:h-24 sm:w-24"
            style={{
              background: 'var(--brand)',
              boxShadow: '0 0 40px color-mix(in srgb, var(--brand) 45%, transparent)',
              color: 'white',
            }}
          >
            <span className="text-[22px] font-semibold leading-none tabular-nums">{Math.round(here.proved * 100)}%</span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-80">proved</span>
          </div>
        </div>

        {/* The way back out, under the hub, where the eye already is. */}
        {focus && (
          <button
            type="button"
            onClick={() => go(focus.unit ? { topic: focus.topic } : null)}
            className="btn btn-outline control-sm absolute left-1/2 top-1/2 z-[5] mt-14 -translate-x-1/2 transition-opacity duration-300 sm:mt-[4.25rem]"
            style={{ opacity: picked ? 0 : 1, pointerEvents: picked ? 'none' : undefined, background: 'var(--surface)' }}
            tabIndex={picked ? -1 : undefined}
          >
            <span aria-hidden="true">&larr;</span> Back
          </button>
        )}

        {level.items.map((item, i) => {
          const deg = (i / n) * 360 + angle
          const rad = (deg * Math.PI) / 180
          const x = 50 + RADIUS * Math.cos(rad)
          const y = 50 + RADIUS * Math.sin(rad)
          const depth = (1 + Math.sin(rad)) / 2 // 0 at the back (top), 1 at the front
          const t = tally(item.items)
          const isPicked = active === item.key
          const needs = item.row ? NEEDS_WORK.has(item.row.status) : t.todo > 0
          const colour = item.row ? STATUS_COLOR[item.row.status] || STATUS_COLOR.not_started : null
          const size = n > 18 ? 34 : n > 10 ? 40 : n > 6 ? 48 : 56

          return (
            <div
              key={item.key}
              className="absolute"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isPicked ? 50 : 10 + Math.round(depth * 10),
                opacity: isPicked ? 1 : picked ? 0.4 : 0.62 + 0.38 * depth,
                transition: 'opacity 300ms',
              }}
            >
              <button
                type="button"
                onClick={() => pick(item)}
                onPointerEnter={() => setHeld(true)}
                onPointerLeave={() => setHeld(false)}
                onFocus={() => setHeld(true)}
                onBlur={() => setHeld(false)}
                aria-expanded={isPicked}
                aria-label={`${item.label}: ${item.row ? STATUS_LABELS[item.row.status] : `${t.todo} of ${t.total} need work`}`}
                className="group relative flex items-center justify-center rounded-full transition-transform duration-300"
                style={{ width: size, height: size, transform: isPicked ? 'scale(1.35)' : undefined }}
              >
                {/* A glow for what needs you. */}
                {needs && !isPicked && (
                  <span
                    aria-hidden="true"
                    className="absolute -inset-3 rounded-full animate-pulse"
                    style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--text) 30%, transparent) 50%, transparent 72%)' }}
                  />
                )}
                {/* How much is proved, as an arc. */}
                {!item.row && (
                  <svg aria-hidden="true" viewBox="0 0 40 40" className="absolute -inset-[5px] h-[calc(100%+10px)] w-[calc(100%+10px)] -rotate-90">
                    <circle cx="20" cy="20" r="18.5" fill="none" stroke="var(--border)" strokeWidth="1.5" />
                    <circle
                      cx="20"
                      cy="20"
                      r="18.5"
                      fill="none"
                      stroke="var(--status-proficient)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      pathLength="100"
                      strokeDasharray={`${t.proved * 100} 100`}
                    />
                  </svg>
                )}
                <span
                  className="relative flex h-full w-full items-center justify-center rounded-full border-2 text-[11px] font-semibold tabular-nums transition-colors duration-300"
                  style={
                    isPicked && item.row
                      ? { background: colour, color: 'var(--text)', borderColor: 'var(--text)', boxShadow: `0 0 28px color-mix(in srgb, ${colour} 60%, transparent)` }
                      : isPicked
                      ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)', boxShadow: '0 6px 24px color-mix(in srgb, var(--text) 25%, transparent)' }
                      : item.row
                        ? { background: colour, color: 'var(--text)', borderColor: 'color-mix(in srgb, var(--text) 18%, transparent)' }
                        : { background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border-strong)' }
                  }
                >
                  {item.row ? '' : shortCode(item.label, i)}
                </span>
              </button>

              {(labelled || isPicked) && !(picked && !isPicked) && (
                <span
                  className={`pointer-events-none absolute left-1/2 top-full ${isPicked ? 'mt-4' : 'mt-2'} max-w-[9rem] -translate-x-1/2 truncate text-center text-[11.5px] font-medium`}
                  style={{ color: isPicked ? 'var(--text)' : 'var(--text-muted)' }}
                >
                  {item.label.replace(/^[A-Z]?\d*(?:\.\d+)*[.\s]+/, '') || item.label}
                </span>
              )}

              {isPicked && (
                <div
                  className="absolute left-1/2 top-full mt-11 w-[min(17rem,72vw)] -translate-x-1/2 rounded-[14px] border p-4 text-left shadow-xl"
                  style={{
                    borderColor: 'var(--border-strong)',
                    background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
                    backdropFilter: 'blur(14px)',
                  }}
                >
                  <span aria-hidden="true" className="absolute -top-3 left-1/2 h-3 w-px" style={{ background: 'var(--border-strong)' }} />
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                      style={{
                        background: `color-mix(in srgb, ${item.row ? colour : needs ? 'var(--status-weak)' : 'var(--status-proficient)'} 22%, transparent)`,
                        color: 'var(--text)',
                      }}
                    >
                      {item.row ? STATUS_LABELS[item.row.status] : needs ? `${t.todo} need work` : 'All proved'}
                    </span>
                    {!item.row && (
                      <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                        {t.done}/{t.total}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[13.5px] font-semibold leading-snug">{item.label}</p>

                  {!item.row && (
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-sunken)' }}>
                      <div className="h-full rounded-full" style={{ width: `${t.proved * 100}%`, background: 'var(--status-proficient)' }} />
                    </div>
                  )}

                  {inside.length > 0 && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                      <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
                        {level.kind === 'leaf' ? 'Also needs work' : 'Inside'}
                      </p>
                      <div className="flex max-h-[6.5rem] flex-wrap gap-1 overflow-y-auto">
                        {inside.slice(0, 12).map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => {
                              if (level.kind === 'leaf') setActive(c.key)
                              else if (c.row) onPickSubtopic?.(c.row)
                              else go(c.go)
                            }}
                            className="max-w-full truncate rounded-[6px] border px-2 py-0.5 text-[11px] hover:bg-[var(--surface-sunken)]"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }}
                          >
                            {c.label} <span aria-hidden="true">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button type="button" onClick={() => open(item)} className="btn btn-solid control-sm mt-3 w-full">
                    {item.row ? 'Practise' : `Open ${level.kind === 'topic' ? 'units' : 'subtopics'}`}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
