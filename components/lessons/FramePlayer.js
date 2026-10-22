'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MathText from '@/components/MathText'
import QuestionFigure from '@/components/QuestionFigure'
import { IconArrowLeft, IconArrowRight, IconCheck } from '@/components/Icons'
import { AskSyllabi } from '@/components/syllabi/SyllabiDrawer'
import { displaySubtopic } from '@/lib/progress'
import Interaction from './Interactions'

/**
 * A lesson as screens.
 *
 * It opens on an overview (why this matters, what you will be able to do),
 * then moves a screen at a time: short explanations, the thing you must
 * remember, an analogy, the diagram, each formula with its symbols, a worked
 * example step by step, the mistake students make, something to predict,
 * a few flip cards, and every two or three screens something to do. It ends
 * on "What you should know now", each statement shown by answering for it.
 *
 * Every screen has Ask Syllabi, with that screen as the context, and a
 * report button, because a lesson read by hundreds of students should hear
 * from them when something is off.
 *
 * Presentational: the page loads the lesson, saves progress and reports.
 */

const LABEL = { key_point: 'Need to know', note: 'Note', analogy: 'Think of it like this', mistake: 'Common mistake', reveal: 'Predict first', cards: 'Quick cards', check: 'Your turn', example: 'Worked example', formula: 'Formula', diagram: 'Diagram' }

