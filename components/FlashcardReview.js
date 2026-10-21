'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import MathText from '@/components/MathText'
import { IconCheck, IconClose, IconArrowLeft, IconArrowRight } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { requeue, shuffleCards } from '@/lib/flashcards'
import CardMenu from '@/components/CardMenu'
import AgainChoice, { againFromKey } from '@/components/flashcards/AgainChoice'
import { AskSyllabi } from '@/components/syllabi/SyllabiDrawer'

/**
 * Full-screen flashcard review.
 *
 * Takes over the whole viewport on purpose: a card you are trying to recall
 * should not share the screen with a sidebar and a study plan. The card turns
 * over rather than swapping panels, because turning is what makes it read as
 * one object with two sides.
 *
 * The deck is shuffled, and it loops. Reaching the last card deals the deck
 * again in a new order rather than ending, so the order is never something
 * you can learn instead of the cards, and the session lasts as long as the
 * student wants it to. "End" is how it stops.
 *
 * Missing a card asks when it should come back, and nothing else moves until
 * that is answered: no flipping, no going to another card. Before, the
 * arrows still worked, so you could wander off mid-question, every card you
 * landed on shook as if you had missed it too, and the answer you then gave
 * was filed against the wrong card.
 *
 * A card is marked once. Going back to one you have answered shows what you
 * said rather than offering the buttons again, so one card cannot be counted
 * twice.
 *
 * Keyboard: space or up to flip, arrows to move, 1 missed, 2 got it, and 1
 * to 4 to choose when a missed card returns.
 */
