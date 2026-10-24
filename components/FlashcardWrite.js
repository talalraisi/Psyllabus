'use client'

import { useEffect, useRef, useState } from 'react'
import MathText from '@/components/MathText'
import CardMenu from '@/components/CardMenu'
import { IconCheck, IconClose } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { checkWritten, makeBlank } from '@/lib/flashcard-modes'
import { holdCard, releaseDue, untilLabel } from '@/lib/flashcards'
import AgainChoice, { againFromKey } from '@/components/flashcards/AgainChoice'

/**
 * Write the answer, rather than tell yourself you knew it.
 *
 * Flipping measures recognition and an exam asks for recall, which is why
 * this mode exists and why it is the one worth having first.
 *
 * Marking is on meaning, not on matching (lib/flashcard-modes.js), and when
 * the rule still gets it wrong the student can say so: "I was right" turns
 * the mark over. They have the answer in front of them and are the better
 * judge of whether they said it. Nothing is saved until the card is left,
 * so that change of mind is the one that counts.
 *
 * It happens on a card rather than on a form, because the deck should feel
 * like the same object in every mode.
 *
 * A missed card waits for the time the student picked and comes back as the
 * next card once it is due. If the deck runs out first, the screen waits
 * with a countdown rather than ending with a card still owed.
 *
 * `blank` hides one term inside the answer instead of asking for the whole
 * thing: the gentler version of the same question, and the right one for a
 * card met ten minutes ago.
 */
