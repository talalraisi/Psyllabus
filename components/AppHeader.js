import Link from 'next/link'
import Logo from './Logo'

export default function AppHeader({ backHref, backLabel = 'Back', rightAction }) {
  return (
    <header className="flex items-center justify-between mb-8">
      <Link href="/dashboard">
        <Logo width={300} height={90} priority />
      </Link>
      <div className="flex items-center gap-3">
        {backHref && (
          <Link href={backHref} className="link text-sm">
            ← {backLabel}
          </Link>
        )}
        {rightAction}
      </div>
    </header>
  )
}
