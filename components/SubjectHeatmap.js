'use client'

import { useState } from 'react'
import { displaySubtopic, STATUS_LABELS } from '@/lib/progress'

const TONE = {
  not_started: 'var(--status-untested)',
  in_progress: 'var(--status-weak)',
  decaying: 'var(--status-fading)',
  confident: 'var(--status-developing)',
  proficient: 'var(--status-proficient)',
  mastered: 'var(--status-mastered)',
}

const NEEDS_WORK = new Set(['not_started', 'in_progress', 'decaying'])

function tally(items) {
  const todo = items.filter((r) => NEEDS_WORK.has(r.status)).length
  return {
    total: items.length,
    todo,
    pct: items.length ? Math.round(((items.length - todo) / items.length) * 100) : 0,
  }
}

/**
 * Every subtopic in the course, one cell each.
 *
 * This was cut, and cutting it was wrong. Five hundred squares is the only
 * thing on the page that shows the whole shape of a year at once, and the
 * reason it read badly was never the idea — it was that it arrived as one
 * undifferentiated field of tiny squares with a tooltip.
 *
 * So the cells are bigger, they are grouped under the topic they belong to
 * with its own count, and what you are pointing at is named in a line that
 * holds its place at the top rather than a tooltip that appears near the
 * cursor and vanishes. Keyboard users get the same readout, which a title
 * attribute never gave them.
 */
function Subject({ subject, items }) {
  const [at, setAt] = useState(null)
  const topics = [...new Set(items.map((r) => r.topic))].map((topic) => ({
    topic,
    items: items.filter((r) => r.topic === topic),
  }))
  const t = tally(items)

  return (
    <div
      className="elev rounded-[16px] border p-5 md:p-6"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      {/* The readout keeps its line whether or not anything is under the
          pointer, so the grid below never shifts up and down as you move. */}
      <div className="mb-5 flex min-h-[40px] flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold tracking-[-0.015em]">{subject}</span>
          <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            {at ? displaySubtopic(at.subtopic) : `${t.total} subtopics`}
          </span>
        </span>
        <span className="shrink-0 text-[12.5px] font-medium" style={{ color: at ? TONE[at.status] : 'var(--text-faint)' }}>
          {at ? STATUS_LABELS[at.status] : `${t.pct}% proved`}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {topics.map(({ topic, items: ti }) => {
          const tt = tally(ti)
          return (
            <div key={topic}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {topic}
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                  {tt.todo > 0 ? `${tt.todo} left` : 'done'}
                </span>
              </div>
              <div className="flex flex-wrap gap-[5px]">
                {ti.map((row) => (
                  <button
                    key={row.subtopic}
                    onMouseEnter={() => setAt(row)}
                    onMouseLeave={() => setAt(null)}
                    onFocus={() => setAt(row)}
                    onBlur={() => setAt(null)}
                    aria-label={`${displaySubtopic(row.subtopic)}: ${STATUS_LABELS[row.status]}`}
                    className="h-[18px] w-[18px] rounded-[4px] transition-transform duration-150 hover:scale-125"
                    style={{ background: TONE[row.status] }}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SubjectHeatmap({ items, subjects }) {
  const bySubject = (subjects || [])
    .map((subject) => ({ subject, items: items.filter((r) => r.subject === subject) }))
    .filter((s) => s.items.length)

  if (!bySubject.length) return null

  return (
    <section className="mt-14">
      <h2 className="text-[17px] font-semibold tracking-[-0.018em]">Every subtopic</h2>
      <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
        The whole year, grouped by topic. Point at any cell to read it.
      </p>
      <div className="mt-5 flex flex-col gap-4">
        {bySubject.map(({ subject, items: si }) => (
          <Subject key={subject} subject={subject} items={si} />
        ))}
      </div>
    </section>
  )
}
