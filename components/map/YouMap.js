'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import OrbitCanvas from '@/components/map/OrbitCanvas'
import ProgressOverTime from '@/components/map/ProgressOverTime'
import { HeatmapSubject, TONE } from '@/components/SubjectHeatmap'
import Counting from '@/components/Counting'
import { statusLabel } from '@/lib/subject-graph'
import { displaySubtopic } from '@/lib/progress'
import { shortName, levelOf } from '@/lib/subject-short'

/**
 * Progress: where you stand, how it is changing, and every subtopic, with
 * one choice of subject running through all of it.
 *
 *   Figures      proved, tested, needs work, mastered: four large numbers,
 *                each with the count it comes from
 *   Constellation  you in the middle, every subject a star joined to you,
 *                bigger and brighter the more of it is proved
 *   Over time    tested and proved over twelve weeks
 *   Next         the subtopics closest to proved, and the ones slipping,
 *                each a click from practice
 *
 * About where you stand, not how much you did: time, accuracy and questions
 * answered are the Analytics page's.
 *   Subjects     each one as a row of numbers and a bar of its statuses
 *   Subtopics    every subtopic as a square, each opening on the map
 *
 * Choosing a subject (the chips, a star, a row) narrows every part to it.
 *
 * graphs: [{ subject, graph }] (lib/subject-graph.js), one per subject.
 * items: every subtopic with { subject, topic, unit, subtopic, status, points, testedAt, provedAt }.
 */

const firstName = (name = '') => name.trim().split(/\s+/)[0] || ''

// Best to worst, then untested: the order bars and legends read in.
const LADDER = ['mastered', 'proficient', 'confident', 'in_progress', 'decaying', 'not_started']

function count(items) {
  const c = Object.fromEntries(LADDER.map((s) => [s, 0]))
  for (const i of items) c[i.status in c ? i.status : 'not_started']++
  return { ...c, total: items.length, proved: c.mastered + c.proficient, tested: items.length - c.not_started, weak: c.in_progress + c.decaying }
}

const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0)

/** Every status as one bar. */
function StatusBar({ c, height = 8 }) {
  return (
    <span className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height }} aria-hidden="true">
      {LADDER.map((s) => (c[s] ? <span key={s} className="bar-fill h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(c[s] / Math.max(1, c.total)) * 100}%`, background: TONE[s] }} /> : null))}
    </span>
  )
}

function Figure({ label, value, suffix, line, tone }) {
  return (
    <div className="rounded-[16px] border p-4 sm:p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="text-[12px] font-medium" style={{ color: 'var(--text-faint)' }}>
        {label}
      </p>
      <p className="mt-1.5 text-[clamp(1.9rem,3.4vw,2.5rem)] font-semibold leading-none tracking-[-0.035em]" style={{ color: tone || 'var(--text)', fontVariantNumeric: 'proportional-nums' }}>
        <Counting to={value} />
        {suffix && <span className="ml-0.5 text-[0.55em] font-medium tracking-normal">{suffix}</span>}
      </p>
      <p className="mt-2 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
        {line}
      </p>
    </div>
  )
}

const Card = ({ title, aside, children, className = '' }) => (
  <section className={`rounded-[20px] border ${className}`} style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
    {title && (
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 sm:px-6 sm:pt-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside && (
          <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {aside}
          </span>
        )}
      </div>
    )}
    {children}
  </section>
)