export default function FlashcardReview({ cards, onMark, onEdit, onDelete, onExit }) {
  const [queue, setQueue] = useState(() => shuffleCards(cards))
  // Where each round starts in the queue. A round is one pass through the deck.
  const [rounds, setRounds] = useState([0])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // A missed card waits here until it is told when to come back.
  const [missed, setMissed] = useState(null)
  // What was said about each position in the queue: 'right' or 'wrong'.
  const [answered, setAnswered] = useState({})
  const [direction, setDirection] = useState('next')
  const [summary, setSummary] = useState(false)
  const containerRef = useRef(null)

  const card = queue[index]
  const verdict = answered[index]
  const atStart = index === 0
  const right = Object.values(answered).filter((v) => v === 'right').length
  const wrong = Object.values(answered).filter((v) => v === 'wrong').length

  const round = rounds.filter((start) => start <= index).length
  const roundStart = rounds[round - 1]
  const roundEnd = rounds[round] ?? queue.length

  /** One card on. Past the last card, the deck is dealt again. */
  const advance = useCallback(
    (list = queue) => {
      setDirection('next')
      if (index < list.length - 1) {
        setFlipped(Boolean(answered[index + 1]))
        setQueue(list)
      } else {
        setFlipped(false)
        setQueue([...list, ...shuffleCards(cards, list[index])])
        setRounds((r) => [...r, list.length])
      }
      setIndex(index + 1)
    },
    [queue, index, answered, cards]
  )

  const go = useCallback(
    (delta) => {
      if (missed) return
      if (delta > 0) return advance()
      const next = Math.max(0, index + delta)
      if (next === index) return
      setDirection('prev')
      setFlipped(Boolean(answered[next]))
      setIndex(next)
    },
    [missed, index, answered, advance]
  )

  const mark = useCallback(
    (correct) => {
      if (!card || verdict) return
      onMark(card, correct)
      setAnswered((a) => ({ ...a, [index]: correct ? 'right' : 'wrong' }))
      // Right moves on. Wrong stays on the answer and asks when to bring it back.
      if (correct) advance()
      else setMissed(card)
    },
    [card, verdict, onMark, index, advance]
  )

  /** The missed card goes back in where the student asked, and on we go. */
  const again = useCallback(
    (choice) => {
      if (!missed) return
      const next = requeue(queue, index, missed, choice)
      setMissed(null)
      advance(next)
    },
    [missed, queue, index, advance]
  )

  const flip = useCallback(() => {
    if (verdict) return
    setFlipped((f) => !f)
  }, [verdict])

  const end = useCallback(() => {
    if (right + wrong === 0) return onExit({ finished: false })
    setSummary(true)
  }, [right, wrong, onExit])

  useEffect(() => {
    const onKey = (e) => {
      // Typing to Syllabi, or in any box, is not a shortcut.
      if (e.target?.closest?.('input, textarea, select, [role="menu"]')) return
      if (e.key === 'Escape') return onExit({ finished: false })
      if (summary) return
      if (missed) {
        const choice = againFromKey(e.key)
        if (choice) {
          e.preventDefault()
          again(choice)
        }
        return
      }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        return flip()
      }
      if (e.key === 'ArrowRight') return go(1)
      if (e.key === 'ArrowLeft') return go(-1)
      if (flipped && (e.key === '1' || e.key.toLowerCase() === 'n')) return mark(false)
      if (flipped && (e.key === '2' || e.key.toLowerCase() === 'y')) return mark(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, mark, flip, flipped, onExit, missed, again, summary])

  // Keep the page behind from scrolling under the overlay.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    containerRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!card) return null
  const progress = ((index - roundStart + (verdict ? 1 : 0)) / Math.max(1, roundEnd - roundStart)) * 100

  return (
    <div ref={containerRef} tabIndex={-1} className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]" role="dialog" aria-modal="true" aria-label="Flashcard review">
      {/* Progress and exit */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="h-1 w-full bg-[var(--surface-sunken)]">
          <div className="h-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <p className="flex items-center gap-3 text-[13px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>
              {index - roundStart + 1} / {roundEnd - roundStart}
            </span>
            {round > 1 && <span>Round {round}</span>}
            {right + wrong > 0 && (
              <>
                <span className="inline-flex items-center gap-1" style={{ color: 'var(--status-proficient)' }}>
                  <IconCheck width={13} height={13} /> {right}
                </span>
                <span className="inline-flex items-center gap-1" style={{ color: 'var(--status-weak)' }}>
                  <IconClose width={12} height={12} /> {wrong}
                </span>
              </>
            )}
          </p>
          <button onClick={end} className="btn btn-quiet control-sm">
            <IconClose width={14} height={14} />
            End
          </button>
        </div>
      </div>

      {summary ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="pop-enter w-full max-w-md rounded-[22px] border p-8 text-center" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              This session
            </p>
            <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {right}
              <span className="text-[18px] font-medium" style={{ color: 'var(--text-faint)' }}>
                {' '}
                / {right + wrong}
              </span>
            </p>
            <p className="mt-2 text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {wrong ? `${wrong} missed. Those come up more often from now on.` : 'Every one right.'}
            </p>
            <div className="mt-7 flex gap-2">
              <button onClick={() => setSummary(false)} className="btn btn-outline control-lg flex-1">
                Keep going
              </button>
              <button onClick={() => onExit({ finished: true })} className="btn btn-solid control-lg flex-1">
                Done
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* The card */}
          <div className="flex flex-1 items-center justify-center overflow-hidden p-5">
            <div className="card-stage w-full max-w-4xl">
              {/* The shake lives on its own layer, keyed to this card and this
                  miss, so it plays once and only here. */}
              <div className={missed ? 'card-wrong' : ''}>
                <div
                  key={index}
                  onClick={flip}
                  className={`card-flip ${flipped ? 'is-flipped' : ''} ${direction === 'next' ? 'card-enter-next' : 'card-enter-prev'} ${missed || verdict ? 'cursor-default' : 'cursor-pointer'}`}
                  style={{ height: 'min(66vh, 600px)' }}
                >
                  {/* Front */}
                  <div className="card-face surface p-7 md:p-12">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <p className="t-caption">
                        {card.subject}
                        {card.subtopic ? ` · ${displaySubtopic(card.subtopic)}` : ''}
                      </p>
                      <div onClick={(e) => e.stopPropagation()}>
                        <CardMenu card={card} onEdit={onEdit} onDelete={onDelete} />
                      </div>
                    </div>
                    <div className="flex flex-1 items-center">
                      <p className="whitespace-pre-wrap text-2xl leading-relaxed text-[var(--text)] md:text-3xl">
                        <MathText>{card.front}</MathText>
                      </p>
                    </div>
                    <p className="t-caption mt-4">Tap the card, or press space, to turn it over</p>
                  </div>

                  {/* Back */}
                  <div className="card-face card-face-back surface p-7 md:p-12">
                    <p className="t-overline mb-4">Answer</p>
                    <div className="flex flex-1 items-center">
                      <p className="whitespace-pre-wrap text-xl leading-relaxed text-[var(--text-body)] md:text-2xl">
                        <MathText>{card.back}</MathText>
                      </p>
                    </div>
                    {verdict && !missed && (
                      <p className="mt-4 text-[13px] font-medium" style={{ color: verdict === 'right' ? 'var(--status-proficient)' : 'var(--status-weak)' }}>
                        {verdict === 'right' ? 'You got this one.' : 'You missed this one.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-4">
            {missed ? (
              <AgainChoice onChoose={again} />
            ) : (
              <div className="mx-auto flex max-w-4xl items-center gap-2">
                <button onClick={() => go(-1)} disabled={atStart} aria-label="Previous card" className="btn btn-quiet control-lg w-12 shrink-0 px-0 disabled:opacity-30">
                  <IconArrowLeft width={18} height={18} />
                </button>

                {verdict ? (
                  <button onClick={() => advance()} className="btn btn-outline control-lg flex-1">
                    Next card
                  </button>
                ) : flipped ? (
                  <>
                    <button onClick={() => mark(false)} className="btn btn-quiet control-lg flex-1 border-[var(--danger-border)] text-[var(--danger)]">
                      <IconClose width={16} height={16} />
                      Missed it
                    </button>
                    <button onClick={() => mark(true)} className="btn btn-solid control-lg flex-1">
                      <IconCheck width={16} height={16} />
                      Got it
                    </button>
                  </>
                ) : (
                  <button onClick={flip} className="btn btn-solid control-lg flex-1">
                    Show answer
                  </button>
                )}

                <button onClick={() => go(1)} aria-label="Next card" className="btn btn-quiet control-lg w-12 shrink-0 px-0">
                  <IconArrowRight width={18} height={18} />
                </button>
              </div>
            )}

            {flipped && !missed && (
              <div className="mt-3 flex justify-center">
                <AskSyllabi
                  subject={card.subject}
                  topic={card.subtopic}
                  context={`Flashcard · ${card.subject}`}
                  label="Explain this card"
                  text={`Help me really understand this flashcard from ${card.subject}${card.subtopic ? ` (${displaySubtopic(card.subtopic)})` : ''}.\n\nFront: ${String(card.front).slice(0, 700)}\nBack: ${String(card.back).slice(0, 700)}\n\nExplain it simply, give me an example and a way to remember it, then ask me one quick question to check.`}
                />
              </div>
            )}

            <p className="t-caption mt-3 hidden text-center md:block">
              {missed ? '1 soon · 2 in a bit · 3 later · 4 at the end' : 'Space to flip · arrows to move · 1 missed, 2 got it · Esc to leave'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
