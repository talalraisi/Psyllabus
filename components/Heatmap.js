'use client'

import Link from 'next/link'
import { getSlugForSubject } from '@/lib/subject-map'
import { STATUS_COLORS } from '@/lib/progress'

export default function Heatmap({ items, subjects }) {
  const grouped = subjects.reduce((acc, subject) => {
    acc[subject] = items.filter((i) => i.subject === subject)
    return acc
  }, {})

  const hasAny = subjects.some((s) => grouped[s]?.length > 0)

  if (!hasAny) {
    return (
      <section className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-[#1a2e1e] mb-2">Progress Heatmap</h2>
        <p className="text-[#6b7280]">
          Open a subject syllabus to start tracking your progress. Each dot represents one subtopic.
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1a2e1e]">Progress Heatmap</h2>
          <p className="text-[#6b7280] text-sm mt-1">
            Every subtopic across your subjects — see gaps at a glance
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[#6b7280]">
          {Object.entries({
            'Not started': STATUS_COLORS.not_started,
            'In progress': STATUS_COLORS.in_progress,
            Confident: STATUS_COLORS.confident,
            Mastered: STATUS_COLORS.mastered,
          }).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {subjects.map((subject) => {
          const subtopics = grouped[subject] || []
          if (!subtopics.length) return null

          const slug = getSlugForSubject(subject)
          const mastered = subtopics.filter((s) => s.status === 'mastered').length

          return (
            <div
              key={subject}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[#1a2e1e]">{subject}</h3>
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
              <div className="flex flex-wrap gap-1.5">
                {subtopics.map((item) => (
                  <div
                    key={item.id || `${item.topic}-${item.subtopic}`}
                    className={`w-3.5 h-3.5 rounded-sm ${STATUS_COLORS[item.status] || STATUS_COLORS.not_started} transition-colors`}
                    title={`${item.subtopic}: ${item.status.replace('_', ' ')}`}
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
