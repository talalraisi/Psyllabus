/**
 * "Beta", tucked into the bottom-right corner of the logo, wherever the logo
 * is the brand (headers, sign-in, onboarding, the dashboard). Small enough
 * to read as part of the mark, not a label beside it.
 *
 *   <WithBeta><Image src={logoMark} … /></WithBeta>
 *
 * When the beta ends, make WithBeta return its children and nothing else.
 */
export default function BetaBadge({ size = 'sm', square = false, style }) {
  const big = size === 'lg'
  // Just past the end of the word, sitting on its baseline. The wordmark
  // (logo-mark.svg) fills its box, so that is the box's right edge; the
  // square logo (logo.svg) has the word across its middle, from 13% to 87%
  // of the width and 35% to 65% of the height.
  const place = square
    ? { left: '88%', top: '65%', transform: 'translateY(-100%)' }
    : { left: '100%', bottom: 0, transform: 'translate(3px, 10%)' }
  return (
    <span
      aria-label="Beta"
      className="pointer-events-none absolute inline-flex select-none items-center rounded-full font-semibold uppercase"
      style={{
        ...place,
        fontSize: big ? 9 : 7.5,
        lineHeight: big ? '13px' : '11px',
        padding: big ? '0 5px' : '0 4px',
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

/**
 * The logo with the badge at its bottom right. `size` is "sm" for headers,
 * "lg" for the big logo on sign-in and onboarding; `square` for the square
 * logo (components/Logo.js).
 */
export function WithBeta({ children, size = 'sm', square = false, className = '' }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {children}
      <BetaBadge size={size} square={square} />
    </span>
  )
}
