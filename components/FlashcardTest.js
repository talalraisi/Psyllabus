'use client'

import { useEffect, useMemo, useState } from 'react'
import MathText from '@/components/MathText'
import { IconCheck, IconClose } from '@/components/Icons'
import { buildTest, scoreTest } from '@/lib/flashcard-modes'

/**
 * A paper built out of the deck, marked at the end.
 *
 * The difference from the other modes is that nothing is revealed until it
 * is over. Flip and write both tell you immediately, which is right for
 * learning and wrong for finding out where you stand — a mode that marks as
 * it goes lets you stop when it starts going badly, which is exactly the
 * information you came for.
 *
 * It is still a deck: every question sits on a card, the cards still to
 * come are stacked behind it, and the results come back as cards too.
 *
 * The mix of written, multiple choice and true-false is deliberate: any one
 * of them alone measures something narrower than the deck.
 */
export default function FlashcardTest({ cards, onMark, onExit }) {
  const [seed] = useState(() => Math.floor(Math.random() * 100000))
  const items = useMemo(
    () => buildTest(cards, { length: Math.min(20, cards.length), seed }),
    [cards, seed]
  )
  const [responses, setResponses] = useState({})
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(null)
  const [direction, setDirection] = useState('next')

  const item = items[index]
  const atEnd = index >= items.length - 1
  const given = responses[index]
  const answered = given != null && String(given).trim() !== ''

  const finish = () => {
    const result = scoreTest(items, items.map((_, i) => responses[i]))
    setDone(result)
    // Every card in the paper gets its schedule moved, once.
    for (const m of result.marked) onMark?.(m.card, m.correct)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onExit({ finished: false })
      const typing = document.activeElement?.tagName === 'INPUT'
      if (e.key === 'Enter' && !typing && answered) {
        e.preventDefault()
        if (atEnd) finish()
        else {
          setDirection('next')
          setIndex((i) => i + 1)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!items.length) return null

  if (done) {
    const pct = Math.round((done.correct / done.total) * 100)
    const said = (m) =>
      m.kind === 'choice'
        ? m.options.find((o) => o.id === m.given)?.text
        : m.kind === 'truefalse'
          ? m.given === true
            ? 'That is right'
            : m.given === false
              ? 'That is wrong'
              : ''
          : m.given
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]">
        <div className="mx-auto max-w-4xl px-5 py-10">
          <div className="flashcard pop-enter mx-auto max-w-md p-8 text-center">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              Your result
            </p>
            <p className="mt-3 text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {done.correct}
              <span className="text-[18px] font-medium" style={{ color: 'var(--text-faint)' }}>
                {' '}
                / {done.total}
              </span>
            </p>
            <p className="mt-2 text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {pct}%. The cards you missed come up more often from now on.
            </p>
            <button onClick={() => onExit({ finished: true })} className="btn btn-solid control-lg mt-6 w-full">
              Done
            </button>
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {done.marked.map((m, i) => (
              <li
                key={i}
                className="flashcard verdict-in flex flex-col p-5"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms`, borderColor: m.correct ? undefined : 'var(--danger-border)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="t-caption">Card {i + 1}</p>
                  {m.correct ? (
                    <IconCheck width={15} height={15} style={{ color: 'var(--status-proficient)' }} />
                  ) : (
                    <IconClose width={15} height={15} style={{ color: 'var(--status-weak)' }} />
                  )}
                </div>
                <p className="mt-2 text-[14.5px] font-medium leading-snug">
                  <MathText>{m.prompt}</MathText>
                </p>
                <div className="mt-3 border-t pt-3 text-[13px] leading-relaxed" style={{ borderColor: 'var(--border)' }}>
                  {!m.correct && said(m) && (
                    <p style={{ color: 'var(--text-faint)' }}>
                      You: <MathText>{String(said(m))}</MathText>
                    </p>
                  )}
                  <p style={{ color: m.correct ? 'var(--text-muted)' : 'var(--text-body)' }}>
                    {!m.correct && <span style={{ color: 'var(--status-proficient)' }}>Answer: </span>}
                    <MathText>{m.card.back}</MathText>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  const set = (v) => setResponses((r) => ({ ...r, [index]: v }))
  const move = (delta) => {
    setDirection(delta > 0 ? 'next' : 'prev')
    setIndex((i) => Math.min(items.length - 1, Math.max(0, i + delta)))
  }
  const left = items.length - index - 1
  const kindLabel = item.kind === 'choice' ? 'Pick one' : item.kind === 'truefalse' ? 'True or false' : 'Write it'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="h-1 w-full bg-[var(--surface-sunken)]">
          <div className="h-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <button onClick={() => onExit({ finished: false })} className="btn btn-quiet control-sm">
            Leave
          </button>
          <span className="flex-1 text-[12.5px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
            {index + 1} / {items.length}
          </span>
          <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            Marked at the end
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-y-auto p-5">
        <div className="w-full max-w-2xl pt-4 md:pt-10">
          {/* The deck: this card on top, the ones still to come behind it. */}
          <div className="relative pb-5">
            {left >= 2 && (
              <div aria-hidden className="flashcard absolute inset-x-6 bottom-0 top-6" style={{ opacity: 0.45 }} />
            )}
            {left >= 1 && (
              <div aria-hidden className="flashcard absolute inset-x-3 bottom-2.5 top-3" style={{ opacity: 0.75 }} />
            )}
            <div
              key={index}
              className={`flashcard relative p-7 md:p-10 ${direction === 'next' ? 'card-enter-next' : 'card-enter-prev'}`}
              style={{ minHeight: 'min(46vh, 380px)' }}
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <p className="t-caption">{item.card.subject || 'Flashcards'}</p>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                  {kindLabel}
                </span>
              </div>

              <p className="whitespace-pre-wrap text-[21px] leading-relaxed md:text-[25px]">
                <MathText>{item.prompt}</MathText>
              </p>

              {item.kind === 'written' && (
                <input
                  autoFocus
                  value={given ?? ''}
                  onChange={(e) => set(e.target.value)}
                  placeholder="Type the answer"
                  autoComplete="off"
                  className="input mt-7 w-full text-[16px]"
                />
              )}

              {item.kind === 'choice' && (
                <div className="mt-6 flex flex-col gap-2">
                  {item.options.map((o, i) => (
                    <button
                      key={o.id}
                      onClick={() => set(o.id)}
                      className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 text-left text-[14.5px] ${given === o.id ? 'chip-active' : 'chip'}`}
                    >
                      <span className="mt-px text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-faint)' }}>
                        {'ABCD'[i]}
                      </span>
                      <span className="min-w-0">
                        <MathText>{o.text}</MathText>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {item.kind === 'truefalse' && (
                <>
                  <div className="mt-6 border-t border-dashed pt-5" style={{ borderColor: 'var(--border-strong)' }}>
                    <p className="t-overline mb-2">On the back</p>
                    <p className="whitespace-pre-wrap text-[16px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      <MathText>{item.shown}</MathText>
                    </p>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button onClick={() => set(true)} className={given === true ? 'btn btn-solid control-lg' : 'btn btn-outline control-lg'}>
                      That is right
                    </button>
                    <button onClick={() => set(false)} className={given === false ? 'btn btn-solid control-lg' : 'btn btn-outline control-lg'}>
                      That is wrong
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button onClick={() => move(-1)} disabled={index === 0} className="btn btn-quiet control-md disabled:opacity-40">
              Back
            </button>
            <div className="flex-1" />
            <button
              onClick={() => (atEnd ? finish() : move(1))}
              disabled={!answered}
              className="btn btn-solid control-md disabled:opacity-40"
            >
              {atEnd ? 'Mark it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
