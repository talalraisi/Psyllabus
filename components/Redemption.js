'use client'

import { useState } from 'react'
import Link from 'next/link'
import { displaySubtopic } from '@/lib/progress'
import { Page, PageHeader, EmptyState } from '@/components/PageShell'
import CountUp from '@/components/CountUp'
import Select, { Chevron } from '@/components/Select'
import { IconArrowRight } from '@/components/Icons'

/**
 * Redemption: every question you got wrong, until you get it right three
 * times running.
 *
 * Organised the way you would work through it: how many are waiting and one
 * button to start; where the bank stands (how many are on their first,
 * second or third go); when the rest come back; and then the questions
 * themselves, grouped by subject and subtopic and folded away until you
 * open them. It used to be a row of subject buttons over one long list of
 * every question, which was everything at once and nothing in order.
 */

const DAY = 24 * 60 * 60 * 1000

/** Three correct recalls and a question leaves the bank. */
const REVIEWS_TO_CLEAR = 3

/** How many questions a subtopic shows before "Show all". */
const PREVIEW = 4

const WHEN = [
  { key: 'now', label: 'Due now' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'later', label: 'Later' },
]

function bucketFor(nextReviewAt, now) {
  const diff = new Date(nextReviewAt).getTime() - now
  if (diff <= 0) return 'now'
  if (diff <= DAY) return 'tomorrow'
  if (diff <= 7 * DAY) return 'week'
  return 'later'
}

function relativeDue(nextReviewAt, now) {
  const diff = new Date(nextReviewAt).getTime() - now
  if (diff <= 0) return 'Due now'
  const days = Math.ceil(diff / DAY)
  return days === 1 ? 'Tomorrow' : days <= 7 ? `In ${days} days` : `In ${Math.round(days / 7)} wk`
}

const reviewLink = ({ subject, subtopic } = {}) => {
  const p = new URLSearchParams({ mode: 'mistakes', back: '/dashboard/mistakes' })
  if (subject) p.set('subjects', subject)
  if (subtopic) p.set('subtopics', subtopic)
  return `/dashboard/quiz?${p}`
}

/** Three correct reviews, as three lights. */
function ClearDots({ count = 0, size = 8 }) {
  return (
    <span className="flex shrink-0 items-center gap-1" title={`${count} of ${REVIEWS_TO_CLEAR} correct reviews`} aria-label={`${count} of ${REVIEWS_TO_CLEAR} correct reviews`}>
      {Array.from({ length: REVIEWS_TO_CLEAR }).map((_, i) => {
        const lit = i < count
        return (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: size,
              height: size,
              background: lit ? 'var(--status-proficient)' : 'transparent',
              border: lit ? 'none' : '1.5px solid var(--border-strong)',
            }}
          />
        )
      })}
    </span>
  )
}

