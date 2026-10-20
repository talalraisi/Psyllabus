'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getSyllabus } from '@/lib/cache'
import { buildEffectiveProgressMap } from '@/lib/decay'
import { progressKey, displaySubtopic } from '@/lib/progress'
import { shortName } from '@/lib/subject-short'
import { ArrowUp, Copy, Check, Sparkle } from '@/components/syllabi/icons'

/**
 * Two things Syllabi suggests rather than answers.
 *
 * Research questions: tell it what you are curious about and what you can
 * get at, and it lays out six directions as cards, each with what it would
 * take and how it usually goes wrong. Pick one up and talk it through.
 *
 * How to study a subject: a short plan for the week, built from what your
 * own quizzes say is weak, not from a guess.
 */

const ACCESS = ['School lab', 'Online data', 'Surveys', 'Books & articles', 'Fieldwork', 'Coding']
const APPROACH = {
  experiment: 'Experiment',
  data: 'Data analysis',
  survey: 'Survey',
  sources: 'Sources',
  texts: 'Texts',
  fieldwork: 'Fieldwork',
  modelling: 'Modelling',
}
const FEASIBLE = { easy: ['Easy to do', 3, 'var(--status-proficient)'], doable: ['Doable', 2, 'var(--status-developing)'], stretch: ['A stretch', 1, 'var(--status-weak)'] }

function Dots({ n, colour }) {
  return (
    <span className="flex gap-[3px]">
      {[1, 2, 3].map((i) => (
        <span key={i} className="h-[7px] w-[7px] rounded-full" style={{ background: i <= n ? colour : 'var(--border-strong)' }} />
      ))}
    </span>
  )
}

