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
        else setIndex((i) => i + 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!items.length) return null

  if (done) {
    const pct = Math.round((done.correct / done.total) * 100)
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)]">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <p className="t-overline mb-3">Result</p>
          <h1 className="text-[clamp(1.8rem,4vw,2.4rem)] font-semibold tracking-[-0.03em]">
            {done.correct} of {done.total}
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: 'var(--text-muted)' }}>
            {pct}% · every card in this paper has been rescheduled.
          </p>

          <ul className="mt-8 flex flex-col">
            {done.marked.map((m, i) => (
              <li key={i} className="border-b py-4 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">
                    {m.correct ? (
                      <IconCheck width={15} height={15} style={{ color: 'var(--status-proficient)' }} />
                    ) : (
                      <IconClose width={15} height={15} style={{ color: 'var(--status-weak)' }} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium">
                      <MathText>{m.prompt}</MathText>
                    </p>
                    {!m.correct && (
                      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                        <MathText>{m.card.back}</MathText>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <button onClick={() => onExit({ finished: true })} className="btn btn-solid control-md mt-8">
            Done
          </button>
        </div>
      </div>
    )
  }

  const set = (v) => setResponses((r) => ({ ...r, [index]: v }))

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <button onClick={() => onExit({ finished: false })} className="btn btn-quiet control-sm">
            Leave
          </button>
          <span className="flex-1 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {index + 1} of {items.length}
          </span>
          <span className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            Marked at the end
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-y-auto p-5">
        <div className="w-full max-w-3xl pt-6 md:pt-14">
          <p className="whitespace-pre-wrap text-[21px] leading-relaxed md:text-[25px]">
            <MathText>{item.prompt}</MathText>
          </p>

          {item.kind === 'written' && (
            <input
              value={given ?? ''}
              onChange={(e) => set(e.target.value)}
              placeholder="Type the answer"
              autoComplete="off"
              className="input mt-6 w-full text-[16px]"
            />
          )}

          {item.kind === 'choice' && (
            <div className="mt-6 flex flex-col gap-2">
              {item.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => set(o.id)}
                  className={`rounded-[10px] border px-4 py-3 text-left text-[14.5px] ${
                    given === o.id ? 'chip-active' : 'chip'
                  }`}
                >
                  <MathText>{o.text}</MathText>
                </button>
              ))}
            </div>
          )}

          {item.kind === 'truefalse' && (
            <>
              <p
                className="mt-5 rounded-[10px] border p-4 text-[15px]"
                style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
              >
                <MathText>{item.shown}</MathText>
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => set(true)}
                  className={given === true ? 'btn btn-solid control-md' : 'btn btn-outline control-md'}
                >
                  That is right
                </button>
                <button
                  onClick={() => set(false)}
                  className={given === false ? 'btn btn-solid control-md' : 'btn btn-outline control-md'}
                >
                  That is wrong
                </button>
              </div>
            </>
          )}

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="btn btn-quiet control-md disabled:opacity-40"
            >
              Back
            </button>
            <div className="flex-1" />
            <button
              onClick={() => (atEnd ? finish() : setIndex((i) => i + 1))}
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
