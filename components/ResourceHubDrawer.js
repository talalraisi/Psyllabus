'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { getResourcesForSubtopic } from '@/lib/resources'
import { IconClose } from '@/components/Icons'

function ResourceLink({ r }) {
  return (
    <a
      href={r.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-[var(--r-md)] border border-[var(--border)] p-4 transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]"
    >
      <div className="flex items-center gap-2">
        <span className="t-overline">{r.kindLabel}</span>
        <span className="t-caption">· {r.provider}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-[var(--text)]">{r.title}</p>
      {r.note && <p className="mt-1 text-sm text-[var(--text-muted)]">{r.note}</p>}
    </a>
  )
}

export default function ResourceHubDrawer({
  open,
  onClose,
  subject,
  topic,
  subtopic,
  hlOnly,
  quizHref,
}) {
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

  const resources = getResourcesForSubtopic({ subject, subtopic, topic })
  const picked = resources.filter((r) => r.curated)
  const searches = resources.filter((r) => !r.curated)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Resources">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-raised)]">
        <div className="border-b border-[var(--border)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="t-caption">{topic}</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--text)]">{subtopic}</h2>
              {hlOnly && (
                <span className="mt-2 inline-block rounded-full bg-[var(--sand)] px-2 py-1 text-[11px] font-medium text-[var(--text)]">
                  HL only
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close resources"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
            >
              <IconClose width={18} height={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-6">
          {picked.length > 0 && (
            <>
              <p className="t-overline">Recommended</p>
              {picked.map((r) => (
                <ResourceLink key={r.key} r={r} />
              ))}
            </>
          )}

          <p className="t-overline pt-2">Find more</p>
          {searches.map((r) => (
            <ResourceLink key={r.key} r={r} />
          ))}

          <p className="t-caption pt-2">
            Links open on the publisher&rsquo;s own site. PSyllabus does not host their material.
          </p>
        </div>

        {quizHref && (
          <div className="border-t border-[var(--border)] p-6">
            <Link href={quizHref} className="btn btn-solid control-md w-full">
              Practice quiz on this subtopic
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}
