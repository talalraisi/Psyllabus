'use client'

import { useMemo, useState } from 'react'
import OrbitCanvas from '@/components/map/OrbitCanvas'
import { STATUS_VAR } from '@/components/map/MapCanvas'
import { statusLabel } from '@/lib/subject-graph'
import { shortName, subjectCode, levelOf } from '@/lib/subject-short'

/**
 * The progress page and the top of the subject map: you, with every subject
 * you take circling you. What the old Progress page held (counts by status,
 * the heatmap) follows below, as children.
 *
 * Each subject is a planet with its code in it, its edge where you stand in
 * it. The panel beside the orbit is the overview of you: how much of the
 * whole course is proved, which subject needs you most, which is strongest,
 * and every subject as a line. Select a subject to read it; open it (or
 * double-click the planet) to walk into its own map.
 *
 * graphs: [{ subject, graph }] from lib/subject-graph.js, one per subject.
 */

const firstName = (name = '') => name.trim().split(/\s+/)[0] || ''

function Bar({ tally }) {
  const pct = (n) => `${Math.min(100, (n / Math.max(1, tally.total)) * 100)}%`
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }} aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(tally.assessed), background: 'color-mix(in oklab, var(--brand) 30%, var(--surface-sunken))' }} />
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(tally.proved), background: 'var(--brand)' }} />
    </span>
  )
}

export default function YouMap({ graphs, name = '', onOpen, children = null }) {
  const [selectedId, setSelectedId] = useState(null)

  const overview = useMemo(() => {
    const nodes = new Map()
    const sum = { total: 0, assessed: 0, proved: 0, weak: 0, fading: 0 }
    const root = { id: 'you', kind: 'you', title: firstName(name) || 'You', parentId: null, childIds: [], depth: 0, tally: sum }
    nodes.set('you', root)
    for (const { subject, graph } of graphs) {
      const top = graph.nodes.get(graph.rootId)
      const level = levelOf(subject)
      nodes.set(subject, {
        id: subject,
        kind: 'subject',
        subject,
        title: `${shortName(subject)}${level ? ` ${level}` : ''}`,
        code: subjectCode(subject),
        parentId: 'you',
        childIds: top.childIds,
        depth: 1,
        status: top.status,
        score: top.score,
        tally: top.tally,
      })
      root.childIds.push(subject)
      for (const k of Object.keys(sum)) sum[k] += top.tally?.[k] || 0
    }
    return { subject: 'You', nodes, rootId: 'you' }
  }, [graphs, name])

  const subjects = overview.nodes.get('you').childIds.map((id) => overview.nodes.get(id))
  const total = overview.nodes.get('you').tally
  const selected = selectedId && overview.nodes.get(selectedId)
  const share = (n) => (n.tally?.assessed ? (n.tally.weak + n.tally.fading) / n.tally.assessed : 0)
  const needsMost = [...subjects].filter((n) => n.tally?.weak + n.tally?.fading > 0).sort((a, b) => share(b) - share(a))[0]
  const strongest = [...subjects].filter((n) => n.tally?.proved > 0 && n !== needsMost).sort((a, b) => b.tally.proved / b.tally.total - a.tally.proved / a.tally.total)[0]

  const panel = selected ? (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => setSelectedId(null)} className="self-start text-[12.5px] font-medium" style={{ color: 'var(--brand)' }}>
        ← All of you
      </button>
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
          Subject
        </p>
        <h2 className="mt-1.5 text-[19px] font-semibold leading-tight tracking-[-0.02em]">{selected.subject}</h2>
        <p className="mt-1.5 flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_VAR[selected.status] }} />
          {statusLabel(selected.status)}
          {selected.score != null && ` · ${selected.score}%`}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[13px] tabular-nums">
          <span className="font-semibold">{selected.tally.proved}</span> of {selected.tally.total} subtopics proved
        </p>
        <Bar tally={selected.tally} />
        <p className="mt-2 text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          {selected.tally.assessed} tested{selected.tally.weak ? ` · ${selected.tally.weak} weak` : ''}
          {selected.tally.fading ? ` · ${selected.tally.fading} fading` : ''}
        </p>
      </div>
      <button type="button" onClick={() => onOpen(selected.subject)} className="btn btn-solid control-md">
        Open its map
      </button>
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
          You
        </p>
        <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {total.total ? Math.round((total.proved / total.total) * 100) : 0}%
        </p>
        <p className="mt-1.5 text-[12.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {total.proved.toLocaleString()} of {total.total.toLocaleString()} subtopics proved across {subjects.length} subject{subjects.length === 1 ? '' : 's'}
        </p>
        <div className="mt-3">
          <Bar tally={total} />
        </div>
      </div>
      {(needsMost || strongest) && (
        <div className="grid grid-cols-2 gap-2">
          {needsMost && (
            <button type="button" onClick={() => setSelectedId(needsMost.id)} className="rounded-[12px] border p-3 text-left hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border)' }}>
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                Needs you most
              </span>
              <span className="mt-1 block truncate text-[13.5px] font-semibold">{needsMost.title}</span>
            </button>
          )}
          {strongest && (
            <button type="button" onClick={() => setSelectedId(strongest.id)} className="rounded-[12px] border p-3 text-left hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border)' }}>
              <span className="block text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                Strongest
              </span>
              <span className="mt-1 block truncate text-[13.5px] font-semibold">{strongest.title}</span>
            </button>
          )}
        </div>
      )}
      <ul className="-mx-2 flex flex-col">
        {subjects.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => setSelectedId(n.id)} className="flex w-full flex-col gap-1.5 rounded-[10px] px-2 py-2.5 text-left hover:bg-[var(--surface-sunken)]">
              <span className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate font-medium">{n.title}</span>
                <span className="shrink-0 tabular-nums text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  {n.tally.proved}/{n.tally.total}
                </span>
              </span>
              <Bar tally={n.tally} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="flex flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Progress</h1>
        <span className="hidden text-[12.5px] sm:inline" style={{ color: 'var(--text-faint)' }}>
          You and every subject you take. Double-click one to walk into its map.
        </span>
      </div>
      <div className="flex flex-col border-b md:h-[min(74vh,720px)] md:flex-row" style={{ borderColor: 'var(--border)' }}>
        <section className="relative h-[440px] min-w-0 shrink-0 md:h-auto md:flex-1" aria-label="You and your subjects" style={{ background: 'var(--bg)' }}>
          <OrbitCanvas
            graph={overview}
            focusId="you"
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEnter={(id) => onOpen(overview.nodes.get(id).subject)}
            onBackground={() => setSelectedId(null)}
          />
        </section>
        <aside className="shrink-0 border-t p-5 md:w-[320px] md:overflow-y-auto md:border-l md:border-t-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {panel}
        </aside>
      </div>
      {children}
    </div>
  )
}
