'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

/**
 * Back link that returns you to where you came from.
 *
 * Privacy and Terms are reachable from the marketing site and from inside the
 * dashboard, and a single hardcoded "back to home" sent signed-in students out
 * of the app to read a policy. The sidebar links carry ?from=dashboard, so the
 * link can point back at the dashboard instead.
 */
export default function BackLink({ fallbackHref = '/', fallbackLabel = 'Project Syllabus' }) {
  const params = useSearchParams()
  const fromDashboard = params.get('from') === 'dashboard'

  const href = fromDashboard ? '/dashboard' : fallbackHref
  const label = fromDashboard ? 'dashboard' : fallbackLabel

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
    >
      <span aria-hidden="true">&larr;</span>
      Back to {label}
    </Link>
  )
}
