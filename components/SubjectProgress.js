'use client'

import { useState } from 'react'
import Link from 'next/link'
import { displaySubtopic, STATUS_LABELS } from '@/lib/progress'
import { getSlugForSubject } from '@/lib/subject-map'

/**
 * Where you stand, and the way straight into the thing that needs you.
 *
 * The progress page used to say the same thing four times in four visual
 * languages: an overall percentage in the subtitle, counts by status in a row
 * of cards, the same percentages again as bars per subject, and then every
 * subtopic in the course as a coloured square. Four readings of one dataset,
 * and the only button on any of them opened a diagram showing it a fifth way.
 *
 * None of it answered the question somebody opens this page with, which is not
 * "how much is green" but "which part of this needs me tonight". So there is
 * one list now, it goes three levels deep on a press, and every row on it ends
 * in something you can actually do.
 *
 * The bar is the mix rather than a percentage. A subject that is 60% proved
 * with the rest untested and one that is 60% proved with the rest actively
 * wrong are not the same evening's work, and a single number cannot tell them
 * apart.
 */

/* Worst first, so the bar reads left to right as "what is wrong with this".
   Untested sits at the end rather than the start: not knowing whether you know
   something is a smaller problem than knowing that you do not. */
const BAND = [
  ['in_progress', 'var(--status-weak)'],
  ['decaying', 'var(--status-fading)'],
  ['confident', 'var(--status-developing)'],
  ['proficient', 'var(--status-proficient)'],
  ['mastered', 'var(--status-mastered)'],
  ['not_started', 'var(--status-untested)'],
]

const NEEDS_WORK = new Set(['not_started', 'in_progress', 'decaying'])
/* The order the planner would pick in. Used to choose what "Study" opens. */
const URGENCY = ['in_progress', 'decaying', 'not_started', 'confident', 'proficient', 'mastered']

function tally(items) {
  const counts = {}
  for (const r of items) counts[r.status] = (counts[r.status] || 0) + 1
  const todo = items.filter((r) => NEEDS_WORK.has(r.status)).length
  const proved = items.length ? (items.length - todo) / items.length : 0
  return { counts, total: items.length, todo, proved }
}

/** The single subtopic a "Study" press should open. */
function worst(items) {
  return [...items].sort(
    (a, b) => URGENCY.indexOf(a.status) - URGENCY.indexOf(b.status)
  )[0]
}

/** The mix, as one bar. No legend: the colours are the same five the whole
 *  product uses, and the readout underneath names them on demand. */
function Mix({ items, height = 8 }) {
  const t = tally(items)
  return (
    <span
      className="flex overflow-hidden rounded-full"
      style={{ height, background: 'var(--surface-sunken)' }}
      title={BAND.filter(([k]) => t.counts[k])
        .map(([k]) => `${t.counts[k]} ${STATUS_LABELS[k]}`)
        .join(', ')}
    >
      {BAND.map(([key, colour]) =>
        t.counts[key] ? (
          <span
            key={key}
            className="block h-full"
            style={{ width: `${(t.counts[key] / t.total) * 100}%`, background: colour }}
          />
        ) : null
      )}
    </span>
  )
}

/** A count that says what kind of work it is, not just how much. */
function Need({ items }) {
  const t = tally(items)
  if (t.todo === 0) {
    return (
      <span className="text-[12.5px] font-medium" style={{ color: 'var(--status-proficient)' }}>
        all {t.total} proved
      </span>
    )
  }
  const weak = (t.counts.in_progress || 0) + (t.counts.decaying || 0)
  return (
    <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
      <span className="font-semibold" style={{ color: 'var(--text)' }}>{t.todo}</span> of {t.total} need work
      {weak > 0 && <span style={{ color: 'var(--status-weak)' }}> · {weak} weak</span>}
    </span>
  )
}

/** Where a "Study" press goes: a quiz on the single worst thing in scope. */
function studyHref(subject, items) {
  const w = worst(items)
  if (!w) return `/dashboard/quiz?subject=${encodeURIComponent(subject)}`
  return `/dashboard/quiz?subject=${encodeURIComponent(subject)}&subtopic=${encodeURIComponent(w.subtopic)}`
}

