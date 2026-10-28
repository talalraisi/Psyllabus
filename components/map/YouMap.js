'use client'

import { useMemo, useRef, useState } from 'react'
import OrbitCanvas from '@/components/map/OrbitCanvas'
import { HeatmapSubject, TONE } from '@/components/SubjectHeatmap'
import Counting from '@/components/Counting'
import { statusLabel } from '@/lib/subject-graph'
import { shortName, subjectCode, levelOf } from '@/lib/subject-short'

/**
 * Progress: you, with every subject you take circling you, and everything
 * under it answering to the same selection.
 *
 *   Orbit      each subject a planet, its edge where you stand in it. Select
 *              one to read it; double-click it to walk into its own map.
 *   Panel      how much is proved and how the rest is spread (one bar, every
 *              status in it, counted), for all of you or for the subject
 *              selected; which subject needs you most and which is strongest;
 *              every subject as a line to select.
 *   Subtopics  every subtopic as a cell, for every subject or only the one
 *              selected (the chips and the orbit are the same choice). A cell
 *              opens that subtopic in its subject's map.
 *
 * graphs: [{ subject, graph }] from lib/subject-graph.js, one per subject.
 * items: every subtopic with its status ({ subject, topic, unit, subtopic, status }).
 */

const firstName = (name = '') => name.trim().split(/\s+/)[0] || ''

// Best to worst, then untested: the order the bar and its legend read in.
const LADDER = ['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started']

function count(items) {
  const c = Object.fromEntries(LADDER.map((s) => [s, 0]))
  for (const i of items) c[i.status in c ? i.status : 'not_started']++
  return { ...c, total: items.length, proved: c.mastered + c.proficient }
}

/** Every status as one bar, then each counted underneath. */
function Breakdown({ c }) {
  return (
    <div>
      <span className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
        {LADDER.map((s) =>
          c[s] ? <span key={s} className="bar-fill h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(c[s] / Math.max(1, c.total)) * 100}%`, background: TONE[s] }} /> : null
        )}
      </span>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5">
        {LADDER.map((s) => (
          <div key={s} className="min-w-0">
            <dt className="flex items-center gap-1.5 truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: TONE[s] }} />
              {statusLabel(s)}
            </dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular-nums" style={{ color: c[s] ? 'var(--text)' : 'var(--text-faint)' }}>
              <Counting to={c[s]} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** A subject as a line: proved in green, the rest of what is tested lighter. */
function Bar({ c }) {
  const pct = (n) => `${Math.min(100, (n / Math.max(1, c.total)) * 100)}%`
  const tested = c.total - c.not_started
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }} aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(tested), background: 'color-mix(in oklab, var(--brand) 30%, var(--surface-sunken))' }} />
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(c.proved), background: 'var(--brand)' }} />
    </span>
  )
}

const Eyebrow = ({ children }) => (
  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
    {children}
  </p>
)

