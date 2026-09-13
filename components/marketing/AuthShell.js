'use client'

import Link from 'next/link'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'

/**
 * The frame every sign-in and sign-up screen sits in.
 *
 * The auth pages were a centred card on an empty page, which is what every
 * template does and looks nothing like the rest of the product. This is the
 * homepage's language applied to a form: a headline set in the same tight
 * display size, an uppercase micro-label above it, a panel with an edge rather
 * than a shadow, and a column of plain claims down the side that answers the
 * question somebody hesitating on this screen is actually asking.
 *
 * Two columns on a wide screen so the form is not floating in the middle of
 * nowhere, one column on a phone where the reassurance goes underneath.
 */
export default function AuthShell({ eyebrow, title, intro, aside, children, footer }) {
  return (
    <main className="ground min-h-screen px-5 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/" aria-label="Project Syllabus home" className="inline-block">
          <Image src={logoMark} alt="Project Syllabus" sizes="110px" style={{ height: 34, width: 'auto' }} priority />
        </Link>

        <div className="mt-14 grid gap-12 md:mt-20 md:grid-cols-[1fr_minmax(0,26rem)] md:gap-20">
          <div className="max-w-lg">
            <p
              className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {eyebrow}
            </p>
            <h1 className="text-[clamp(2.1rem,4.4vw,3.1rem)] font-semibold leading-[1.04] tracking-[-0.032em]">
              {title}
            </h1>
            {intro && (
              <p className="mt-5 text-[16px] leading-[1.65]" style={{ color: 'var(--text-body)' }}>
                {intro}
              </p>
            )}

            {aside && (
              <dl className="mt-12 hidden border-t md:block" style={{ borderColor: 'var(--border)' }}>
                {aside.map(([term, def]) => (
                  <div key={term} className="border-b py-5" style={{ borderColor: 'var(--border)' }}>
                    <dt className="text-[13.5px] font-semibold">{term}</dt>
                    <dd className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {def}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div>
            <div
              className="rounded-[12px] border p-6 md:p-7"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              {children}
            </div>
            {footer && (
              <p className="mt-5 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {footer}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

/** The divider between Google and the email form, used on both screens. */
export function OrRule() {
  return (
    <div className="my-5 flex items-center gap-4">
      <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
      <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
        or
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
    </div>
  )
}

export function GoogleButton({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className="flex w-full items-center justify-center gap-2.5 rounded-full border px-5 py-3.5 text-[14.5px] font-semibold transition-colors duration-150 disabled:opacity-50"
      style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}
    >
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {label}
    </button>
  )
}

/** The primary action, matching the homepage call to action exactly. */
export function SubmitButton({ children, disabled, className = '' }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14.5px] font-semibold text-white transition-transform duration-150 hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50 ${className}`}
      style={{ background: 'var(--brand-solid)' }}
    >
      {children}
    </button>
  )
}