function Row({ depth, open, onToggle, label, sub, items, subject, leaf = false }) {
  const t = tally(items)
  return (
    <div
      className="flex items-center gap-4 border-b py-3"
      style={{ borderColor: 'var(--border)', paddingLeft: depth * 20 }}
    >
      <button
        onClick={onToggle}
        disabled={leaf}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        {!leaf && (
          <span
            aria-hidden="true"
            className="shrink-0 text-[10px] transition-transform duration-200"
            style={{ color: 'var(--text-faint)', transform: open ? 'rotate(90deg)' : 'none' }}
          >
            ▶
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[14px]" style={{ fontWeight: depth === 0 ? 600 : 400 }}>
            {label}
          </span>
          {sub && (
            <span className="mt-0.5 block truncate text-[12px]" style={{ color: 'var(--text-faint)' }}>
              {sub}
            </span>
          )}
        </span>
      </button>

      {leaf ? (
        <span
          className="w-24 shrink-0 text-right text-[12.5px] font-medium"
          style={{ color: `var(--status-${{ not_started: 'untested', in_progress: 'weak', confident: 'developing', proficient: 'proficient', mastered: 'mastered', decaying: 'fading' }[items[0].status]})` }}
        >
          {STATUS_LABELS[items[0].status]}
        </span>
      ) : (
        <>
          <span className="hidden w-40 shrink-0 sm:block">
            <Mix items={items} height={depth === 0 ? 8 : 6} />
          </span>
          <span className="hidden w-44 shrink-0 text-right md:block">
            <Need items={items} />
          </span>
        </>
      )}

      <Link
        href={studyHref(subject, items)}
        className="btn btn-outline control-sm shrink-0"
        aria-label={`Study ${label}`}
      >
        {t.todo > 0 ? 'Study' : 'Revise'}
      </Link>
    </div>
  )
}

export default function SubjectProgress({ items, subjects }) {
  const [openSubject, setOpenSubject] = useState(null)
  const [openTopic, setOpenTopic] = useState(null)

  const bySubject = (subjects || []).map((subject) => ({
    subject,
    items: items.filter((r) => r.subject === subject),
  })).filter((s) => s.items.length)

  if (!bySubject.length) return null

  return (
    <div>
      {bySubject.map(({ subject, items: subjectItems }) => {
        const isOpen = openSubject === subject
        const topics = [...new Set(subjectItems.map((r) => r.topic))].map((topic) => ({
          topic,
          items: subjectItems.filter((r) => r.topic === topic),
        }))
        /* Worst first at every level. A list sorted by the syllabus's own order
           is a table of contents; sorted by what is wrong with it, it is a
           plan. */
        topics.sort((a, b) => tally(b.items).todo - tally(a.items).todo)

        return (
          <div key={subject}>
            <Row
              depth={0}
              open={isOpen}
              onToggle={() => {
                setOpenSubject(isOpen ? null : subject)
                setOpenTopic(null)
              }}
              label={subject}
              items={subjectItems}
              subject={subject}
            />

            {isOpen &&
              topics.map(({ topic, items: topicItems }) => {
                const topicOpen = openTopic === `${subject}:${topic}`
                const subtopics = [...topicItems].sort(
                  (a, b) => URGENCY.indexOf(a.status) - URGENCY.indexOf(b.status)
                )
                return (
                  <div key={topic}>
                    <Row
                      depth={1}
                      open={topicOpen}
                      onToggle={() =>
                        setOpenTopic(topicOpen ? null : `${subject}:${topic}`)
                      }
                      label={topic}
                      items={topicItems}
                      subject={subject}
                    />
                    {topicOpen &&
                      subtopics.map((row) => (
                        <Row
                          key={`${row.topic}:${row.subtopic}`}
                          depth={2}
                          leaf
                          label={displaySubtopic(row.subtopic)}
                          sub={row.unit && row.unit !== row.topic ? row.unit : null}
                          items={[row]}
                          subject={subject}
                        />
                      ))}
                  </div>
                )
              })}
          </div>
        )
      })}

      <p className="mt-6 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
        Sorted by what needs work, not by the order the syllabus lists it in.
        Press a row to open it, or Study to go straight to the weakest part of it.
      </p>
    </div>
  )
}
