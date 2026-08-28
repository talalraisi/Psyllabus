'use client'

import Link from 'next/link'
import { getSlugForSubject } from '@/lib/subject-map'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/progress'

export default function Heatmap({ items, subjects }) {
  const grouped = subjects.reduce((acc, subject) => {
    acc[subject] = items.filter((i) => i.subject === subject)
    return acc
  }, {})

  const hasAny = subjects.some((s) => grouped[s]?.length > 0)

  if (!hasAny) {
    return (
      <section className="surface p-8">
        <h2 className="text-base font-semibold text-[var(--text)] mb-1">Heatmap</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Open a subject syllabus to start tracking your progress. Each square represents one subtopic.
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <h2 className="t-overline">
          Heatmap
        </h2>
        <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <span key={status} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-[3px] ${STATUS_COLORS[status]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {subjects.map((subject) => {
          const subtopics = grouped[subject] || []
          if (!subtopics.length) return null

          const slug = getSlugForSubject(subject)
          const mastered = subtopics.filter((s) => s.status === 'mastered').length

          return (
            <div
              key={subject}
              className="surface p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text)]">{subject}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {mastered}/{subtopics.length} mastered
                  </p>
                </div>
                <Link
                  href={`/dashboard/syllabus/${slug}`}
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  Open syllabus →
                </Link>
              </div>
              <div className="flex flex-wrap gap-1">
                {subtopics.map((item) => (
                  <div
                    key={item.id || `${item.topic}-${item.subtopic}`}
                    className={`w-3.5 h-3.5 rounded-[3px] ${STATUS_COLORS[item.status] || STATUS_COLORS.not_started} transition-colors`}
                    title={`${item.subtopic}: ${STATUS_LABELS[item.status] || 'Untested'}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
