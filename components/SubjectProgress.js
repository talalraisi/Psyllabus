'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { displaySubtopic, STATUS_LABELS } from '@/lib/progress'

/**
 * Where you stand, as something worth looking at.
 *
 * Three attempts got this wrong in the same way. The page had been saying one
 * thing four times — a percentage, six stat cards, the same percentages as
 * bars, and every subtopic as a coloured square — so each attempt removed more
 * of it, and each attempt was correct about the information and wrong about
 * the page. A tidy list of rows with thin bars answers the question and looks
 * like a spreadsheet, and nobody opens a spreadsheet to find out how their
 * revision is going.
 *
 * So: one ring for the whole picture, then a card per subject, each with its
 * own ring, the mix along the bottom edge, and a count that says what kind of
 * work is waiting rather than only how much. Press a card and its topics open
 * underneath with room to read them.
 *
 * The ring carries the proportion because a ring is read at a glance and a
 * number has to be parsed. The bar carries the mix because a single figure
 * cannot tell apart a subject that is 60% proved with the rest untested from
 * one that is 60% proved with the rest actively wrong, and those are not the
 * same evening's work.
 */

/* Worst first, so the bar reads left to right as what is wrong with this.
   Untested sits at the end: not knowing whether you know something is a
   smaller problem than knowing that you do not. */
const BAND = [
  ['in_progress', 'var(--status-weak)'],
  ['decaying', 'var(--status-fading)'],
  ['confident', 'var(--status-developing)'],
  ['proficient', 'var(--status-proficient)'],
  ['mastered', 'var(--status-mastered)'],
  ['not_started', 'var(--status-untested)'],
]

const TONE = {
  not_started: 'var(--status-untested)',
  in_progress: 'var(--status-weak)',
  decaying: 'var(--status-fading)',
  confident: 'var(--status-developing)',
  proficient: 'var(--status-proficient)',
  mastered: 'var(--status-mastered)',
}

const NEEDS_WORK = new Set(['not_started', 'in_progress', 'decaying'])
/** The order the planner would pick in; decides what Study opens. */
const URGENCY = ['in_progress', 'decaying', 'not_started', 'confident', 'proficient', 'mastered']

function tally(items) {
  const counts = {}
  for (const r of items) counts[r.status] = (counts[r.status] || 0) + 1
  const todo = items.filter((r) => NEEDS_WORK.has(r.status)).length
  const weak = (counts.in_progress || 0) + (counts.decaying || 0)
  return {
    counts,
    total: items.length,
    todo,
    weak,
    pct: items.length ? Math.round(((items.length - todo) / items.length) * 100) : 0,
  }
}

function studyHref(subject, items) {
  const w = [...items].sort((a, b) => URGENCY.indexOf(a.status) - URGENCY.indexOf(b.status))[0]
  const base = `/dashboard/quiz?subject=${encodeURIComponent(subject)}`
  return w ? `${base}&subtopic=${encodeURIComponent(w.subtopic)}` : base
}

/**
 * A ring that draws itself on arrival.
 *
 * The animation is the only movement on the page and it earns its place: the
 * sweep is the quantity, so watching it fill tells you the number before you
 * have read it.
 */
function Ring({ pct, size = 92, stroke = 7, children }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const r = size / 2 - stroke / 2 - 1
  const c = 2 * Math.PI * r

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{
            strokeDashoffset: drawn ? c * (1 - pct / 100) : c,
            transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>
    </span>
  )
}

/** The mix, as one bar. The colours are the five the whole product uses. */
function Mix({ items, height = 5, className = '' }) {
  const t = tally(items)
  return (
    <span
      className={`flex overflow-hidden ${className}`}
      style={{ height, background: 'var(--surface-sunken)' }}
      title={BAND.filter(([k]) => t.counts[k]).map(([k]) => `${t.counts[k]} ${STATUS_LABELS[k]}`).join(', ')}
    >
      {BAND.map(([key, colour]) =>
        t.counts[key] ? (
          <span key={key} className="block h-full" style={{ width: `${(t.counts[key] / t.total) * 100}%`, background: colour }} />
        ) : null
      )}
    </span>
  )
}

function Count({ t }) {
  if (t.todo === 0) {
    return (
      <span className="text-[13px] font-medium" style={{ color: 'var(--status-proficient)' }}>
        All {t.total} proved
      </span>
    )
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
      <span>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>{t.todo}</span> of {t.total} need work
      </span>
      {t.weak > 0 && (
        <span
          className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
          style={{ background: 'var(--status-weak)', color: '#fff' }}
        >
          {t.weak} weak
        </span>
      )}
    </span>
  )
}

