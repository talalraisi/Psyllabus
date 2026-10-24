'use client'

import { AGAIN_CHOICES } from '@/lib/flashcards'

/**
 * After a miss: when should this card come back?
 *
 * The student decides, in time: 1 minute, 5, 10 or an hour. Saying "it
 * comes back in 4 cards" told them exactly when to expect it, which turns the
 * second attempt into waiting for a card rather than recalling one. The card
 * waits for its time and then comes back as the next card
 * (lib/flashcards.js, holdCard and releaseDue).
 *
 * Keys 1 to 4 are wired by the screen that shows this, because only it
 * knows whether a box has focus.
 */
export default function AgainChoice({ onChoose }) {
  return (
    <div className="verdict-in mx-auto w-full max-w-2xl text-center" role="group" aria-label="When should this card come back?">
      <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>
        When should this card come back?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AGAIN_CHOICES.map((c, i) => (
          <button key={c.key} type="button" onClick={() => onChoose(c)} className="btn btn-outline control-lg">
            <span className="hidden text-[11px] tabular-nums md:inline" style={{ color: 'var(--text-faint)' }}>
              {i + 1}
            </span>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The choice a number key means, or null. */
export function againFromKey(key) {
  const i = Number(key) - 1
  return Number.isInteger(i) && i >= 0 && i < AGAIN_CHOICES.length ? AGAIN_CHOICES[i] : null
}
