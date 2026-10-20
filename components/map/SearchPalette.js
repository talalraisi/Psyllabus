'use client'

import { useEffect, useRef, useState } from 'react'
import { search, pathTo, statusLabel } from '@/lib/subject-graph'
import { STATUS_VAR } from '@/components/map/MapCanvas'

/**
 * Find anything in the subject: ⌘K or / opens it, typing narrows it, the
 * arrows move, Enter goes there. Going there opens the right level of the
 * map with the result selected, the same as clicking it in the outline.
 */
export default function SearchPalette({ graph, open, onClose, onGo }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const results = q.trim() ? search(graph, q, 12) : []

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => input.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  const go = (n) => {
    if (!n) return
    onGo(n.id)
    setQ('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search the subject">
      <div className="absolute inset-0" style={{ background: 'rgb(0 0 0 / 0.35)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div className="pop-enter relative w-full max-w-lg overflow-hidden rounded-[18px] border shadow-2xl" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: 'var(--border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: 'var(--text-faint)' }} aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(results.length - 1, a + 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
              else if (e.key === 'Enter') (e.preventDefault(), go(results[active]))
              else if (e.key === 'Escape') (e.preventDefault(), onClose())
            }}
            placeholder={`Search ${graph.subject}`}
            aria-label={`Search ${graph.subject}`}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="map-search-results"
            aria-activedescendant={results[active] ? `map-hit-${active}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
          />
          <kbd className="rounded-[6px] border px-1.5 py-0.5 text-[10.5px]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-faint)' }}>
            esc
          </kbd>
        </div>
        <ul id="map-search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {q.trim() && !results.length && (
            <li className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
              Nothing in {graph.subject} matches that.
            </li>
          )}
          {!q.trim() && (
            <li className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
              Topics, units and subtopics, by name or number.
            </li>
          )}
          {results.map((n, i) => (
            <li
              key={n.id}
              id={`map-hit-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onClick={() => go(n)}
              className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5"
              style={{ background: i === active ? 'var(--surface-sunken)' : undefined }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_VAR[n.status] }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{n.title}</span>
                <span className="block truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
                  {pathTo(graph, n.id).slice(1, -1).map((p) => p.title).join(' › ') || graph.subject}
                </span>
              </span>
              <span className="shrink-0 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
                {statusLabel(n.status)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