export default function FlashcardWrite({ cards, mode = 'write', onMark, onEdit, onDelete, onExit }) {
  const [queue, setQueue] = useState(cards)
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)
  const [tally, setTally] = useState({ right: 0, wrong: 0 })
  // Missed cards waiting for their time: [{ card, at }], soonest first.
  const [waiting, setWaiting] = useState([])
  // The deck is done but a missed card is still to come back.
  const [holding, setHolding] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const inputRef = useRef(null)

  const card = queue[index]
  const blank = mode === 'blank' && card ? makeBlank(card) : null
  const expected = blank ? blank.answer : card?.back
  const credit = Boolean(result && (result.correct || result.close || result.overruled))

  useEffect(() => {
    inputRef.current?.focus()
  }, [index])

  const submit = () => {
    if (result || !card || !value.trim()) return
    setResult(checkWritten(value, expected, blank ? '' : card.front))
  }

  /** Save the mark, then on to the next card (a due one first), or out at the end. */
  const leave = (correct, wait = waiting) => {
    onMark?.(card, correct)
    const next = { right: tally.right + (correct ? 1 : 0), wrong: tally.wrong + (correct ? 0 : 1) }
    setTally(next)
    const back = releaseDue(queue, index, wait)
    setQueue(back.queue)
    setWaiting(back.waiting)
    setValue('')
    setResult(null)
    if (index < back.queue.length - 1) return setIndex((i) => i + 1)
    if (!back.waiting.length) return onExit({ finished: true, tally: next })
    setNow(Date.now())
    setHolding(true)
  }

  /** The waiting card is back: now, or because the student did not want to wait. */
  const bringBack = (early = false) => {
    const back = releaseDue(queue, index, waiting, early ? waiting[0].at : Date.now())
    if (!back.added) return
    setQueue(back.queue)
    setWaiting(back.waiting)
    setHolding(false)
    setIndex((i) => i + 1)
  }

  // While holding, count down and bring the card back when it is due.
  useEffect(() => {
    if (!holding) return
    const t = setInterval(() => {
      setNow(Date.now())
      if (waiting[0] && waiting[0].at <= Date.now()) bringBack()
    }, 1000)
    return () => clearInterval(t)
  })

  // Close counts as right: a typo is not a gap in knowledge, and sending a
  // card back to box zero over a slipped key makes the schedule about typing.
  const onward = () => leave(true)
  const again = (choice) => leave(false, holdCard(waiting, card, choice))

  const skip = () => {
    setQueue((q) => q.filter((c, i) => i !== index))
    setValue('')
    setResult(null)
    setIndex((i) => Math.min(i, queue.length - 2))
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onExit({ finished: false, tally })
      if (holding) {
        if (e.key === 'Enter') bringBack(true)
        return
      }
      if (result && !credit) {
        const choice = againFromKey(e.key)
        if (choice) {
          e.preventDefault()
          again(choice)
        }
        return
      }
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (result) onward()
      else submit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!card) return null
  if (holding && waiting[0]) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] p-5">
        <div className="w-full max-w-md text-center">
          <p className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            {waiting.length === 1 ? 'One card is coming back' : `${waiting.length} cards are coming back`}
          </p>
          <p className="mt-2 text-[34px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
            {untilLabel(waiting[0].at - now)}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={() => bringBack(true)} className="btn btn-solid control-lg">
              Show it now
            </button>
            <button type="button" onClick={() => onExit({ finished: true, tally })} className="btn btn-outline control-lg">
              Finish
            </button>
          </div>
        </div>
      </div>
    )
  }
  const tone = !result
    ? null
    : result.correct || result.overruled
      ? 'var(--status-proficient)'
      : result.close || result.partial
        ? 'var(--status-developing)'
        : 'var(--status-weak)'
  const verdict = !result
    ? ''
    : result.correct
      ? 'Right'
      : result.overruled
        ? 'Counted as right'
        : result.close
          ? 'Right, check the spelling'
          : result.partial
            ? 'Partly there'
            : 'Not quite'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <button onClick={() => onExit({ finished: false, tally })} className="btn btn-quiet control-sm">
            Done
          </button>
          <span className="flex-1 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {index + 1} of {queue.length}
          </span>
          <span className="inline-flex items-center gap-1 text-[12.5px] tabular-nums" style={{ color: 'var(--status-proficient)' }}>
            <IconCheck width={12} height={12} /> {tally.right}
          </span>
          <span className="inline-flex items-center gap-1 text-[12.5px] tabular-nums" style={{ color: 'var(--status-weak)' }}>
            <IconClose width={11} height={11} /> {tally.wrong}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-y-auto p-5">
        <div className="w-full max-w-2xl pt-4 md:pt-10">
          <div
            key={`${card.id}-${index}`}
            className={`flashcard card-enter-next p-7 md:p-10 ${result ? (credit ? 'card-right' : 'card-wrong') : ''}`}
            style={{ minHeight: 'min(46vh, 380px)' }}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <p className="t-caption">
                {card.subject}
                {card.subtopic ? ` · ${displaySubtopic(card.subtopic)}` : ''}
              </p>
              <CardMenu card={card} onEdit={onEdit} onDelete={onDelete} onSkip={skip} />
            </div>

            <p className="whitespace-pre-wrap text-[21px] leading-relaxed md:text-[25px]">
              <MathText>{blank ? blank.prompt : card.front}</MathText>
            </p>
            {blank && (
              <p className="mt-3 text-[13px]" style={{ color: 'var(--text-faint)' }}>
                Fill in the missing word.
              </p>
            )}

            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={!!result}
              placeholder={blank ? 'The missing word' : 'Type the answer'}
              autoComplete="off"
              className="input mt-7 w-full text-[16px]"
            />

            {!result && (
              <button onClick={submit} disabled={!value.trim()} className="btn btn-solid control-md mt-4 disabled:opacity-40">
                Check
              </button>
            )}

            {result && (
              <div className="verdict-in mt-6 border-l-2 pl-4" style={{ borderColor: tone }}>
                <p className="flex items-center gap-2 text-[14px] font-medium">
                  {credit ? (
                    <IconCheck width={15} height={15} style={{ color: 'var(--status-proficient)' }} />
                  ) : (
                    <IconClose width={15} height={15} style={{ color: tone }} />
                  )}
                  {verdict}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                  <MathText>{blank ? blank.answer : card.back}</MathText>
                </p>
                {!credit && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                      Said the same thing another way?
                    </p>
                    <button
                      type="button"
                      onClick={() => setResult((r) => ({ ...r, overruled: true }))}
                      className="text-[12.5px] font-semibold underline-offset-2 hover:underline"
                      style={{ color: 'var(--brand)' }}
                    >
                      I was right
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {result && credit && (
            <button onClick={onward} className="btn btn-solid control-md verdict-in mt-5">
              {index >= queue.length - 1 ? 'Finish' : 'Next'}
            </button>
          )}

          {result && !credit && (
            <div className="mt-5">
              <AgainChoice onChoose={again} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
