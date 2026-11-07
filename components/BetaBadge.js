/**
 * "Beta", beside the logo, while Psyllabus is open to everyone but still
 * finding its feet. Remove it from the three places it sits (the site header,
 * the dashboard sidebar and the mobile header) when the beta ends.
 */
export default function BetaBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[10.5px] font-semibold uppercase leading-[16px] tracking-[0.08em] ${className}`}
      style={{
        borderColor: 'color-mix(in oklab, var(--brand) 45%, transparent)',
        color: 'var(--brand)',
        background: 'color-mix(in oklab, var(--brand) 10%, transparent)',
      }}
    >
      Beta
    </span>
  )
}
