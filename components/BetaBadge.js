/**
 * "Beta", at the top right of the logo, like a superscript. Only on the
 * homepage and the dashboard.
 *
 *   <WithBeta><Image src={logoMark} … /></WithBeta>
 *
 * When the beta ends, make WithBeta return its children and nothing else.
 */
export default function BetaBadge({ style }) {
  return (
    <span
      aria-label="Beta"
      className="pointer-events-none absolute inline-flex select-none items-center rounded-full font-semibold uppercase"
      style={{
        left: '100%',
        top: 0,
        transform: 'translate(3px, -30%)',
        fontSize: 7.5,
        lineHeight: '11px',
        padding: '0 4px',
        letterSpacing: '0.08em',
        color: 'var(--brand)',
        border: '1px solid color-mix(in oklab, var(--brand) 55%, transparent)',
        ...style,
      }}
    >
      Beta
    </span>
  )
}

/** The logo with the tag at its top right. */
export function WithBeta({ children, className = '' }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {children}
      <BetaBadge />
    </span>
  )
}
