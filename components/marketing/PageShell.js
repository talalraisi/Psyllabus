import Link from 'next/link'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'
import ThemeToggle from '@/components/ThemeToggle'
import SiteNav from '@/components/marketing/SiteNav'
import { operatorLine } from '@/lib/legal'

/**
 * The bar and the footer, on every page that is not the app.
 *
 * The links at the top used to be anchors into the front page, so pressing
 * "For schools" from the pricing page sent you home and then jumped you down
 * it. Each of them is its own page now, and each of those pages needs the same
 * bar and the same footer as the one it came from — which is this, rather than
 * five copies that drift apart.
 */
export default function PageShell({ children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--bg) 82%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-6xl px-5 py-3 md:px-8">
          <SiteNav>
            <Link href="/" aria-label="Project Syllabus home" className="shrink-0">
              <Image
                src={logoMark}
                alt="Project Syllabus"
                sizes="140px"
                style={{ height: 34, width: 'auto' }}
                priority
              />
            </Link>
          </SiteNav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t px-5 py-12 md:px-8" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <p className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
            {operatorLine()}
          </p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {[
              ['About', '/about'],
              ['Pricing', '/pricing'],
              ['Privacy', '/privacy'],
              ['Terms', '/terms'],
              ['Cookies', '/cookies'],
              ['Refunds', '/refunds'],
            ].map(([label, href]) => (
              <Link key={href} href={href} className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </footer>
    </div>
  )
}

/** A page's opening block: what this page is, in one line and one sentence. */
export function PageHead({ eyebrow, title, intro, children }) {
  return (
    <section className="px-5 pb-4 pt-14 md:px-8 md:pt-20">
      <div className="mx-auto max-w-6xl">
        {eyebrow && (
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'var(--brand)' }}
          >
            {eyebrow}
          </p>
        )}
        <h1 className="mt-4 max-w-3xl text-[clamp(2.1rem,4.5vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.034em]">
          {title}
        </h1>
        {intro && (
          <p
            className="mt-6 max-w-xl text-[16px] leading-[1.65]"
            style={{ color: 'var(--text-body)' }}
          >
            {intro}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}

/** A band of content, optionally tinted so two of them do not run together. */
export function Band({ children, tint = false, className = '' }) {
  return (
    <section
      className={`px-5 py-16 md:px-8 md:py-20 ${className}`}
      style={tint ? { background: 'var(--surface-sunken)' } : undefined}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}