export default function YouMap({ graphs, items = [], name = '', onOpen, locked = 0, now }) {
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
  const selected = selectedId ? overview.nodes.get(selectedId) : null
  const pickSubject = (id) => setSelectedId((cur) => (cur === id ? null : id))

  const bySubject = useMemo(() => {
    const out = {}
    for (const { subject } of graphs) out[subject] = items.filter((i) => i.subject === subject)
    return out
  }, [graphs, items])
  const counts = useMemo(() => Object.fromEntries(Object.entries(bySubject).map(([s, list]) => [s, count(list)])), [bySubject])

  const scopeItems = selected ? bySubject[selected.subject] || [] : items
  const c = count(scopeItems)
  // Closest to proved first: developing, with the most points behind them.
  // Then what is slipping, which a short retest brings back.
  const almost = scopeItems.filter((i) => i.status === 'confident').sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5)
  const slipping = scopeItems.filter((i) => i.status === 'decaying').sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 3)

  const share = (n) => (counts[n.subject]?.tested ? counts[n.subject].weak / counts[n.subject].tested : 0)
  const needsMost = [...subjects].filter((n) => counts[n.subject]?.weak > 0).sort((a, b) => share(b) - share(a))[0]
  const strongest = [...subjects].filter((n) => counts[n.subject]?.proved > 0 && n !== needsMost).sort((a, b) => counts[b.subject].proved / counts[b.subject].total - counts[a.subject].proved / counts[a.subject].total)[0]
  const shown = selected ? [selected] : subjects
  const openSubtopic = (row) => onOpen(row.subject, `s:${row.topic}::${row.unit || ''}::${row.subtopic}`)

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {/* Title, and the one choice that narrows everything below. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold tracking-[-0.03em]">{selected ? selected.subject : 'Progress'}</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            {selected ? `${statusLabel(selected.status)} overall. Everything below is this subject.` : 'Where you stand in every subject, measured by what you have proved in quizzes.'}
          </p>
        </div>
        {subjects.length > 1 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Subject" style={{ scrollbarWidth: 'none' }}>
            {[{ id: null, title: 'All subjects' }, ...subjects].map((n) => {
              const on = selectedId === n.id
              return (
                <button
                  key={n.id || 'all'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelectedId(n.id)}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                  style={on ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' } : { borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                >
                  {n.title}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* The four numbers. */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label="Proved" value={pctOf(c.proved, c.total)} suffix="%" tone="var(--brand)" line={`${c.proved.toLocaleString()} of ${c.total.toLocaleString()} subtopics`} />
        <Figure label="Tested" value={c.tested} line={`${pctOf(c.tested, c.total)}% of the syllabus has been quizzed`} />
        <Figure label="Needs work" value={c.weak} tone={c.weak ? 'var(--status-weak)' : undefined} line={c.weak ? `${c.in_progress} weak, ${c.decaying} fading` : 'Nothing weak or fading'} />
        <Figure label="Mastered" value={c.mastered} line={`the top level, of ${c.total.toLocaleString()}`} />
      </div>

      {/* The constellation, and how it is changing. */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card title={selected ? 'Its place among your subjects' : 'Your subjects'} aside="Double-click a subject to open its map">
          <div className="relative h-[400px] sm:h-[440px]">
            <OrbitCanvas graph={overview} focusId="you" selectedId={selectedId} onSelect={(id) => setSelectedId(id)} onEnter={(id) => onOpen(overview.nodes.get(id).subject)} onBackground={() => setSelectedId(null)} />
          </div>
        </Card>
        <div className="flex flex-col gap-3">
          <Card title="Proved over time" aside="Last 12 weeks">
            <div className="px-5 pb-5 pt-3 sm:px-6">
              <ProgressOverTime items={scopeItems} now={now} />
            </div>
          </Card>
          <Card title="Next to prove" aside="Closest first">
            <div className="px-2 pb-3 pt-2 sm:px-3">
              {almost.length + slipping.length === 0 ? (
                <p className="px-3 py-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  {c.tested ? 'Nothing is close to the line right now. Quiz a new subtopic to start the next one.' : 'Quiz a subtopic and it will show up here as it gets close to proved.'}
                </p>
              ) : (
                [...almost.map((r) => ['almost', r]), ...slipping.map((r) => ['slipping', r])].map(([kind, r]) => (
                  <div key={`${r.subject}|${r.subtopic}`} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 hover:bg-[var(--surface-sunken)]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[r.status] }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{displaySubtopic(r.subtopic)}</span>
                      <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                        {kind === 'almost' ? 'Almost proved' : 'Slipping, a short retest brings it back'}
                        {selected ? '' : ` · ${shortName(r.subject)}`}
                      </span>
                    </span>
                    <button type="button" onClick={() => openSubtopic(r)} className="hidden shrink-0 text-[12px] font-medium sm:inline" style={{ color: 'var(--text-muted)' }}>
                      View
                    </button>
                    <Link
                      href={`/dashboard/quiz?subject=${encodeURIComponent(r.subject)}&topic=${encodeURIComponent(r.topic)}&subtopic=${encodeURIComponent(r.subtopic)}&back=${encodeURIComponent('/dashboard/map')}`}
                      className="shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--surface)]"
                      style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
                    >
                      Practise
                    </Link>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Every subject as numbers. */}
      <Card title="By subject" aside={selected ? 'Click it again to see all of them' : 'Click one to look closer'} className="mt-3">
        <div className="px-2 pb-2 pt-2 sm:px-3">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_5rem_minmax(0,2fr)_5.5rem_5.5rem_auto] gap-4 px-3 pb-2 text-[11px] font-medium md:grid" style={{ color: 'var(--text-faint)' }}>
            <span>Subject</span>
            <span className="text-right">Proved</span>
            <span>Where each subtopic stands</span>
            <span className="text-right">Tested</span>
            <span className="text-right">Needs work</span>
            <span />
          </div>
          {shown.map((n) => {
            const sc = counts[n.subject] || count([])
            const on = selectedId === n.id
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => pickSubject(n.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pickSubject(n.id))}
                className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[12px] px-3 py-3 transition-colors hover:bg-[var(--surface-sunken)] md:grid-cols-[minmax(0,1.4fr)_5rem_minmax(0,2fr)_5.5rem_5.5rem_auto]"
                style={on ? { background: 'var(--brand-tint)' } : undefined}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{n.subject}</span>
                  {(n === needsMost || n === strongest) && (
                    <span className="mt-0.5 inline-block text-[11px] font-medium" style={{ color: n === needsMost ? 'var(--status-weak)' : 'var(--brand)' }}>
                      {n === needsMost ? 'Needs you most' : 'Strongest'}
                    </span>
                  )}
                </span>
                <span className="text-right text-[20px] font-semibold tracking-[-0.02em] md:text-[18px]" style={{ color: 'var(--brand)', fontVariantNumeric: 'proportional-nums' }}>
                  {pctOf(sc.proved, sc.total)}%
                </span>
                <span className="col-span-2 md:col-span-1">
                  <StatusBar c={sc} />
                </span>
                <span className="hidden text-right text-[13px] tabular-nums md:block" style={{ color: 'var(--text-muted)' }}>
                  {sc.tested} of {sc.total}
                </span>
                <span className="hidden text-right text-[13px] tabular-nums md:block" style={{ color: sc.weak ? 'var(--status-weak)' : 'var(--text-faint)' }}>
                  {sc.weak || '–'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen(n.subject)
                  }}
                  className="hidden rounded-full border px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--surface)] md:inline-block"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
                >
                  Open map
                </button>
              </div>
            )
          })}
          {/* The legend for the bars, once. */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-2 pt-3 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            {LADDER.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="h-[8px] w-[8px] rounded-full" style={{ background: TONE[s] }} />
                {statusLabel(s)}
              </span>
            ))}
          </div>
          {locked > 0 && (
            <a href="/pricing" className="mx-3 mb-2 mt-1 block rounded-[12px] border border-dashed px-3 py-2.5 text-[12.5px] transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
              Your other {locked} subject{locked === 1 ? '' : 's'} join Progress with Basic. <span style={{ color: 'var(--brand)' }}>See plans</span>
            </a>
          )}
        </div>
      </Card>

      {/* Every subtopic. */}
      <section className="mt-8">
        <h2 className="text-[17px] font-semibold tracking-[-0.018em]">Every subtopic{selected ? ` in ${selected.title}` : ''}</h2>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          One square each, grouped by topic. Point at one to read it; click it to open it on the map.
        </p>
        <div className={`mt-4 grid gap-3 ${shown.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {shown.map((n) => (bySubject[n.subject]?.length ? <HeatmapSubject key={n.subject} subject={n.subject} items={bySubject[n.subject]} onPick={openSubtopic} /> : null))}
        </div>
      </section>
    </div>
  )
}
