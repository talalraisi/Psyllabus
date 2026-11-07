/**
 * "Beta", at the top right of the word in the logo, like a superscript,
 * wherever the logo shows.
 *
 *   <WithBeta><Image src={logoMark} … /></WithBeta>
 *   <WithBeta square><Logo … /></WithBeta>      the square logo
 *
 * When the beta ends, make WithBeta return its children and nothing else.
 */
export default function BetaBadge({ square = false, style }) {
  // Placed against the letters, not the box: in the wordmark (logo-mark.svg)
  // "SYLLABUS" runs from 71% to 97% of the height and ends at the right edge;
  // in the square logo (logo.svg) it runs from 57% to 64% and ends at 87%.
  const place = square
    ? { left: '88%', top: '55%', transform: 'translateY(-50%)' }
    : { left: '100%', top: '62%', transform: 'translate(3px, -50%)' }
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
