/**
 * Syllabi's mark.
 *
 * A four-point spark, not a robot and not a chat bubble: this is a thing that
 * reads your work and points at what is missing, and it should look like
 * attention rather than conversation. Small enough to sit inside a button and
 * legible at 14px, which rules out anything with a face.
 */
export default function SyllabiMark({ size = 18, className = '', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M10 1.6c.5 3.9 1.9 5.8 5.6 6.4-3.7.6-5.1 2.5-5.6 6.4-.5-3.9-1.9-5.8-5.6-6.4C8.1 7.4 9.5 5.5 10 1.6Z"
        fill="currentColor"
      />
      <path
        d="M15.3 13.1c.25 1.9.95 2.85 2.75 3.15-1.8.3-2.5 1.25-2.75 3.15-.25-1.9-.95-2.85-2.75-3.15 1.8-.3 2.5-1.25 2.75-3.15Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  )
}
