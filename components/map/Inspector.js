'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AskSyllabi } from '@/components/syllabi/SyllabiDrawer'
import { statusLabel, leavesOf, related, neighbours, pathTo } from '@/lib/subject-graph'
import { STATUS_DESCRIPTIONS } from '@/lib/progress'
import { curatedFor } from '@/lib/resource-catalog'
import { getSlugForSubject } from '@/lib/subject-map'
import { STATUS_VAR, progressLine } from '@/components/map/MapCanvas'

/**
 * What is known about the selected node, and what to do with it.
 *
 * Only real things: the student's own level and score (from their quizzes),
 * how many questions the bank holds for it, the syllabus around it, and the
 * resources the app curates. Sections with nothing in them are left out
 * rather than shown empty. The Syllabi actions open the tutor the rest of the
 * app uses, already asked the question, under its usual limits.
 */

const counts = new Map()

function useQuestionCount(subject, node, leaves) {
  const key = node ? `${subject}|${node.id}` : null
  const [, force] = useState(0)
  useEffect(() => {
    if (!key || counts.has(key)) return
    let off = false
    const supabase = createClient()
    let q = supabase.from('questions').select('id', { count: 'exact', head: true }).eq('subject', subject).eq('verified', true)
    if (node.kind === 'subtopic') q = q.eq('subtopic', node.row.subtopic)
    else if (node.kind === 'topic') q = q.eq('topic', node.title)
    else if (node.kind === 'unit') q = q.in('subtopic', leaves.map((l) => l.row.subtopic))
    q.then(({ count }) => {
      counts.set(key, count ?? 0)
      if (!off) force((n) => n + 1)
    })
    return () => {
      off = true
    }
  }, [key, subject, node, leaves])
  return key ? counts.get(key) : undefined
}