/** One subtopic: a row you can open to see its questions. */
function SubtopicRow({ subject, subtopic, items, now }) {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const due = items.filter((m) => bucketFor(m.next_review_at, now) === 'now').length
  const progress = items.reduce((n, m) => n + Math.min(REVIEWS_TO_CLEAR, m.review_count || 0), 0) / (items.length * REVIEWS_TO_CLEAR)
  const shown = all ? items : items.slice(0, PREVIEW)

  return (
    <li className="border-t first:border-t-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors" style={{ background: open ? 'var(--surface-sunken)' : undefined, color: 'var(--text-faint)' }}>
            <Chevron open={open} style={{ transform: open ? 'none' : 'rotate(-90deg)' }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium" style={{ color: 'var(--text)' }}>
              {displaySubtopic(subtopic)}
            </span>
            <span className="mt-1.5 flex items-center gap-2">
              <span className="h-1 w-24 overflow-hidden rounded-full" style={{ background: 'var(--border-strong)' }}>
                <span className="block h-full rounded-full" style={{ width: `${progress * 100}%`, background: 'var(--status-proficient)' }} />
              </span>
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
                {items.length} question{items.length === 1 ? '' : 's'}
              </span>
            </span>
          </span>
        </button>
        {due > 0 ? (
          <Link href={reviewLink({ subject, subtopic })} className="btn btn-outline control-sm shrink-0 tabular-nums">
            Redeem {due}
          </Link>
        ) : (
          <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            {relativeDue(items[0].next_review_at, now)}
          </span>
        )}
      </div>

      <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}>
        <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
          <ul className="mx-4 mb-3 overflow-hidden rounded-[12px] sm:mx-5" style={{ background: 'var(--surface-sunken)' }}>
            {shown.map((m) => {
              const dueNow = bucketFor(m.next_review_at, now) === 'now'
              return (
                <li key={m.id} className="flex items-start gap-3 border-t px-4 py-3 first:border-t-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="mt-1">
                    <ClearDots count={m.review_count || 0} size={7} />
                  </span>
                  <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {m.questions.stem}
                  </p>
                  <span className="mt-0.5 shrink-0 text-[11.5px] font-medium tabular-nums" style={{ color: dueNow ? 'var(--status-fading)' : 'var(--text-faint)' }}>
                    {relativeDue(m.next_review_at, now)}
                  </span>
                </li>
              )
            })}
            {items.length > PREVIEW && (
              <li className="border-t" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setAll((v) => !v)} className="w-full px-4 py-2.5 text-left text-[12.5px] font-medium transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--text-muted)' }}>
                  {all ? 'Show fewer' : `Show all ${items.length}`}
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </li>
  )
}

export function RedemptionView({ mistakes, now }) {
  const [subject, setSubject] = useState('')
  const subjects = [...new Set(mistakes.map((m) => m.questions.subject || 'Other'))].sort()
  const inScope = subject ? mistakes.filter((m) => (m.questions.subject || 'Other') === subject) : mistakes
  const due = inScope.filter((m) => bucketFor(m.next_review_at, now) === 'now')

  // Where the bank stands: how many are on their first, second or third go.
  const stages = [0, 1, 2].map((n) => inScope.filter((m) => Math.min(2, m.review_count || 0) === n).length)
  const schedule = WHEN.map((w) => ({ ...w, n: inScope.filter((m) => bucketFor(m.next_review_at, now) === w.key).length }))

  // Subject → subtopic → questions, the subtopics with the most due first.
  const grouped = Object.entries(
    inScope.reduce((acc, m) => {
      const s = m.questions.subject || 'Other'
      const t = m.questions.subtopic || 'General'
      ;((acc[s] ||= {})[t] ||= []).push(m)
      return acc
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([s, bySub]) => ({
      subject: s,
      due: Object.values(bySub).flat().filter((m) => bucketFor(m.next_review_at, now) === 'now').length,
      total: Object.values(bySub).flat().length,
      subtopics: Object.entries(bySub).sort(
        ([, a], [, b]) =>
          b.filter((m) => bucketFor(m.next_review_at, now) === 'now').length - a.filter((m) => bucketFor(m.next_review_at, now) === 'now').length ||
          b.length - a.length
      ),
    }))

  return (
      <Page width="default">
        <PageHeader title="Redemption" subtitle="Questions you got wrong come back until you get them right three times running." />

        {mistakes.length === 0 ? (
          <EmptyState title="Nothing to redeem yet" description="Questions you get wrong come back here until you have them three times running." />
        ) : (
          <>
            {/* What is waiting, and the one thing to do about it. */}
            <section
              className="elev-lg overflow-hidden rounded-[18px] border"
              style={{ borderColor: due.length ? 'var(--brand)' : 'var(--border-strong)', background: due.length ? 'var(--brand-tint)' : 'var(--surface)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-5 p-6 sm:p-7">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
                    {due.length ? 'Waiting for you' : 'Nothing due right now'}
                  </p>
                  <p className="mt-2 text-[clamp(2.2rem,5vw,2.9rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
                    <CountUp value={due.length} />
                    <span className="ml-2.5 text-[14px] font-medium tracking-normal" style={{ color: 'var(--text-muted)' }}>
                      of {inScope.length} in the bank
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {subjects.length > 1 && (
                    <Select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      aria-label="Subject"
                      className="h-11 min-w-[11rem] max-w-[15rem] rounded-full border pl-4 pr-2 text-[13.5px] font-medium"
                      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                    >
                      <option value="">All subjects</option>
                      {subjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  )}
                  {due.length > 0 && (
                    <Link href={reviewLink({ subject })} className="btn btn-solid control-lg shrink-0">
                      Redeem {due.length}
                      <IconArrowRight width={16} height={16} />
                    </Link>
                  )}
                </div>
              </div>

              {/* The way out: three right answers in a row. */}
              <div className="grid grid-cols-3 border-t" style={{ borderColor: due.length ? 'color-mix(in oklab, var(--brand) 30%, transparent)' : 'var(--border)' }}>
                {['Not yet right', 'Right once', 'Right twice'].map((label, i) => (
                  <div key={label} className={`px-4 py-4 sm:px-6 ${i ? 'border-l' : ''}`} style={{ borderColor: due.length ? 'color-mix(in oklab, var(--brand) 30%, transparent)' : 'var(--border)' }}>
                    <ClearDots count={i} size={7} />
                    <p className="mt-2.5 text-[22px] font-semibold leading-none tabular-nums">{stages[i]}</p>
                    <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <p className="mt-3 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
              Three right in a row, each on a later day, and a question leaves the bank for good.
            </p>

            {/* When the rest come back. */}
            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {schedule.map((w) => (
                <div
                  key={w.key}
                  className="rounded-[14px] border px-3.5 py-3"
                  style={{ borderColor: w.key === 'now' && w.n ? 'var(--status-fading)' : 'var(--border)', background: 'var(--surface)' }}
                >
                  <p className="text-[20px] font-semibold leading-none tabular-nums" style={{ color: w.key === 'now' && w.n ? 'var(--status-fading)' : w.n ? 'var(--text)' : 'var(--text-faint)' }}>
                    {w.n}
                  </p>
                  <p className="mt-1.5 truncate text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                    {w.label}
                  </p>
                </div>
              ))}
            </div>

            {/* The questions, by subject and subtopic, folded until opened. */}
            <div className="mt-10 flex flex-col gap-4">
              {grouped.map((g) => (
                <section key={g.subject} className="elev overflow-hidden rounded-[16px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                  <header className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: 'var(--border)' }}>
                    <h2 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-[-0.01em]">{g.subject}</h2>
                    <span className="hidden shrink-0 text-[12px] tabular-nums sm:inline" style={{ color: 'var(--text-faint)' }}>
                      {g.subtopics.length} subtopic{g.subtopics.length === 1 ? '' : 's'} · {g.total} question{g.total === 1 ? '' : 's'}
                    </span>
                    {g.due > 0 && !subject && subjects.length > 1 && (
                      <Link href={reviewLink({ subject: g.subject })} className="btn btn-quiet control-sm shrink-0 tabular-nums">
                        Redeem {g.due}
                      </Link>
                    )}
                  </header>
                  <ul>
                    {g.subtopics.map(([t, items]) => (
                      <SubtopicRow key={t} subject={g.subject} subtopic={t} items={items} now={now} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </Page>
  )
}