function CopyLink({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        } catch {
          /* nothing to do */
        }
      }}
      className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
      style={{ color: 'var(--text-muted)' }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function IdeasStudio({ subjects = [], userId, onTalk }) {
  const examined = subjects.filter((s) => !/Theory of Knowledge|Extended Essay/i.test(s))
  const [mode, setMode] = useState('research')
  const [subject, setSubject] = useState(examined[0] || subjects[0] || '')
  const [kind, setKind] = useState('ia')
  const [text, setText] = useState('')
  const [access, setAccess] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [open, setOpen] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [progress, setProgress] = useState({ weak: [], strong: [] })
  // Earlier results of this tool, kept on the account (069-syllabi-saved.sql).
  const [saved, setSaved] = useState([])
  const [confirming, setConfirming] = useState(null)

  useEffect(() => {
    if (!userId) return
    let gone = false
    const read = async () => {
      const { data } = await createClient()
        .from('syllabi_ideas')
        .select('id, mode, subject, kind, prompt, result, created_at')
        .eq('user_id', userId)
        .eq('mode', mode)
        .order('created_at', { ascending: false })
        .limit(20)
      if (!gone) setSaved(data || [])
    }
    read()
    return () => {
      gone = true
    }
  }, [mode, userId])

  const removeSaved = async (item) => {
    const { error } = await createClient().from('syllabi_ideas').delete().eq('id', item.id)
    if (!error) setSaved((list) => list.filter((x) => x.id !== item.id))
  }

  // What their own quizzes say about this subject, for study advice.
  useEffect(() => {
    if (mode !== 'study' || !subject || !userId) return
    let gone = false
    const supabase = createClient()
    const read = async () => {
      const [{ data: rows }, syllabus] = await Promise.all([
        supabase.from('progress').select('subject, subtopic, status, mastery_points, updated_at, last_correct_at').eq('user_id', userId).eq('subject', subject),
        getSyllabus(supabase, [subject]),
      ])
      const eff = buildEffectiveProgressMap(rows || [])
      const named = (statuses) =>
        (syllabus || [])
          .filter((r) => statuses.includes(eff[progressKey(r.subject, r.subtopic)]))
          .map((r) => displaySubtopic(r.subtopic))
          .slice(0, 12)
      if (!gone) setProgress({ weak: named(['in_progress', 'decaying']), strong: named(['mastered', 'proficient']) })
    }
    read()
    return () => {
      gone = true
    }
  }, [mode, subject, userId])

  const switchMode = (m) => {
    if (busy) return
    setMode(m)
    setResult(null)
    setError('')
    setText('')
  }

  const go = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setResult(null)
    setOpen(null)
    const message =
      mode === 'research'
        ? [text.trim() || 'I have not decided what interests me yet.', access.length ? `I can get access to: ${access.join(', ')}.` : ''].filter(Boolean).join('\n')
        : text.trim() || 'No extra notes.'
    try {
      const res = await fetch('/api/syllabi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          task: mode === 'research' ? 'research_questions' : 'study_advice',
          text: message,
          subject,
          kind,
          weak: mode === 'study' ? progress.weak : undefined,
          strong: mode === 'study' ? progress.strong : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.result) setError(data.code === 'not_configured' ? 'Syllabi is being switched on. Try again soon.' : data.error || 'That did not work.')
      else {
        setResult(data.result)
        setRemaining(data.remaining ?? null)
        if (data.saved) {
          setSaved((list) => [{ id: data.saved.id, mode, subject, kind: mode === 'research' ? kind : null, prompt: message, result: data.result, created_at: data.saved.created_at }, ...list])
        }
      }
    } catch {
      setError('Could not reach Syllabi. Check your connection.')
    }
    setBusy(false)
  }

  const field = 'h-10 rounded-full border bg-transparent px-4 text-[16px] outline-none sm:text-[13.5px]'

  return (
    <div className="mx-auto max-w-4xl">
      {/* Which tool. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['research', 'Research question ideas', 'Six directions for an IA or EE, with what each would take.'],
          ['study', 'How to study a subject', 'A plan for this week, from what your quizzes say is weak.'],
        ].map(([key, title, line]) => {
          const on = mode === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              aria-pressed={on}
              className="group rounded-[18px] border p-5 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5"
              style={{ borderColor: on ? 'var(--brand)' : 'var(--border)', background: on ? 'var(--brand-tint)' : 'var(--surface)' }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: on ? 'var(--brand)' : 'var(--surface-sunken)', color: on ? '#fff' : 'var(--text-muted)' }}>
                <Sparkle size={16} />
              </span>
              <p className="mt-3 text-[15.5px] font-semibold tracking-[-0.01em]">{title}</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {line}
              </p>
            </button>
          )
        })}
      </div>

      {/* What to go on. */}
      <div key={mode} className="sy-rise mt-5 rounded-[20px] border p-5 sm:p-6" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <div className="flex flex-wrap gap-2">
          <select value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} aria-label="Subject" className={field} style={{ borderColor: 'var(--border-strong)' }}>
            {(mode === 'research' ? subjects : examined).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {mode === 'research' && (
            <div className="flex rounded-full p-0.5" style={{ background: 'var(--surface-sunken)' }}>
              {[
                ['ia', 'IA'],
                ['ee', 'Extended Essay'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className="rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
                  style={kind === k ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.12)' } : { color: 'var(--text-muted)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1500))}
          rows={3}
          placeholder={mode === 'research' ? 'What are you curious about? A topic, a question you have had, something from class…' : 'Anything worth knowing: a test date, what you find hard…'}
          className="mt-4 block w-full resize-none rounded-[14px] border bg-transparent px-4 py-3 text-[16px] leading-relaxed outline-none transition-colors focus:border-[var(--brand)] sm:text-[14.5px]"
          style={{ borderColor: 'var(--border)' }}
        />

        {mode === 'research' ? (
          <div className="mt-4">
            <p className="mb-2 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              What can you get access to?
            </p>
            <div className="flex flex-wrap gap-2">
              {ACCESS.map((a) => {
                const on = access.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAccess((list) => (on ? list.filter((x) => x !== a) : [...list, a]))}
                    aria-pressed={on}
                    className="h-8 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors"
                    style={{ borderColor: on ? 'var(--brand)' : 'var(--border-strong)', background: on ? 'var(--brand)' : 'transparent', color: on ? '#fff' : 'var(--text-body)' }}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            {progress.weak.length ? (
              <>
                <span>From your quizzes, weakest: </span>
                <span style={{ color: 'var(--text-body)' }}>{progress.weak.slice(0, 4).join(', ')}</span>
                {progress.weak.length > 4 && ` and ${progress.weak.length - 4} more`}
              </>
            ) : (
              'No quiz results in this subject yet, so the plan starts from the basics.'
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {remaining !== null ? `${remaining} left today` : ''}
          </span>
          <button
            type="button"
            onClick={go}
            disabled={busy}
            className="flex h-11 items-center gap-2 rounded-full pl-5 pr-2 text-[14px] font-semibold transition-[transform,opacity] active:scale-[0.97] disabled:opacity-60"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            {busy ? 'Thinking…' : mode === 'research' ? 'Give me ideas' : 'Make my plan'}
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgb(255 255 255 / 0.18)' }}>
              <span style={{ transform: 'rotate(90deg)' }}>
                <ArrowUp size={15} />
              </span>
            </span>
          </button>
        </div>
        {error && (
          <p className="sy-rise mt-3 text-[13px]" style={{ color: 'var(--status-weak)' }} role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Earlier results, to come back to. */}
      {saved.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[12.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Earlier
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {saved.map((item) => {
              const label = item.result?.ideas?.[0]?.question || item.result?.headline || item.prompt || 'Saved'
              const on = result === item.result
              return (
                <div key={item.id} className="group relative w-60 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(item.result)
                      setOpen(null)
                      if (item.subject && subjects.includes(item.subject)) setSubject(item.subject)
                      if (item.kind) setKind(item.kind)
                    }}
                    className="flex h-full w-full flex-col rounded-[14px] border p-3 text-left transition-colors hover:border-[var(--brand)]"
                    style={{ borderColor: on ? 'var(--brand)' : 'var(--border)', background: on ? 'var(--brand-tint)' : 'var(--surface)' }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-faint)' }}>
                      {shortName(item.subject || '')} · {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="mt-1 line-clamp-2 text-[12.5px] leading-snug" style={{ color: 'var(--text-body)' }}>
                      {label}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (confirming === item.id ? removeSaved(item) : setConfirming(item.id))}
                    onBlur={() => setConfirming(null)}
                    aria-label="Delete"
                    className={`absolute right-2 top-2 rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-semibold transition-opacity ${confirming === item.id ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                    style={confirming === item.id ? { background: 'var(--status-weak)', color: '#fff' } : { color: 'var(--text-faint)', background: 'var(--surface-sunken)' }}
                  >
                    {confirming === item.id ? 'Delete' : '✕'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* While it thinks. */}
      {busy && (
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[18px]" style={{ background: 'var(--surface-sunken)', animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      )}

      {/* Research ideas, as cards. */}
      {result?.ideas && (
        <div className="mt-6">
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {result.ideas.map((idea, i) => {
              const [feel, dots, colour] = FEASIBLE[idea.feasibility]
              const expanded = open === i
              return (
                <article
                  key={i}
                  className="sy-rise flex flex-col rounded-[18px] border p-5 transition-colors"
                  style={{ borderColor: expanded ? 'var(--brand)' : 'var(--border)', background: 'var(--surface)', animationDelay: `${i * 70}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                      {APPROACH[idea.approach]} · {idea.focus}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      {feel}
                      <Dots n={dots} colour={colour} />
                    </span>
                  </div>
                  <p className="mt-3 text-[15.5px] font-semibold leading-snug tracking-[-0.01em]">{idea.question}</p>
                  {expanded && (
                    <dl className="sy-rise mt-3 flex flex-col gap-2.5 text-[13px] leading-relaxed">
                      {[
                        ['Scope', idea.scope],
                        ['What it takes', idea.needs],
                        ['Watch out', idea.trap],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: label === 'Watch out' ? 'var(--status-weak)' : 'var(--text-faint)' }}>
                            {label}
                          </dt>
                          <dd className="mt-0.5" style={{ color: 'var(--text-body)' }}>
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-auto flex items-center gap-1 pt-4">
                    <button type="button" onClick={() => setOpen(expanded ? null : i)} className="h-8 rounded-full px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
                      {expanded ? 'Less' : 'Details'}
                    </button>
                    <CopyLink text={idea.question} />
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => onTalk?.({ subject, text: `I'm thinking about this research question for my ${kind === 'ee' ? 'Extended Essay' : 'IA'}: "${idea.question}". Help me work out if it's a good one and how I'd approach it. Don't write any of it for me.` })}
                      className="h-8 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold transition-colors"
                      style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
                    >
                      Talk it through
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          {result.how_to_choose && (
            <p className="sy-rise mt-4 rounded-[14px] px-4 py-3 text-[13.5px] leading-relaxed" style={{ background: 'var(--surface-sunken)', color: 'var(--text-body)' }}>
              {result.how_to_choose}
            </p>
          )}
        </div>
      )}

      {/* A plan for the week. */}
      {result?.steps && (
        <div className="sy-rise mt-6 rounded-[20px] border p-5 sm:p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--brand)' }}>
            {shortName(subject)} · this week
          </p>
          <p className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.015em]">{result.headline}</p>
          <ol className="relative mt-5 flex flex-col gap-5 border-l pl-6" style={{ borderColor: 'var(--border-strong)' }}>
            {result.steps.map((s, i) => (
              <li key={i} className="sy-rise relative" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="absolute -left-[37px] top-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--brand)', color: '#fff' }}>
                  {i + 1}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-semibold">{s.title}</p>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                    {s.minutes} min
                  </span>
                  {s.subtopic && (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                      {s.subtopic}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                  {s.detail}
                </p>
              </li>
            ))}
          </ol>
          {result.avoid && (
            <p className="mt-6 rounded-[14px] px-4 py-3 text-[13px] leading-relaxed" style={{ background: 'color-mix(in srgb, var(--status-weak) 10%, transparent)', color: 'var(--text-body)' }}>
              <span className="font-semibold" style={{ color: 'var(--status-weak)' }}>
                Avoid:{' '}
              </span>
              {result.avoid}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onTalk?.({ subject, text: `Here's my study plan for ${subject} this week: ${result.headline} Can you help me start on step 1: ${result.steps[0]?.title}?` })}
              className="h-9 rounded-full px-4 text-[12.5px] font-semibold"
              style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
            >
              Start with Syllabi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