export default function YouMap({ graphs, items = [], name = '', onOpen }) {
  const [selectedId, setSelectedId] = useState(null)
  const below = useRef(null)

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

  const bySubject = useMemo(() => {
    const out = {}
    for (const { subject } of graphs) out[subject] = items.filter((i) => i.subject === subject)
    return out
  }, [graphs, items])
  const counts = useMemo(() => Object.fromEntries(Object.entries(bySubject).map(([s, list]) => [s, count(list)])), [bySubject])
  const all = useMemo(() => count(Object.values(bySubject).flat()), [bySubject])

  const subjects = overview.nodes.get('you').childIds.map((id) => overview.nodes.get(id))
  const selected = selectedId && overview.nodes.get(selectedId)
  const c = selected ? counts[selected.subject] : all
  const share = (n) => (n.tally?.assessed ? (n.tally.weak + n.tally.fading) / n.tally.assessed : 0)
  const needsMost = [...subjects].filter((n) => n.tally?.weak + n.tally?.fading > 0).sort((a, b) => share(b) - share(a))[0]
  const strongest = [...subjects].filter((n) => n.tally?.proved > 0 && n !== needsMost).sort((a, b) => b.tally.proved / b.tally.total - a.tally.proved / a.tally.total)[0]
  const shown = selected ? [selected] : subjects

  /* A subtopic's place in its subject's map (lib/subject-graph.js ids). */
  const openSubtopic = (row) => onOpen(row.subject, `s:${row.topic}::${row.unit || ''}::${row.subtopic}`)

  const panel = (
    <div className="flex flex-col gap-5">
      <div>
        {selected ? (
          <>
            <button type="button" onClick={() => setSelectedId(null)} className="mb-3 text-[12.5px] font-medium" style={{ color: 'var(--brand)' }}>
              ← All of you
            </button>
            <Eyebrow>Subject</Eyebrow>
            <h2 className="mt-1.5 text-[19px] font-semibold leading-tight tracking-[-0.02em]">{selected.subject}</h2>
          </>
        ) : (
          <Eyebrow>You</Eyebrow>
        )}
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            <Counting to={c.total ? Math.round((c.proved / c.total) * 100) : 0} />%
          </span>
          <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            proved
          </span>
        </p>
        <p className="mt-1.5 text-[12.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {c.proved.toLocaleString()} of {c.total.toLocaleString()} subtopics
          {selected ? ` · ${statusLabel(selected.status)} overall` : ` across ${subjects.length} subject${subjects.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <Breakdown c={c} />

      {selected ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => onOpen(selected.subject)} className="btn btn-solid control-md">
            Open its map
          </button>
          <button type="button" onClick={() => below.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="btn btn-quiet control-md">
            See every subtopic
          </button>
        </div>
      ) : (
        <>
          {(needsMost || strongest) && (
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Needs you most', needsMost],
                ['Strongest', strongest],
              ].map(([label, n]) =>
                n ? (
                  <button key={label} type="button" onClick={() => setSelectedId(n.id)} className="rounded-[12px] border p-3 text-left transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                      {label}
                    </span>
                    <span className="mt-1 block truncate text-[13.5px] font-semibold">{n.title}</span>
                  </button>
                ) : null
              )}
            </div>
          )}
          <ul className="-mx-2 flex flex-col">
            {subjects.map((n) => {
              const sc = counts[n.subject]
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => setSelectedId(n.id)} className="flex w-full flex-col gap-1.5 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]">
                    <span className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate font-medium">{n.title}</span>
                      <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                        {sc.total ? Math.round((sc.proved / sc.total) * 100) : 0}%
                      </span>
                    </span>
                    <Bar c={sc} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )

  return (
    <div className="flex flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Progress</h1>
        <span className="hidden text-[12.5px] sm:inline" style={{ color: 'var(--text-faint)' }}>
          You and every subject you take. Select one to look closer; double-click it to walk into its map.
        </span>
      </div>

      <div className="flex flex-col border-b md:h-[min(72vh,700px)] md:flex-row" style={{ borderColor: 'var(--border)' }}>
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
        <aside className="shrink-0 border-t p-5 md:w-[340px] md:overflow-y-auto md:border-l md:border-t-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {panel}
        </aside>
      </div>

      {/* Every subtopic, answering to the same selection as the orbit. */}
      <section ref={below} className="scroll-mt-4 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.018em]">Every subtopic{selected ? ` in ${selected.title}` : ''}</h2>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              One square each, grouped by topic. Point at one to read it; click it to open it on the map.
            </p>
          </div>
          {subjects.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Subject">
              {[{ id: null, title: 'All' }, ...subjects].map((n) => {
                const on = selectedId === n.id
                return (
                  <button
                    key={n.id || 'all'}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSelectedId(n.id)}
                    className="shrink-0 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors"
                    style={on ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                  >
                    {n.title}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className={`grid gap-4 ${shown.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {shown.map((n) =>
            bySubject[n.subject]?.length ? <HeatmapSubject key={n.subject} subject={n.subject} items={bySubject[n.subject]} onPick={openSubtopic} /> : null
          )}
        </div>
      </section>
    </div>
  )
}