export default function SubjectProgress({ items, subjects }) {
  const [open, setOpen] = useState(null)
  const [openTopic, setOpenTopic] = useState(null)

  const bySubject = (subjects || [])
    .map((subject) => ({ subject, items: items.filter((r) => r.subject === subject) }))
    .filter((s) => s.items.length)

  if (!bySubject.length) return null

  const all = tally(items)
  const chosen = bySubject.find((s) => s.subject === open)

  return (
    <div>
      {/* One ring for the whole picture. It replaced six stat cards that
          between them said the same thing this says, less legibly. */}
      <div
        className="elev flex flex-wrap items-center gap-7 rounded-[16px] border p-6 md:p-7"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      >
        <Ring pct={all.pct} size={112} stroke={9}>
          <span className="text-[26px] font-semibold tabular-nums leading-none">{all.pct}%</span>
          <span className="mt-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>proved</span>
        </Ring>

        <div className="min-w-0 flex-1">
          <p className="text-[clamp(1.25rem,2.4vw,1.6rem)] font-semibold leading-tight tracking-[-0.025em]">
            {all.todo > 0
              ? `${all.todo} subtopics are waiting for you`
              : 'Everything you have mapped is proved'}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {all.weak > 0
              ? `${all.weak} of them you got wrong or have let slip. Those come first.`
              : 'Nothing is weak or fading. What is left has simply not been tested yet.'}
          </p>
          <Mix items={items} height={6} className="mt-5 rounded-full" />
        </div>
      </div>

      {/* A card per subject. Pressable, and the ring is the reading. */}
      <div className="stagger mt-5 grid gap-4 sm:grid-cols-2">
        {bySubject.map(({ subject, items: si }) => {
          const t = tally(si)
          const isOpen = open === subject
          return (
            <div
              key={subject}
              className="elev lift overflow-hidden rounded-[16px] border"
              style={{
                borderColor: isOpen ? 'var(--brand)' : 'var(--border-strong)',
                background: 'var(--surface)',
              }}
            >
              <button
                onClick={() => {
                  setOpen(isOpen ? null : subject)
                  setOpenTopic(null)
                }}
                className="flex w-full items-center gap-5 p-5 text-left"
              >
                <Ring pct={t.pct}>
                  <span className="text-[19px] font-semibold tabular-nums leading-none">{t.pct}%</span>
                </Ring>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold tracking-[-0.015em]">{subject}</span>
                  <span className="mt-2 block"><Count t={t} /></span>
                </span>
              </button>
              <Mix items={si} />
            </div>
          )
        })}
      </div>

      {/* The chosen subject, with room to read it. */}
      {chosen && (
        <div
          className="elev pop-enter mt-5 rounded-[16px] border p-5 md:p-6"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-[17px] font-semibold tracking-[-0.018em]">{chosen.subject}</h3>
            <Link href={studyHref(chosen.subject, chosen.items)} className="btn btn-solid control-sm">
              Study the weakest
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {[...new Set(chosen.items.map((r) => r.topic))]
              .map((topic) => ({ topic, items: chosen.items.filter((r) => r.topic === topic) }))
              .sort((a, b) => tally(b.items).todo - tally(a.items).todo)
              .map(({ topic, items: ti }) => {
                const tt = tally(ti)
                const topicOpen = openTopic === topic
                return (
                  <div
                    key={topic}
                    className="rounded-[12px] border"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
                  >
                    <button
                      onClick={() => setOpenTopic(topicOpen ? null : topic)}
                      className="flex w-full items-center gap-4 p-4 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium">{topic}</span>
                        <span className="mt-1.5 block"><Count t={tt} /></span>
                      </span>
                      <Mix items={ti} height={6} className="hidden w-28 shrink-0 rounded-full sm:flex" />
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-[11px] transition-transform duration-200"
                        style={{ color: 'var(--text-faint)', transform: topicOpen ? 'rotate(90deg)' : 'none' }}
                      >
                        ▶
                      </span>
                    </button>

                    {topicOpen && (
                      <ul className="border-t px-4 pb-2" style={{ borderColor: 'var(--border)' }}>
                        {[...ti]
                          .sort((a, b) => URGENCY.indexOf(a.status) - URGENCY.indexOf(b.status))
                          .map((row) => (
                            <li
                              key={row.subtopic}
                              className="flex items-center gap-4 border-b py-2.5 last:border-b-0"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: TONE[row.status] }}
                              />
                              <span className="min-w-0 flex-1 truncate text-[13.5px]">
                                {displaySubtopic(row.subtopic)}
                              </span>
                              <span
                                className="shrink-0 text-[12px] font-medium"
                                style={{ color: TONE[row.status] }}
                              >
                                {STATUS_LABELS[row.status]}
                              </span>
                              <Link
                                href={studyHref(chosen.subject, [row])}
                                className="btn btn-quiet control-sm shrink-0"
                              >
                                Quiz
                              </Link>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
