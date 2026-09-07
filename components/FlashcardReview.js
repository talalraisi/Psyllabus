'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { IconCheck, IconClose, IconArrowLeft, IconArrowRight } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'

/**
 * Full-screen flashcard review.
 *
 * Takes over the whole viewport on purpose: a card you are trying to recall
 * should not share the screen with a sidebar and a study plan. The card turns
 * over rather than swapping panels, because turning is what makes it read as
 * one object with two sides.
 *
 * Keyboard throughout, since this is the one screen somebody will sit on for
 * twenty minutes: space or up to flip, arrows to move, 1 and 2 to mark.
 */
export default function FlashcardReview({ cards, onMark, onExit, stats }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [direction, setDirection] = useState('next')
  const containerRef = useRef(null)

  const card = cards[index]
  const atStart = index === 0
  const atEnd = index >= cards.length - 1

  const go = useCallback(
    (delta) => {
      setIndex((i) => {
        const next = Math.min(cards.length - 1, Math.max(0, i + delta))
        if (next !== i) {
          setDirection(delta > 0 ? 'next' : 'prev')
          setFlipped(false)
        }
        return next
      })
    },
    [cards.length]
  )

  const mark = useCallback(
    (correct) => {
      if (!card) return
      onMark(card, correct)
      // Marking is also a decision to move on, which is what makes the session
      // flow without a separate "next" press on every card.
      if (!atEnd) {
        setDirection('next')
        setFlipped(false)
        setIndex((i) => i + 1)
      } else {
        onExit({ finished: true })
      }
    },
    [card, atEnd, onMark, onExit]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onExit({ finished: false })
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        return setFlipped((f) => !f)
      }
      if (e.key === 'ArrowRight') return go(1)
      if (e.key === 'ArrowLeft') return go(-1)
      if (flipped && (e.key === '1' || e.key.toLowerCase() === 'n')) return mark(false)
      if (flipped && (e.key === '2' || e.key.toLowerCase() === 'y')) return mark(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, mark, flipped, onExit])

  // Keep the page behind from scrolling under the overlay.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    containerRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!card) return null

  const done = stats.right + stats.wrong
  const progress = cards.length ? (done / cards.length) * 100 : 0

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Flashcard review"
    >
      {/* Progress and exit */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="h-1 w-full bg-[var(--surface-sunken)]">
          <div
            className="h-full bg-[var(--brand)] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <p className="t-small tabular-nums">
            {index + 1} of {cards.length}
            {done > 0 && (
              <span className="ml-3 text-[var(--text-faint)]">
                {stats.right} right · {stats.wrong} to redo
              </span>
            )}
          </p>
          <button onClick={() => onExit({ finished: false })} className="btn btn-quiet control-sm text-xs">
            <IconClose width={14} height={14} />
            End
          </button>
        </div>
      </div>

      {/* The card */}
      <div className="flex flex-1 items-center justify-center overflow-hidden p-5">
        <div className="card-stage w-full max-w-2xl">
          <div
            key={card.id}
            onClick={() => setFlipped((f) => !f)}
            className={`card-flip ${flipped ? 'is-flipped' : ''} ${
              direction === 'next' ? 'card-enter-next' : 'card-enter-prev'
            } cursor-pointer`}
            style={{ height: 'min(60vh, 420px)' }}
          >
            {/* Front */}
            <div className="card-face surface p-7 md:p-10">
              <p className="t-caption mb-4">
                {card.subject}
                {card.subtopic ? ` · ${displaySubtopic(card.subtopic)}` : ''}
              </p>
              <div className="flex flex-1 items-center">
                <p className="whitespace-pre-wrap text-xl leading-relaxed text-[var(--text)] md:text-2xl">
                  {card.front}
                </p>
              </div>
              <p className="t-caption mt-4">Tap the card, or press space, to turn it over</p>
            </div>

            {/* Back */}
            <div className="card-face card-face-back surface p-7 md:p-10">
              <p className="t-overline mb-4">Answer</p>
              <div className="flex flex-1 items-center">
                <p className="whitespace-pre-wrap text-lg leading-relaxed text-[var(--text-body)]">
                  {card.back}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            onClick={() => go(-1)}
            disabled={atStart}
            aria-label="Previous card"
            className="btn btn-quiet control-lg w-12 shrink-0 px-0 disabled:opacity-30"
          >
            <IconArrowLeft width={18} height={18} />
          </button>

          {flipped ? (
            <>
              <button
                onClick={() => mark(false)}
                className="btn btn-quiet control-lg flex-1 border-[var(--danger-border)] text-[var(--danger)]"
              >
                <IconClose width={16} height={16} />
                Missed it
              </button>
              <button onClick={() => mark(true)} className="btn btn-solid control-lg flex-1">
                <IconCheck width={16} height={16} />
                Got it
              </button>
            </>
          ) : (
            <button onClick={() => setFlipped(true)} className="btn btn-solid control-lg flex-1">
              Show answer
            </button>
          )}

          <button
            onClick={() => go(1)}
            disabled={atEnd}
            aria-label="Next card"
            className="btn btn-quiet control-lg w-12 shrink-0 px-0 disabled:opacity-30"
          >
            <IconArrowRight width={18} height={18} />
          </button>
        </div>

        <p className="t-caption mt-3 hidden text-center md:block">
          Space to flip · arrows to move · 1 missed, 2 got it · Esc to leave
        </p>
      </div>
    </div>
  )
}