const when = (iso) => {
  if (!iso) return null
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function Section({ title, children }) {
  return (
    <section className="border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
      <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

function NodeLink({ node, onGo, note }) {
  return (
    <button
      type="button"
      onClick={() => onGo(node.id)}
      className="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--surface-sunken)]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_VAR[node.status] }} />
      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-body)' }}>
        {node.title}
      </span>
      {note && (
        <span className="shrink-0 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
          {note}
        </span>
      )}
    </button>
  )
}

export default function Inspector({ graph, node, subject, onGo, onEnter, onClose, backHref, syllabi }) {
  const leaves = node && node.kind !== 'subtopic' ? leavesOf(graph, node.id) : null
  const bank = useQuestionCount(subject, node, leaves)

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <p className="text-[13.5px] font-medium">Select anything on the map</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          Its level, what is inside it and what to do next appear here. Double-click a topic, or use its arrow, to open its own map.
        </p>
      </div>
    )
  }

  const branch = node.kind !== 'subtopic'
  const path = pathTo(graph, node.id).slice(0, -1)
  const back = encodeURIComponent(backHref)
  const row = node.row
  const quiz =
    node.kind === 'subtopic'
      ? `/dashboard/quiz?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(row.topic)}&subtopic=${encodeURIComponent(row.subtopic)}&count=5&review=practice&back=${back}`
      : node.kind === 'topic'
        ? `/dashboard/quiz?subject=${encodeURIComponent(subject)}&mode=topic&topic=${encodeURIComponent(node.title)}&count=10&review=practice&back=${back}`
        : node.kind === 'unit'
          ? `/dashboard/quiz?subject=${encodeURIComponent(subject)}&mode=custom&subtopics=${encodeURIComponent(leaves.map((l) => l.row.subtopic).join('~~'))}&count=10&review=practice&back=${back}`
          : `/dashboard/test`

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const slipping = [node.tally?.weak ? plural(node.tally.weak, 'weak', 'weak') : null, node.tally?.fading ? plural(node.tally.fading, 'fading', 'fading') : null].filter(Boolean)
  const advice = branch
    ? slipping.length
      ? `${slipping.join(' and ')} in here. Practise this and they come up first.`
      : node.tally.assessed < node.tally.total
        ? `${node.tally.total - node.tally.assessed} not tested yet. A first quiz shows where you stand.`
        : 'All tested. Hard questions keep it secure.'
    : {
        not_started: 'Not tested yet. Five questions shows where you stand.',
        in_progress: 'Weak so far. Practise it and look again at what you miss.',
        decaying: 'It is fading. A short retest brings it back.',
        confident: 'Developing. A few more right answers and it moves up.',
        proficient: 'Proficient. Harder questions take it to mastered.',
        mastered: 'Mastered. Come back now and then to keep it.',
      }[node.status]

  const rel = node.kind === 'subtopic' ? related(graph, node.id) : []
  const near = node.kind === 'subtopic' ? neighbours(graph, node.id) : {}
  const resources = node.kind === 'subtopic' ? curatedFor({ subject, topic: row.topic, subtopic: row.subtopic }).slice(0, 4) : []
  const ask = (text, label) => (
    <AskSyllabi subject={subject} topic={row?.topic || (node.kind === 'topic' ? node.title : '')} text={text} label={label} context={`Subject map · ${node.title}`} size="xs" />
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {path.map((p) => p.title).join('  ›  ') || 'Subject'}
          </p>
          <h2 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.015em]">{node.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-sunken)]"
          style={{ color: 'var(--text-faint)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="m3 3 6 6M9 3 3 9" />
          </svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {/* Where it stands */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ background: `color-mix(in oklab, ${STATUS_VAR[node.status]} 16%, transparent)`, color: 'var(--text)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_VAR[node.status] }} />
              {statusLabel(node.status)}
            </span>
            {!branch && node.score != null && (
              <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {node.score}/100
              </span>
            )}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
            <span
              className="block h-full rounded-full"
              style={{
                width: `${branch ? (node.tally.proved / Math.max(1, node.tally.total)) * 100 : node.score ?? 0}%`,
                background: STATUS_VAR[node.status],
                transition: 'width 600ms',
              }}
            />
          </div>
          <p className="mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {[
              branch ? `${progressLine(node)} · ${node.tally.assessed} tested` : node.score == null ? 'Not tested yet' : null,
              !branch && node.studiedAt ? `last right answer ${when(node.studiedAt)}` : null,
              bank != null ? `${bank} question${bank === 1 ? '' : 's'} in the bank` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {!branch && STATUS_DESCRIPTIONS?.[node.status] && (
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              {STATUS_DESCRIPTIONS[node.status]}
            </p>
          )}
        </div>

        <Section title="Next">
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {advice}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {bank !== 0 && (
              <Link href={quiz} className="btn btn-solid control-sm">
                {node.kind === 'subtopic' ? 'Quiz me' : 'Practise this'}
              </Link>
            )}
            {branch && node.kind !== 'subject' && (
              <button type="button" onClick={() => onEnter(node.id)} className="btn btn-outline control-sm">
                Open its map
              </button>
            )}
            {node.kind === 'subtopic' && (
              <Link href={`/dashboard/syllabus/${getSlugForSubject(subject)}`} className="btn btn-outline control-sm">
                In the syllabus
              </Link>
            )}
          </div>
          {bank === 0 && (
            <p className="mt-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              No questions here yet. The bank is still being built for this part.
            </p>
          )}
        </Section>

        {syllabi && (
          <Section title="Ask Syllabi">
            <div className="flex flex-wrap gap-1.5">
              {ask(`Explain ${node.title} (${subject}) clearly, the way the exam expects it.`, 'Explain this')}
              {ask(`Explain ${node.title} (${subject}) more simply, as if I am new to it.`, 'More simply')}
              {ask(`Give me one worked example on ${node.title} (${subject}), then a similar one for me to try.`, 'Show an example')}
              {ask(`Quiz me on ${node.title} (${subject}): ask one exam-style question at a time and mark my answer.`, 'Quiz me in chat')}
            </div>
          </Section>
        )}

        {branch && node.childIds.length > 0 && (
          <Section title={`Inside (${node.childIds.length})`}>
            <div className="-mx-2">
              {node.childIds.map((id) => {
                const c = graph.nodes.get(id)
                return <NodeLink key={id} node={c} onGo={onGo} note={c.kind === 'subtopic' ? (c.score == null ? '' : c.score) : `${c.tally.proved}/${c.tally.total}`} />
              })}
            </div>
          </Section>
        )}

        {rel.length > 0 && (
          <Section title="Connected elsewhere">
            <p className="mb-1.5 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Subtopics in other parts of the course that share a key term with this one.
            </p>
            <div className="-mx-2">
              {rel.map((r) => (
                <NodeLink key={r.node.id} node={r.node} onGo={onGo} note={r.shared[0]} />
              ))}
            </div>
          </Section>
        )}

        {(near.before || near.after) && (
          <Section title="Around it in the syllabus">
            <div className="-mx-2">
              {near.before && <NodeLink node={near.before} onGo={onGo} note="before" />}
              {near.after && <NodeLink node={near.after} onGo={onGo} note="after" />}
            </div>
          </Section>
        )}

        {resources.length > 0 && (
          <Section title="Resources">
            <ul className="flex flex-col gap-1">
              {resources.map((res) => (
                <li key={res.url}>
                  <a href={res.url} target="_blank" rel="noopener noreferrer" className="block rounded-[9px] px-2 py-1.5 -mx-2 transition-colors hover:bg-[var(--surface-sunken)]">
                    <span className="block truncate text-[12.5px] font-medium" style={{ color: 'var(--text-body)' }}>
                      {res.title}
                    </span>
                    {res.provider && (
                      <span className="block truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        {res.provider}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}
