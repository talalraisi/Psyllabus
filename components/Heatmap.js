'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSlugForSubject } from '@/lib/subject-map'
import { STATUS_LABELS, displaySubtopic } from '@/lib/progress'
import { EmptyState } from '@/components/PageShell'

/** Status keys are stored in the database; the palette is named by meaning. */
const STATUS_VAR = {
  not_started: 'var(--status-untested)',
  decaying: 'var(--status-fading)',
  in_progress: 'var(--status-weak)',
  confident: 'var(--status-developing)',
  proficient: 'var(--status-proficient)',
  mastered: 'var(--status-mastered)',
}

/**
 * The whole syllabus as one picture, one square per subtopic.
 *
 * The squares used to carry a title attribute and nothing else, which meant the
 * only way to find out what a red square was took a hover, a wait, and a tooltip
 * that vanished. The readout above the grid does the same job immediately and
 * for keyboard users, and it is the same interaction the landing page promises.
 */
function SubjectGrid({ subject, subtopics }) {
  const [at, setAt] = useState(null)
  const active = at === null ? null : subtopics[at]
  const mastered = subtopics.filter((s) => s.status === 'mastered').length
  const slug = getSlugForSubject(subject)

  return (
    <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-4 flex min-h-[42px] items-start justify-between gap-4">
        {active ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold">
                {displaySubtopic(active.subtopic)}
              </p>
              <p className="mt-0.5 truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                {active.topic}
              </p>
            </div>
            <p
              className="shrink-0 text-[12.5px] font-semibold"
              style={{ color: STATUS_VAR[active.status] || STATUS_VAR.not_started }}
            >
              {STATUS_LABELS[active.status] || 'Untested'}
            </p>
          </>
        ) : (
          <>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold">{subject}</p>
              <p className="mt-0.5 text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                {mastered} of {subtopics.length} mastered · point at a square
              </p>
            </div>
            <Link
              href={`/dashboard/syllabus/${slug}`}
              className="shrink-0 text-[13px] font-medium text-[var(--brand)] hover:underline"
            >
              Open syllabus
            </Link>
          </>
        )}
      </div>

      <div
        className="cells-in flex flex-wrap gap-[5px]"
        onMouseLeave={() => setAt(null)}
      >
        {subtopics.map((item, i) => (
          <button
            key={item.id || `${item.topic}-${item.subtopic}`}
            onMouseEnter={() => setAt(i)}
            onFocus={() => setAt(i)}
            onBlur={() => setAt(null)}
            aria-label={`${displaySubtopic(item.subtopic)}, ${STATUS_LABELS[item.status] || 'Untested'}`}
            className="h-[14px] w-[14px] rounded-[3px] transition-transform duration-100 hover:scale-[1.2]"
            style={{
              background: STATUS_VAR[item.status] || STATUS_VAR.not_started,
              outline: at === i ? '2px solid var(--text)' : 'none',
              outlineOffset: '1px',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Heatmap({ items, subjects }) {
  const grouped = subjects.reduce((acc, subject) => {
    acc[subject] = items.filter((i) => i.subject === subject)
    return acc
  }, {})

  const hasAny = subjects.some((s) => grouped[s]?.length > 0)

  if (!hasAny) {
    return (
      <EmptyState
        title="Nothing to map yet"
        description="One square per subtopic, coloured by your quiz answers. Take a quiz to start it."
      />
    )
  }

  return (
    <section>
      <div
        className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3 border-b pb-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.012em]">Heatmap</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <span
              key={status}
              className="flex items-center gap-1.5 text-[11.5px]"
              style={{ color: 'var(--text-muted)' }}
            >
              <span
                className="h-[9px] w-[9px] rounded-[2px]"
                style={{ background: STATUS_VAR[status] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {subjects.map((subject) =>
          grouped[subject]?.length ? (
            <SubjectGrid key={subject} subject={subject} subtopics={grouped[subject]} />
          ) : null
        )}
      </div>
    </section>
  )
}
