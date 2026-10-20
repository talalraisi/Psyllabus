'use client'

import { useMemo, useState } from 'react'
import { needsWork, pathTo } from '@/lib/subject-graph'
import { STATUS_VAR } from '@/components/map/MapCanvas'
import { Chevron } from '@/components/Select'

/**
 * The subject as a list, beside the map and in step with it: the branch you
 * are in is open and marked, the node you selected is highlighted, and
 * clicking anything takes the map to it. Filters to a word as you type, and
 * to what needs work when Weak areas is on.
 */
export default function Outline({ graph, focusId, selectedId, weakOnly, onWeakOnly, onGo }) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const root = graph.nodes.get(graph.rootId)
  const onPath = useMemo(() => new Set(pathTo(graph, selectedId || focusId).map((n) => n.id)), [graph, selectedId, focusId])

  const q = filter.trim().toLowerCase()
  const matches = (n) => n.title.toLowerCase().includes(q)
  const keep = (id) => {
    const n = graph.nodes.get(id)
    if (weakOnly && !needsWork(n)) return false
    if (!q) return true
    return matches(n) || n.childIds.some(keep)
  }

  const toggle = (id) =>
    setOpen((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const row = (id, depth) => {
    if (!keep(id)) return null
    const n = graph.nodes.get(id)
    const branch = n.childIds.length > 0
    const expanded = branch && (open.has(id) || onPath.has(id) || Boolean(q))
    const here = id === selectedId || (id === focusId && !selectedId)
    return (
      <li key={id}>
        <div
          className="group flex items-center rounded-[8px] transition-colors hover:bg-[var(--surface-sunken)]"
          style={{ paddingLeft: depth * 12, background: here ? 'var(--brand-tint)' : undefined }}
        >
          {branch ? (
            <button
              type="button"
              onClick={() => toggle(id)}
              aria-label={expanded ? `Fold ${n.title}` : `Unfold ${n.title}`}
              aria-expanded={expanded}
              className="flex h-7 w-6 shrink-0 items-center justify-center"
              style={{ color: 'var(--text-faint)' }}
            >
              <Chevron open={expanded} style={{ transform: expanded ? 'none' : 'rotate(-90deg)' }} />
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => onGo(id)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-[12.5px]"
            style={{ color: here ? 'var(--text)' : 'var(--text-body)', fontWeight: here || n.kind === 'topic' ? 600 : 450 }}
          >
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: STATUS_VAR[n.status] }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{n.title}</span>
            {branch && (
              <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                {n.tally.proved}/{n.tally.total}
              </span>
            )}
          </button>
        </div>
        {expanded && <ul>{n.childIds.map((c) => row(c, depth + 1))}</ul>}
      </li>
    )
  }

  const t = root.tally
  const share = (v) => `${(v / Math.max(1, t.total)) * 100}%`

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
          Progress
        </p>
        <p className="mt-1.5 text-[13px]">
          <span className="font-semibold tabular-nums">{t.proved}</span>
          <span style={{ color: 'var(--text-muted)' }}> of {t.total} subtopics proved</span>
        </p>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
          <span style={{ width: share(t.proved), background: 'var(--status-mastered)' }} />
          <span style={{ width: share(t.assessed - t.proved - t.weak - t.fading), background: 'var(--status-developing)' }} />
          <span style={{ width: share(t.fading), background: 'var(--status-fading)' }} />
          <span style={{ width: share(t.weak), background: 'var(--status-weak)' }} />
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {t.assessed} tested · {t.weak} weak · {t.fading} fading
        </p>

        <div className="mt-4 flex rounded-full p-0.5" style={{ background: 'var(--surface-sunken)' }} role="group" aria-label="Show">
          {[
            [false, 'All topics'],
            [true, 'Weak areas'],
          ].map(([v, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={weakOnly === v}
              onClick={() => onWeakOnly(v)}
              className="flex-1 rounded-full py-1.5 text-[12px] font-semibold transition-colors"
              style={weakOnly === v ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.2)' } : { color: 'var(--text-muted)' }}
            >
              {label}
              {v && t.weak + t.fading > 0 ? ` · ${t.weak + t.fading}` : ''}
            </button>
          ))}
        </div>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter the outline"
          aria-label="Filter the outline"
          className="input mt-3 h-9 rounded-full px-3.5 text-[16px] sm:text-[13px]"
        />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Syllabus outline">
        <ul>{root.childIds.map((id) => row(id, 0))}</ul>
        {weakOnly && t.weak + t.fading === 0 && (
          <p className="px-3 py-4 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            Nothing is weak or fading. Untested topics are not counted as weak.
          </p>
        )}
      </nav>
    </div>
  )
}
