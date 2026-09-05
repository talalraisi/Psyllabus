'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import BackLink from '@/components/BackLink'

/**
 * Shell for a legal document.
 *
 * Deliberately plain. A privacy policy laid out as cards and panels reads as
 * marketing, and the person who has to approve it is looking for a document
 * they can print, quote a clause from, and file. So: one column, numbered
 * clauses, no boxes, and enough line height to read a long paragraph without
 * losing your place.
 *
 * Arabic runs right to left, which the browser handles from dir alone once the
 * layout stops relying on fixed sides.
 */
export function LegalDoc({ titles, updated, lang, setLang, children }) {
  const ar = lang === 'ar'

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-[46rem] px-5 py-10 md:py-14">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Suspense fallback={<span className="text-sm text-[var(--brand)]">&larr; Back</span>}>
            <BackLink />
          </Suspense>

          <div
            className="inline-flex gap-4 text-sm"
            role="group"
            aria-label={ar ? 'اللغة' : 'Language'}
          >
            {[
              ['en', 'English'],
              ['ar', 'العربية'],
            ].map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={
                  lang === code
                    ? 'font-semibold text-[var(--text)] underline underline-offset-4'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <article dir={ar ? 'rtl' : 'ltr'} className={ar ? 'text-right' : ''}>
          <header className="border-b border-[var(--border-strong)] pb-6">
            <h1 className="t-page-title" style={{ fontSize: '1.75rem', lineHeight: 1.25 }}>
              {ar ? titles.ar : titles.en}
            </h1>
            <p className="t-caption mt-2">
              {ar ? `آخر تحديث: ${updated.ar}` : `Last updated ${updated.en}`}
            </p>
          </header>

          <div className="legal-body">{children}</div>
        </article>

        <p className="t-caption mt-14 border-t border-[var(--border)] pt-6">
          <Link href="/privacy" className="text-[var(--brand)] hover:underline">
            {ar ? 'سياسة الخصوصية' : 'Privacy policy'}
          </Link>
          {' · '}
          <Link href="/terms" className="text-[var(--brand)] hover:underline">
            {ar ? 'شروط الاستخدام' : 'Terms of service'}
          </Link>
        </p>
      </div>

    </main>
  )
}

/** One numbered clause. The number is content, not decoration: it is how a
 *  school's legal contact refers to a specific paragraph. */
export function Clause({ n, title, children }) {
  return (
    <section>
      <h2>
        <span className="clause">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function useLegalLang() {
  return useState('en')
}
