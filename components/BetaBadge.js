/**
 * "Beta", at the top right of the logo, its top level with the top of the
 * cap, wherever the logo shows.
 *
 *   <WithBeta><Image src={logoMark} … /></WithBeta>
 *   <WithBeta square><Logo … /></WithBeta>      the square logo
 *
 * When the beta ends, make WithBeta return its children and nothing else.
 */
export default function BetaBadge({ square = false, style }) {
  // Its top level with the top of the cap. In the wordmark (logo-mark.svg)
  // the cap starts 4% down and the word ends at the right edge; in the square
  // logo (logo.svg) the cap starts 36% down and the word ends at 87%.
  const place = square ? { left: '88%', top: '36%' } : { left: '100%', top: '4%', transform: 'translateX(3px)' }
  return (
    <span
      aria-label="Beta"
      className="pointer-events-none absolute inline-flex select-none items-center rounded-full font-semibold uppercase"
      style={{
        ...place,
        fontSize: 7.5,
        lineHeight: '11px',
        padding: '0 4px',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
        color: 'var(--brand)',
        border: '1px solid color-mix(in oklab, var(--brand) 55%, transparent)',
        ...style,
      }}
    >
      Beta
    </span>
  )
}

/** The logo with the tag at the top right of its word. */
export function WithBeta({ children, square = false, className = '' }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {children}
      <BetaBadge square={square} />
    </span>
  )
}
