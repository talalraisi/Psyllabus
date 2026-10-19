/**
 * A mark as a ring: how much of the maximum, coloured by how good that is.
 * Whatever is passed as children sits in the middle.
 */

export function ringColour(fraction) {
  if (fraction >= 0.8) return 'var(--status-proficient)'
  if (fraction >= 0.6) return 'var(--status-developing)'
  return 'var(--status-weak)'
}

export default function ScoreRing({ value = 0, max = 1, size = 44, stroke = 4, children, className = '' }) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColour(fraction)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * fraction} ${c}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center tabular-nums">{children}</div>
    </div>
  )
}