function Points({ points }) {
  if (!points?.length) return null
  return (
    <ul className="stagger mt-4 flex flex-col gap-2.5">
      {points.map((p, i) => (
        <li key={i} className="flex gap-3 text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--brand)' }} />
          <span>
            <MathText>{p}</MathText>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Text({ children, big }) {
  if (!children) return null
  return (
    <p className={`${big ? 'text-[18px]' : 'text-[16px]'} leading-[1.7]`} style={{ color: 'var(--text-body)' }}>
      <MathText>{children}</MathText>
    </p>
  )
}

function Formula({ data }) {
  const [open, setOpen] = useState(null)
  return (
    <div>
      <div className="rounded-[16px] px-4 py-6 text-center text-[26px] font-semibold" style={{ background: 'var(--surface-sunken)' }}>
        <MathText>{data.expression}</MathText>
      </div>
      <p className="mt-3 text-[13px]" style={{ color: 'var(--text-faint)' }}>
        Tap each symbol.
      </p>
      <div className="stagger mt-2 flex flex-wrap gap-2">
        {(data.symbols || []).map((s, i) => (
          <button key={i} type="button" onClick={() => setOpen(open === i ? null : i)} className="rounded-[12px] border px-3 py-2 text-left" style={{ borderColor: open === i ? 'var(--brand)' : 'var(--border-strong)', background: open === i ? 'var(--brand-tint)' : 'var(--surface)' }}>
            <span className="text-[16px] font-semibold">
              <MathText>{`$${s.symbol}$`}</MathText>
            </span>
            {open === i && (
              <span className="verdict-in block text-[13.5px]" style={{ color: 'var(--text-body)' }}>
                {s.meaning}
                {s.unit ? ` · ${s.unit}` : ''}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function Example({ data }) {
  const [shown, setShown] = useState(1)
  const steps = data.steps || []
  return (
    <div>
      <Text>{data.problem}</Text>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.slice(0, shown).map((s, i) => (
          <li key={i} className="verdict-in flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
              {i + 1}
            </span>
            <p className="text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              <MathText>{s}</MathText>
            </p>
          </li>
        ))}
      </ol>
      {shown < steps.length ? (
        <button type="button" onClick={() => setShown((n) => n + 1)} className="btn btn-outline control-md mt-4">
          Next step
        </button>
      ) : (
        <p className="verdict-in mt-4 rounded-[12px] px-4 py-3 text-[15.5px] font-semibold" style={{ background: 'var(--brand-tint)' }}>
          <MathText>{data.answer}</MathText>
        </p>
      )}
    </div>
  )
}

function Mistake({ data }) {
  return (
    <div className="stagger grid gap-3 sm:grid-cols-2">
      <div className="rounded-[14px] border-l-4 p-4" style={{ borderColor: 'var(--status-weak)', background: 'var(--surface-sunken)' }}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--status-weak)' }}>
          What students write
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed line-through decoration-[var(--status-weak)]/40">
          <MathText>{data.wrong}</MathText>
        </p>
      </div>
      <div className="rounded-[14px] border-l-4 p-4" style={{ borderColor: 'var(--status-proficient)', background: 'var(--surface-sunken)' }}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--status-proficient)' }}>
          What is right
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed">
          <MathText>{data.right}</MathText>
        </p>
      </div>
      {data.why && (
        <p className="text-[14.5px] leading-relaxed sm:col-span-2" style={{ color: 'var(--text-muted)' }}>
          <MathText>{data.why}</MathText>
        </p>
      )}
    </div>
  )
}

function Reveal({ data }) {
  const [open, setOpen] = useState([])
  return (
    <div className="flex flex-col gap-3">
      {(data.items || []).map((it, i) => (
        <div key={i} className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border-strong)' }}>
          <p className="text-[15.5px] font-medium leading-relaxed">
            <MathText>{it.prompt}</MathText>
          </p>
          {open.includes(i) ? (
            <p className="verdict-in mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              <MathText>{it.answer}</MathText>
            </p>
          ) : (
            <button type="button" onClick={() => setOpen([...open, i])} className="btn btn-outline control-sm mt-3">
              Think, then show
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function Cards({ cards }) {
  const [flipped, setFlipped] = useState([])
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => {
        const on = flipped.includes(i)
        return (
          <button key={i} type="button" onClick={() => setFlipped(on ? flipped.filter((x) => x !== i) : [...flipped, i])} className={`flip-card h-36 text-left ${on ? 'is-flipped' : ''}`} aria-label={on ? 'Show the question' : 'Show the answer'}>
            <span className="flip-card-inner block h-full">
              <span className="flip-card-face flex flex-col justify-between rounded-[16px] border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
                <span className="text-[15px] font-semibold leading-snug">
                  <MathText>{c.front}</MathText>
                </span>
                <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                  Tap to turn
                </span>
              </span>
              <span className="flip-card-face flip-card-back flex items-center rounded-[16px] p-4 text-[14.5px] leading-relaxed" style={{ background: 'var(--brand-tint)' }}>
                <MathText>{c.back}</MathText>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Each kind of block has its own colour, from the app's palette, so a screen reads at a glance. */
const TONE = {
  key_point: { color: 'var(--brand)', bg: 'color-mix(in oklab, var(--brand) 12%, var(--surface))' },
  analogy: { color: 'var(--heat-hot)', bg: 'color-mix(in oklab, var(--heat-hot) 12%, var(--surface))' },
  note: { color: 'var(--heat-low)', bg: 'color-mix(in oklab, var(--heat-low) 12%, var(--surface))' },
  formula: { color: 'var(--heat-medium)', bg: 'color-mix(in oklab, var(--heat-medium) 9%, var(--surface))' },
  example: { color: 'var(--heat-medium)', bg: 'var(--surface)' },
  reveal: { color: 'var(--heat-hot)', bg: 'var(--surface)' },
  cards: { color: 'var(--brand)', bg: 'var(--surface)' },
  check: { color: 'var(--brand)', bg: 'var(--surface)' },
  mistake: { color: 'var(--heat-burning)', bg: 'var(--surface)' },
}

function Block({ b, result, onResult }) {
  const tone = TONE[b.type]
  const figure = b.figure && b.figure.kind !== 'none' ? <QuestionFigure figure={b.figure} /> : null
  const tinted = ['key_point', 'analogy', 'note', 'formula'].includes(b.type)
  const boxed = Boolean(tone) && !tinted
  const content =
    b.type === 'formula' ? (
      <>
        <Text>{b.text}</Text>
        <div className="mt-3">
          <Formula data={b.data} />
        </div>
      </>
    ) : b.type === 'example' ? (
      <Example data={b.data} />
    ) : b.type === 'mistake' ? (
      <>
        <Text>{b.text}</Text>
        <div className="mt-3">
          <Mistake data={b.data} />
        </div>
      </>
    ) : b.type === 'reveal' ? (
      <>
        <Text>{b.text}</Text>
        <div className="mt-3">
          <Reveal data={b.data} />
        </div>
      </>
    ) : b.type === 'cards' ? (
      <>
        <Text>{b.text}</Text>
        <div className="mt-3">
          <Cards cards={b.data.cards || []} />
        </div>
      </>
    ) : b.type === 'check' ? (
      <>
        {b.text && <Text>{b.text}</Text>}
        {figure && <div className="mt-3">{figure}</div>}
        <div className="mt-3">
          <Interaction c={b.data} result={result} onResult={onResult} />
        </div>
      </>
    ) : (
      <>
        <Text big={b.type === 'key_point' || b.type === 'analogy'}>{b.text}</Text>
        <Points points={b.points} />
      </>
    )
  const inner = (
    <>
      {LABEL[b.type] && (
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone?.color || 'var(--text-faint)' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone?.color || 'var(--text-faint)' }} />
          {LABEL[b.type]}
        </p>
      )}
      {b.title && b.title.trim().toLowerCase() !== String(LABEL[b.type] || '').toLowerCase() && (
        <h3 className={`${LABEL[b.type] ? 'mt-1.5 ' : ''}text-[17px] font-semibold leading-snug`}>{b.title}</h3>
      )}
      <div className={LABEL[b.type] || b.title ? 'mt-2.5' : ''}>{content}</div>
      {b.type !== 'check' && figure && <div className="mt-4">{figure}</div>}
    </>
  )
  if (tinted) {
    return (
      <div className="rounded-[18px] border-l-4 p-5" style={{ borderColor: tone.color, background: tone.bg }}>
        {inner}
      </div>
    )
  }
  if (boxed) {
    return (
      <div className="rounded-[18px] border p-5" style={{ borderColor: `color-mix(in oklab, ${tone.color} 45%, var(--border))`, background: tone.bg }}>
        {inner}
      </div>
    )
  }
  return <div>{inner}</div>
}

const REASONS = ['Something is wrong', 'It is confusing', 'A typo or display problem', 'Something else']

function Report({ onSend, onClose }) {
  const [reason, setReason] = useState(REASONS[0])
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Report this screen">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="pop-enter relative w-full max-w-md rounded-t-[20px] border p-5 sm:rounded-[20px]" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        {sent ? (
          <>
            <p className="text-[16px] font-semibold">Thank you. We will look at it.</p>
            <button type="button" onClick={onClose} className="btn btn-solid control-md mt-4">
              Close
            </button>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setSent(await onSend(reason, note.trim()))
            }}
          >
            <p className="text-[16px] font-semibold">Report this screen</p>
            <div className="mt-3 flex flex-col gap-2">
              {REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2.5 text-[14.5px]">
                  <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                  {r}
                </label>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="What is wrong? (optional)" className="input mt-3 w-full py-2 text-[16px] sm:text-[14.5px]" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="btn btn-quiet control-md">
                Cancel
              </button>
              <button type="submit" className="btn btn-solid control-md">
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function FramePlayer({ lesson, met = [], onProgress, onAddCards, onReport, practiseHref, backHref, backLabel = 'Back' }) {
  const body = lesson.body || {}
  const screens = body.version === 3 ? body.screens || [] : (body.frames || []).map((f) => ({ title: '', blocks: [f] }))
  const outcomes = lesson.outcomes || []
  const total = screens.length + 2 // overview, screens, what you should know
  const [at, setAt] = useState(0)
  const [dir, setDir] = useState('next')
  const [results, setResults] = useState({})
  const [reporting, setReporting] = useState(false)
  const [added, setAdded] = useState(null)

  const screen = at >= 1 && at <= screens.length ? screens[at - 1] : null
  // Every check on the screen answered before moving on.
  const gated = Boolean(screen?.blocks.some((b, bi) => b.type === 'check' && !results[`s${at - 1}b${bi}`]))
  const finale = at === total - 1
  const outcomesDone = outcomes.length > 0 && outcomes.every((_, i) => results[`o${i}`])
  const missed = outcomes.map((o, i) => ({ o, i })).filter(({ i }) => results[`o${i}`] && !results[`o${i}`].correct)

  const go = (d) => {
    const next = Math.min(total - 1, Math.max(0, at + d))
    if (next === at || (d > 0 && gated)) return
    setDir(d > 0 ? 'next' : 'prev')
    setAt(next)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select, [role="dialog"]')) return
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const record = (key, r) => {
    const next = { ...results, [key]: r }
    setResults(next)
    if (key.startsWith('o')) {
      const metNow = outcomes.map((_, i) => i).filter((i) => next[`o${i}`]?.correct || met.includes(i))
      onProgress?.(metNow, outcomes.every((_, i) => next[`o${i}`]))
    }
  }

  const addMissed = async () => {
    setAdded('saving')
    const ok = await onAddCards?.(
      missed.map(({ o }) => {
        const c = o.check
        const front = c.kind === 'truefalse' ? `True or false: ${c.statement}` : c.prompt
        const answer = c.kind === 'mcq' ? c.options.find((x) => x.id === c.answer)?.text : c.kind === 'truefalse' ? (c.answer ? 'True' : 'False') : c.answer ?? (c.accepted || [])[0]
        return { front, back: `${answer ?? ''}. ${c.wrong || ''}`.trim() }
      })
    )
    setAdded(ok ? 'done' : null)
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <Link href={backHref} className="btn btn-quiet control-sm">
          <IconArrowLeft width={14} height={14} />
          {backLabel}
        </Link>
        <div className="flex items-center gap-2">
          <AskSyllabi
            size="xs"
            subject={lesson.subject}
            topic={lesson.subtopic}
            context={`${lesson.subject} · ${displaySubtopic(lesson.subtopic)}`}
            label="Ask Syllabi"
          />
          <button type="button" onClick={() => setReporting(true)} className="btn btn-quiet control-sm" title="Report this screen">
            Report
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= at ? 'var(--brand)' : 'var(--border)' }} />
        ))}
      </div>

      <section key={at} className={`${dir === 'next' ? 'frame-in-next' : 'frame-in-prev'} mt-6 min-h-[52vh] rounded-[22px] border p-5 sm:p-8`} style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        {at === 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              {lesson.subject} · Lesson{body.overview?.minutes ? ` · about ${body.overview.minutes} min` : ''}
            </p>
            <h1 className="mt-2 text-[clamp(1.7rem,4.4vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{displaySubtopic(lesson.subtopic)}</h1>
            {body.hook && (
              <p className="mt-3 text-[18px] leading-relaxed" style={{ color: 'var(--brand)' }}>
                <MathText>{body.hook}</MathText>
              </p>
            )}
            {body.overview?.why && (
              <p className="mt-4 text-[16px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
                <MathText>{body.overview.why}</MathText>
              </p>
            )}
            {body.overview?.learn?.length > 0 && (
              <div className="mt-6 rounded-[18px] p-5" style={{ background: 'var(--surface-sunken)' }}>
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                  By the end you will be able to
                </p>
                <ul className="stagger mt-3 flex flex-col gap-2.5">
                  {body.overview.learn.map((x, i) => (
                    <li key={i} className="flex gap-2.5 text-[15.5px] leading-relaxed">
                      <IconCheck width={15} height={15} className="mt-1 shrink-0" style={{ color: 'var(--brand)' }} />
                      <span>
                        <MathText>{x}</MathText>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : screen ? (
          <div>
            {screen.title && <h2 className="text-[clamp(1.35rem,3.6vw,1.7rem)] font-semibold leading-tight tracking-[-0.02em]">{screen.title}</h2>}
            <div className={`stagger flex flex-col gap-5 ${screen.title ? 'mt-5' : ''}`}>
              {screen.blocks.map((b, bi) => (
                <Block key={bi} b={b} result={results[`s${at - 1}b${bi}`]} onResult={(r) => record(`s${at - 1}b${bi}`, r)} />
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--brand)' }}>
              What you should know now
            </p>
            <h2 className="mt-1.5 text-[clamp(1.3rem,3.4vw,1.6rem)] font-semibold leading-tight">Show you can do each one</h2>
            {outcomes.map((o, i) => {
              const r = results[`o${i}`]
              return (
                <div key={i} className="mt-7">
                  <p className="flex items-start gap-2 text-[15.5px] font-semibold leading-snug">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: r ? (r.correct ? 'var(--status-proficient)' : 'var(--status-weak)') : 'var(--border-strong)' }}>
                      {r?.correct && <IconCheck width={11} height={11} />}
                    </span>
                    <MathText>{o.statement}</MathText>
                  </p>
                  <div className="mt-3">
                    <Interaction c={o.check} result={r} onResult={(x) => record(`o${i}`, x)} />
                  </div>
                </div>
              )
            })}
            {outcomesDone && (
              <div className="pop-enter mt-8 rounded-[18px] p-5" style={{ background: missed.length ? 'var(--surface-sunken)' : 'var(--brand-tint)' }}>
                <p className="text-[17px] font-semibold">{missed.length ? `You showed ${outcomes.length - missed.length} of ${outcomes.length}.` : 'You can do everything this lesson covers.'}</p>
                <p className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                  {missed.length ? 'Go back over the ones you missed, then practise.' : 'Practise now while it is fresh, and it will stick.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {missed.length > 0 && (
                    <button type="button" onClick={addMissed} disabled={added != null} className="btn btn-outline control-md disabled:opacity-60">
                      {added === 'done' ? 'Added to your flashcards' : added === 'saving' ? 'Adding…' : `Add ${missed.length === 1 ? 'it' : 'them'} to my flashcards`}
                    </button>
                  )}
                  <Link href={practiseHref} className="btn btn-solid control-md">
                    Practise this subtopic
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={() => go(-1)} disabled={at === 0} className="btn btn-quiet control-md disabled:opacity-40">
          <IconArrowLeft width={15} height={15} />
          Back
        </button>
        <div className="flex-1" />
        {!finale && (
          <button type="button" onClick={() => go(1)} disabled={gated} className="btn btn-solid control-lg disabled:opacity-40" title={gated ? 'Answer first' : undefined}>
            {at === 0 ? 'Start' : 'Continue'}
            <IconArrowRight width={15} height={15} />
          </button>
        )}
      </div>

      {reporting && (
        <Report
          onClose={() => setReporting(false)}
          onSend={async (reason, note) => (await onReport?.({ screen: at, title: screen?.title || screen?.blocks?.[0]?.title || (at === 0 ? 'Overview' : 'What you should know now'), reason, note })) ?? true}
        />
      )}
    </div>
  )
}
