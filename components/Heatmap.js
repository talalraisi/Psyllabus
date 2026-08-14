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
      <section className="bg-white rounded-xl p-8 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="text-base font-semibold text-[#1a2e1e] mb-1">Heatmap</h2>
        <p className="text-sm text-[#6b7280]">
          Open a subject syllabus to start tracking your progress. Each square represents one subtopic.
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">
          Heatmap
        </h2>
        <div className="flex flex-wrap gap-3 text-xs text-[#6b7280]">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <span key={status} className="flex items-center gap-1.5">
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
              className="bg-white rounded-xl p-5 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-[#1a2e1e]">{subject}</h3>
                  <p className="text-xs text-[#6b7280] mt-0.5">
                    {mastered}/{subtopics.length} mastered
                  </p>
                </div>
                <Link
                  href={`/dashboard/syllabus/${slug}`}
                  className="text-sm font-medium text-[#2D6A4F] hover:underline"
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
