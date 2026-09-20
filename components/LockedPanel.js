import Link from 'next/link'

/**
 * A feature this plan does not include.
 *
 * Shown rather than hidden, for the same reason a locked door has a handle:
 * the student should know the room exists. It says what the thing is, which
 * plan has it, and nothing else — a paragraph of persuasion on a page somebody
 * is trying to use is an advert, and adverts are what free products do to
 * people who have not paid.
 */
export default function LockedPanel({ title, blurb, plan = 'Basic' }) {
  return (
    <section
      className="rounded-[16px] border p-6"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <p
        className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: 'var(--text-faint)' }}
      >
        {plan} and above
      </p>
      <h2 className="mt-2.5 text-[clamp(1.2rem,2.4vw,1.5rem)] font-semibold tracking-[-0.025em]">
        {title}
      </h2>
      <p className="mt-2 max-w-lg text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {blurb}
      </p>
      <Link href="/pricing" className="btn btn-solid control-md mt-5">
        See the plans
      </Link>
    </section>
  )
}
