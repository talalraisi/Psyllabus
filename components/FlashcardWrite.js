'use client'

import { useEffect, useRef, useState } from 'react'
import MathText from '@/components/MathText'
import { IconCheck, IconClose } from '@/components/Icons'
import { displaySubtopic } from '@/lib/progress'
import { checkWritten, makeBlank } from '@/lib/flashcard-modes'

/**
 * Write the answer, rather than tell yourself you knew it.
 *
 * Flipping a card measures recognition and an exam asks for recall, which is
 * why every serious deck app has this mode and why it is the one worth
 * having first. Typing the answer is also the only mode that can mark
 * itself honestly — the student cannot round their own performance up.
 *
 * `blank` hides one term inside the answer instead of asking for the whole
 * thing, which is the gentler version of the same question and the right
 * one for a card you met ten minutes ago.
 */
export default function FlashcardWrite({ cards, mode = 'write', onMark, onExit }) {
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)
  const [tally, setTally] = useState({ right: 0, wrong: 0 })
  const inputRef = useRef(null)

  const card = cards[index]
  // A card with nothing worth hiding falls back to asking for the whole answer.
  const blank = mode === 'blank' && card ? makeBlank(card) : null
  const expected = blank ? blank.answer : card?.back
  const atEnd = index >= cards.length - 1

  useEffect(() => {
    inputRef.current?.focus()
  }, [index])

  const submit = () => {
    if (result || !card) return
    const r = checkWritten(value, expected)
    setResult(r)
    // Close counts as right for scheduling: a typo is not a gap in knowledge,
    // and sending the card back to box zero over a slipped key would make the
    // schedule about typing.
    const credit = r.correct || r.close
    setTally((t) => ({ right: t.right + (credit ? 1 : 0), wrong: t.wrong + (credit ? 0 : 1) }))
    onMark?.(card, credit)
  }

  const next = () => {
    if (atEnd) return onExit({ finished: true, tally })
    setIndex((i) => i + 1)
    setValue('')
    setResult(null)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onExit({ finished: false, tally })
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (result) next()
      else submit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!card) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <button onClick={() => onExit({ finished: false, tally })} className="btn btn-quiet control-sm">
            Done
          </button>
          <span className="flex-1 text-[12.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {index + 1} of {cards.length}
          </span>
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--status-proficient)' }}>
            {tally.right} right
          </span>
          <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--status-weak)' }}>
            {tally.wrong} wrong
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-y-auto p-5">
        <div className="w-full max-w-3xl pt-6 md:pt-14">
          <p className="t-caption mb-4">
            {card.subject}
            {card.subtopic ? ` · ${displaySubtopic(card.subtopic)}` : ''}
          </p>

          <p className="whitespace-pre-wrap text-[22px] leading-relaxed md:text-[26px]">
            <MathText>{blank ? blank.prompt : card.front}</MathText>
          </p>
          {blank && (
            <p className="mt-3 text-[13.5px]" style={{ color: 'var(--text-faint)' }}>
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
            className="input mt-6 w-full text-[16px]"
          />

          {!result && (
            <button onClick={submit} disabled={!value.trim()} className="btn btn-solid control-md mt-4 disabled:opacity-40">
              Check
            </button>
          )}

          {result && (
            <div className="pop-enter mt-6">
              <div
                className="flex items-start gap-3 border-l-2 pl-4"
                style={{
                  borderColor: result.correct
                    ? 'var(--status-proficient)'
                    : result.close
                      ? 'var(--status-developing)'
                      : 'var(--status-weak)',
                }}
              >
                <span className="mt-0.5 shrink-0">
                  {result.correct || result.close ? (
                    <IconCheck width={16} height={16} style={{ color: 'var(--status-proficient)' }} />
                  ) : (
                    <IconClose width={16} height={16} style={{ color: 'var(--status-weak)' }} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">
                    {result.correct ? 'Right' : result.close ? 'Nearly — spelling' : 'Not quite'}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    <MathText>{blank ? blank.answer : card.back}</MathText>
                  </p>
                </div>
              </div>

              <button onClick={next} className="btn btn-solid control-md mt-5">
                {atEnd ? 'Finish' : 'Next'}
              </button>
              <p className="mt-3 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                Enter to continue
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
