'use client'

import { useEffect, useRef, useState } from 'react'
import MathText from '@/components/MathText'
import CardMenu from '@/components/CardMenu'
import { IconCheck, IconClose } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { checkWritten, makeBlank } from '@/lib/flashcard-modes'
import { SNOOZE_CHOICES } from '@/lib/flashcards'

/**
 * Write the answer, rather than tell yourself you knew it.
 *
 * Flipping measures recognition and an exam asks for recall, which is why
 * this mode exists and why it is the one worth having first. Typing is also
 * the only mode that can mark itself honestly — the student cannot round
 * their own performance up.
 *
 * It happens on a card rather than on a form, because the deck should feel
 * like the same object in every mode.
 *
 * `blank` hides one term inside the answer instead of asking for the whole
 * thing: the gentler version of the same question, and the right one for a
 * card met ten minutes ago.
 */
export default function FlashcardWrite({ cards, mode = 'write', onMark, onSnooze, onEdit, onDelete, onExit }) {
  const [queue, setQueue] = useState(cards)
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)
  const [tally, setTally] = useState({ right: 0, wrong: 0 })
  const inputRef = useRef(null)

  const card = queue[index]
  const blank = mode === 'blank' && card ? makeBlank(card) : null
  const expected = blank ? blank.answer : card?.back
  const atEnd = index >= queue.length - 1

  useEffect(() => {
    inputRef.current?.focus()
  }, [index])

  const submit = () => {
    if (result || !card) return
    const r = checkWritten(value, expected)
    setResult(r)
    // Close counts as right: a typo is not a gap in knowledge, and sending a
    // card back to box zero over a slipped key makes the schedule about typing.
    const credit = r.correct || r.close
    setTally((t) => ({ right: t.right + (credit ? 1 : 0), wrong: t.wrong + (credit ? 0 : 1) }))
    onMark?.(card, credit)
  }

  const advance = () => {
    if (atEnd) return onExit({ finished: true, tally })
    setIndex((i) => i + 1)
    setValue('')
    setResult(null)
  }

  /** Wrong answers choose when to come back, and short ones come back here. */
  const snooze = (minutes) => {
    onSnooze?.(card, minutes)
    if (minutes <= 10) setQueue((q) => [...q, card])
    advance()
  }

  const skip = () => {
    setQueue((q) => q.filter((c, i) => i !== index))
    setValue('')
    setResult(null)
    setIndex((i) => Math.min(i, queue.length - 2))
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onExit({ finished: false, tally })
      if (e.key !== 'Enter') return
      // A wrong answer is waiting on a decision about when to see it again,
      // so Enter must not skip past the question being asked.
      if (result && !result.correct && !result.close) return
      e.preventDefault()
      if (result) advance()
      else submit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!card) return null
  const wrong = result && !result.correct && !result.close

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
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--status-proficient)' }}>
            {tally.right}
          </span>
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--status-weak)' }}>
            {tally.wrong}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-y-auto p-5">
        <div className="w-full max-w-2xl pt-4 md:pt-10">
          <div
            key={`${card.id}-${index}`}
            className={`flashcard p-7 md:p-10 ${
              result ? (wrong ? 'card-wrong' : 'card-right') : ''
            }`}
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
              <button
                onClick={submit}
                disabled={!value.trim()}
                className="btn btn-solid control-md mt-4 disabled:opacity-40"
              >
                Check
              </button>
            )}

            {result && (
              <div
                className="verdict-in mt-6 border-l-2 pl-4"
                style={{
                  borderColor: result.correct
                    ? 'var(--status-proficient)'
                    : result.close
                      ? 'var(--status-developing)'
                      : 'var(--status-weak)',
                }}
              >
                <p className="flex items-center gap-2 text-[14px] font-medium">
                  {wrong ? (
                    <IconClose width={15} height={15} style={{ color: 'var(--status-weak)' }} />
                  ) : (
                    <IconCheck width={15} height={15} style={{ color: 'var(--status-proficient)' }} />
                  )}
                  {result.correct ? 'Right' : result.close ? 'Nearly: spelling' : 'Not quite'}
                </p>
                <p
                  className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-relaxed"
                  style={{ color: 'var(--text-body)' }}
                >
                  <MathText>{blank ? blank.answer : card.back}</MathText>
                </p>
              </div>
            )}
          </div>

          {result && !wrong && (
            <button onClick={advance} className="btn btn-solid control-md verdict-in mt-5">
              {atEnd ? 'Finish' : 'Next'}
            </button>
          )}

          {/* A wrong answer decides when it comes back. The boxes are measured
              in days, which is right for a card you got right and useless for
              one still on the screen. */}
          {wrong && (
            <div className="verdict-in mt-6">
              <p className="mb-2.5 text-[13px]" style={{ color: 'var(--text-body)' }}>
                When should this come back?
              </p>
              <div className="flex flex-wrap gap-2">
                {SNOOZE_CHOICES.map((c) => (
                  <button
                    key={c.minutes}
                    onClick={() => snooze(c.minutes)}
                    className="btn btn-outline control-sm"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                Anything up to ten minutes comes back before this session ends.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
