'use client'

import { lockedCopy } from '@/lib/features'

/**
 * The placeholder for a feature that is built but not switched on.
 *
 * It states what the feature does and why it is off. A greyed-out button with
 * no explanation reads as broken, and "upgrade to unlock" would be worse: there
 * is nothing to buy, so it would be a lie.
 */
export default function ComingLater({ feature, className = '' }) {
  const copy = lockedCopy(feature)
  if (!copy) return null

  return (
    <div
      className={`rounded-[var(--r-md)] border border-dashed border-[var(--border-hover)] p-4 ${className}`}
    >
      <div className="flex items-baseline gap-2">
        <p className="text-sm font-semibold text-[var(--text)]">{copy.title}</p>
        <span className="t-overline">Not on yet</span>
      </div>
      <p className="t-small mt-1">{copy.blurb}</p>
      <p className="t-caption mt-2">{copy.why}</p>
    </div>
  )
}
