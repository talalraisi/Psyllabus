'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { IconMenu } from '@/components/Icons'

/**
 * The top of the front page, with somewhere to go.
 *
 * It was a logo and two buttons, which means the only way to find out what
 * the product does is to scroll the whole page and hope. A visitor who wants
 * the price, or a teacher who came for the school licence, had no way to say
 * so.
 *
 * Five words, flat, no menu behind any of them. A dropdown was hiding four
 * destinations behind a fifth press and a caret, which is a site map's answer
 * to a problem a landing page does not have — there are only five places to
 * go. Everything is now one press, and the bar says what the five are without
 * being opened.
 *
 * They sit next to the mark rather than in the middle of the bar, because the
 * mark and the navigation are one group: who this is, and what it has. The
 * account is the other group, and it is at the far end.
 */
const LINKS = [
  ['What it does', '/#features'],
  ['How it works', '/#how-it-works'],
  ['Pricing', '/pricing'],
  ['For schools', '/#schools'],
  ['Questions', '/#faq'],
]

export default function SiteNav({ children }) {
  const [mobile, setMobile] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!mobile) return
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMobile(false)
    }
    const esc = (e) => {
      if (e.key === 'Escape') setMobile(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [mobile])

  return (
    <div ref={ref} className="flex w-full items-center gap-8 lg:gap-11">
      {/* The mark, hard against the left edge of the page. */}
      <div className="flex shrink-0 items-center">{children}</div>

      {/* Words, not buttons. A bar of pills competes with the one button that
          matters; plain words let "Get started" be the only thing up here that
          looks pressable. */}
      <nav className="hidden items-center gap-7 md:flex lg:gap-8">
        {LINKS.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="nav-word whitespace-nowrap text-[13.5px] font-medium"
            style={{ color: 'var(--text-body)' }}
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Everything left of this is navigation; everything right of it is the
          account. The spacer is what separates the two jobs. */}
      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-6">
        <Link
          href="/login"
          className="nav-word hidden whitespace-nowrap text-[13.5px] font-medium sm:inline-block"
          style={{ color: 'var(--text-body)' }}
        >
          Log in
        </Link>
        <Link href="/signup" className="btn btn-solid control-sm whitespace-nowrap">
          Get started
        </Link>

        {/* Phone: the same five behind one button, since the bar has no room. */}
        <div className="relative md:hidden">
          <button
            onClick={() => setMobile((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={mobile}
            aria-label="Menu"
            className="btn btn-quiet control-sm px-2.5"
          >
            <IconMenu width={16} height={16} />
          </button>
          {mobile && (
            <div
              role="menu"
              className="elev-lg pop-enter absolute right-0 top-11 z-50 w-[15rem] overflow-hidden rounded-[12px] border"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              {LINKS.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setMobile(false)}
                  className="block px-4 py-3 text-[13.5px] font-medium hover:bg-[var(--surface-sunken)]"
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setMobile(false)}
                className="block border-t px-4 py-3 text-[13.5px] font-medium"
                style={{ borderColor: 'var(--border)' }}
              >
                Log in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
