'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { getResourcesForSubtopic } from '@/lib/resources'

export default function ResourceHubDrawer({ open, onClose, subject, topic, subtopic, hlOnly, quizHref }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !subtopic) return null

  const resources = getResourcesForSubtopic({ subject, subtopic })

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Resource hub">
      <div
        className="absolute inset-0 bg-black/20 transition-opacity"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] border-l border-[#f0f0f0] flex flex-col">
        <div className="p-6 border-b border-[#f3f4f6]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-[#9ca3af]">{topic}</p>
              <h2 className="text-base font-semibold text-[#1a2e1e] mt-0.5">{subtopic}</h2>
              {hlOnly && (
                <span className="inline-block mt-2 rounded-full bg-[#E8D5B0] px-2 py-0.5 text-[11px] font-medium text-[#1a2e1e]">
                  HL only
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close resource hub"
              className="shrink-0 w-8 h-8 rounded-lg text-[#6b7280] hover:bg-[#f9fafb] transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">
            Resources
          </p>
          {resources.map((r) => (
            <a
              key={r.key}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-[#f0f0f0] p-4 hover:border-[#e0e0e0] hover:bg-[#f9fafb] transition-colors"
            >
              <p className="text-sm font-semibold text-[#1a2e1e]">{r.label}</p>
              <p className="text-sm text-[#6b7280] mt-1">{r.description}</p>
              <span className="inline-block mt-2 text-sm font-medium text-[#2D6A4F]">
                {r.cta} →
              </span>
            </a>
          ))}
        </div>

        {quizHref && (
          <div className="p-6 border-t border-[#f3f4f6]">
            <Link
              href={quizHref}
              className="block w-full text-center py-2.5 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors"
            >
              Practice quiz on this subtopic
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}
