'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import MathText from '@/components/MathText'
import { IconCheck, IconClose, IconArrowLeft, IconArrowRight } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { SNOOZE_CHOICES } from '@/lib/flashcards'
import CardMenu from '@/components/CardMenu'
import { AskSyllabi } from '@/components/syllabi/SyllabiDrawer'

/**
 * Full-screen flashcard review.
 *
 * Takes over the whole viewport on purpose: a card you are trying to recall
 * should not share the screen with a sidebar and a study plan. The card turns
 * over rather than swapping panels, because turning is what makes it read as
 * one object with two sides.
 *
 * Missing a card stops the session to ask when it should come back, and
 * nothing else moves until that is answered: no flipping, no going to
 * another card. Before, the arrows still worked, so you could wander off
 * mid-question, every card you landed on shook as if you had missed it too,
 * and the answer you then gave was filed against the wrong card.
 *
 * A card is marked once. Going back to one you have answered shows what you
 * said rather than offering the buttons again, so one card cannot be counted
 * twice.
 *
 * Keyboard: space or up to flip, arrows to move, 1 missed, 2 got it, and 1
 * to 4 to choose when a missed card returns.
 */
export default function FlashcardReview({ cards, onMark, onSnooze, onEdit, onDelete, onExit }) {
  const [queue, setQueue] = useState(cards)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  // A missed card waits here until it is told when to come back.
  const [missed, setMissed] = useState(null)
  // What was said about each position in the queue: 'right' or 'wrong'.
  const [answered, setAnswered] = useState({})
  const [direction, setDirection] = useState('next')
  const [finished, setFinished] = useState(false)
  const containerRef = useRef(null)

  const card = queue[index]
  const verdict = answered[index]
  const atStart = index === 0
  const atEnd = index >= queue.length - 1
  const right = Object.values(answered).filter((v) => v === 'right').length
  const wrong = Object.values(answered).filter((v) => v === 'wrong').length

  const go = useCallback(
    (delta) => {
      if (missed) return
      const next = Math.min(queue.length - 1, Math.max(0, index + delta))
      if (next === index) return
      setDirection(delta > 0 ? 'next' : 'prev')
      setFlipped(Boolean(answered[next]))
      setIndex(next)
    },
    [missed, queue.length, index, answered]
  )

  const advance = useCallback(
    (length = queue.length) => {
      if (index < length - 1) {
        setDirection('next')
        setFlipped(Boolean(answered[index + 1]))
        setIndex(index + 1)
      } else {
        setFinished(true)
      }
    },
    [index, queue.length, answered]
  )

  const mark = useCallback(
    (correct) => {
      if (!card || missed || verdict) return
      onMark(card, correct)
      setAnswered((a) => ({ ...a, [index]: correct ? 'right' : 'wrong' }))
      // Getting it right is also a decision to move on. Getting it wrong
      // stops to ask when it should come back.
      if (correct) advance()
      else setMissed(card)
    },
    [card, missed, verdict, onMark, index, advance]
  )

  /** A missed card chooses its own interval; short ones rejoin this session. */
  const snooze = useCallback(
    (minutes) => {
      if (!missed) return
      onSnooze?.(missed, minutes)
      const length = minutes <= 10 ? queue.length + 1 : queue.length
      if (minutes <= 10) setQueue((q) => [...q, missed])
      setMissed(null)
      advance(length)
    },
    [missed, onSnooze, queue.length, advance]
  )

  const flip = useCallback(() => {
    if (missed || verdict) return
    setFlipped((f) => !f)
  }, [missed, verdict])

  useEffect(() => {
    const onKey = (e) => {
      // Typing to Syllabi, or in any box, is not a shortcut.
      if (e.target?.closest?.('input, textarea, select, [role="menu"]')) return
      if (e.key === 'Escape') return onExit({ finished: false })
      if (finished) return
      if (missed) {
        const n = Number(e.key)
        if (n >= 1 && n <= SNOOZE_CHOICES.length) {
          e.preventDefault()
          snooze(SNOOZE_CHOICES[n - 1].minutes)
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
  }, [go, mark, flip, flipped, onExit, missed, snooze, finished])

  // Keep the page behind from scrolling under the overlay.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    containerRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!card) return null
  const progress = queue.length ? (Object.keys(answered).length / queue.length) * 100 : 0

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
              {Math.min(index + 1, queue.length)} / {queue.length}
            </span>
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
          <button onClick={() => onExit({ finished: false })} className="btn btn-quiet control-sm">
            <IconClose width={14} height={14} />
            End
          </button>
        </div>
      </div>

      {finished ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="pop-enter w-full max-w-md rounded-[22px] border p-8 text-center" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              Session done
            </p>
            <p className="mt-3 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {right}
              <span className="text-[18px] font-medium" style={{ color: 'var(--text-faint)' }}>
                {' '}
                / {right + wrong}
              </span>
            </p>
            <p className="mt-2 text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {wrong ? `${wrong} to come back to. They are scheduled.` : 'Every one right. They move further out.'}
            </p>
            <button onClick={() => onExit({ finished: true })} className="btn btn-solid control-lg mt-7 w-full">
              Done
            </button>
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
                        {verdict === 'right' ? 'You got this one.' : 'You missed this one. It is scheduled to come back.'}
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
              <div className="verdict-in mx-auto max-w-2xl text-center">
                <p className="text-[13.5px] font-medium" style={{ color: 'var(--text)' }}>
                  When should this one come back?
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SNOOZE_CHOICES.map((c, i) => (
                    <button key={c.minutes} onClick={() => snooze(c.minutes)} className="btn btn-outline control-md justify-between">
                      {c.label}
                      <kbd className="hidden rounded-[5px] border px-1.5 text-[10.5px] sm:inline" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-faint)' }}>
                        {i + 1}
                      </kbd>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-4xl items-center gap-2">
                <button onClick={() => go(-1)} disabled={atStart} aria-label="Previous card" className="btn btn-quiet control-lg w-12 shrink-0 px-0 disabled:opacity-30">
                  <IconArrowLeft width={18} height={18} />
                </button>

                {verdict ? (
                  <button onClick={() => advance()} className="btn btn-outline control-lg flex-1">
                    {atEnd ? 'Finish' : 'Next card'}
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

                <button onClick={() => go(1)} disabled={atEnd} aria-label="Next card" className="btn btn-quiet control-lg w-12 shrink-0 px-0 disabled:opacity-30">
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
              {missed ? 'Press 1 to 4 to choose. Nothing else moves until you do.' : 'Space to flip · arrows to move · 1 missed, 2 got it · Esc to leave'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
