'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Chevron } from '@/components/Select'

/**
 * The top of the front page, with somewhere to go.
 *
 * It was a logo and two buttons, which means the only way to find out what
 * the product does is to scroll the whole page and hope. A visitor who wants
 * the price, or a teacher who came for the school licence, had no way to say
 * so.
 *
 * Four destinations and a drawer. The four are the things somebody is here to
 * decide about — who this is, what is in it, what it costs, and whether it
 * works for a school. Everything else that has to be reachable from every
 * page, including the legal pages that lived only in the footer, is behind
 * More, which is what a drawer is for: the pages you need to be able to find
 * rather than the pages you are looking for.
 *
 * Mark on the left, words on the centre line of the page, account on the
 * right.
 */
const LINKS = [
  ['About', '/about'],
  ['Subjects', '/subjects'],
  ['Pricing', '/pricing'],
  ['Schools', '/schools'],
]

const MORE = [
  {
    heading: 'The product',
    items: [
      ['Features', '/features', 'All eight, one at a time, and where each one stops.'],
      ['Questions', '/faq', 'The ones people ask before signing up.'],
    ],
  },
  {
    heading: 'The small print',
    items: [
      ['Privacy policy', '/privacy', 'What is collected, and what is never shared.'],
      ['Terms of service', '/terms', 'The agreement, in the shortest form it fits in.'],
      ['Cookie policy', '/cookies', 'What is set, and what you can turn off.'],
      ['Refunds', '/refunds', 'How to get your money back, and when.'],
    ],
  },
]

/** Down, and up when the drawer is open. A rotated chevron rather than a
 *  glyph, which is a font's idea of an arrow and never matches the weight of
 *  the word beside it. */
function Caret({ open }) {
  return <Chevron open={open} style={{ opacity: 0.65 }} />
}

export default function SiteNav({ children }) {
  const [more, setMore] = useState(false)
  const [mobile, setMobile] = useState(false)
  const ref = useRef(null)
  const leaving = useRef(null)

  useEffect(() => {
    if (!more && !mobile) return
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setMore(false)
        setMobile(false)
      }
    }
    const esc = (e) => {
      if (e.key === 'Escape') {
        setMore(false)
        setMobile(false)
      }
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [more, mobile])

  useEffect(() => () => clearTimeout(leaving.current), [])

  // The page under the menu stays where it is while the menu is down.
  useEffect(() => {
    if (!mobile) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before
    }
  }, [mobile])

  /* Opens on hover, and does not close the instant you leave the word — the
     gap between the word and the panel under it is a few pixels of nothing,
     and a drawer that shuts while you are crossing it cannot be used. */
  const enter = () => {
    clearTimeout(leaving.current)
    setMore(true)
  }
  const leave = () => {
    clearTimeout(leaving.current)
    leaving.current = setTimeout(() => setMore(false), 160)
  }

  return (
    /* Three columns, so the words sit on the middle of the page.
       Pushed along by a spacer they were centred in whatever was left over
       after the logo, which is not the centre of anything. The outer columns
       are both 1fr and the nav is auto, so the middle column's centre is the
       page's centre whatever the mark and the buttons happen to measure. */
    <div ref={ref} className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div className="flex min-w-0 items-center justify-start">{children}</div>

      {/* Words, not buttons. A bar of pills competes with the one button that
          matters; plain words let "Get started" be the only thing up here that
          looks pressable.

          `nav-drop` nudges them down a few pixels. The logo is a cap sitting
          above a wordmark, so the middle of the image is up in the empty space
          beside the cap rather than on the lettering — words centred against
          the image read as floating above the name. */}
      <nav className="nav-drop hidden items-center justify-center gap-7 md:flex lg:gap-8">
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

        <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
          <button
            onClick={() => setMore((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={more}
            className="flex items-center gap-1.5 text-[13.5px] font-medium"
            style={{ color: 'var(--text-body)' }}
          >
            <span className="nav-word" data-open={more || undefined}>
              More
            </span>
            <Caret open={more} />
          </button>

          {more && (
            <div
              role="menu"
              className="elev-lg pop-enter absolute left-1/2 top-8 z-50 w-[20rem] -translate-x-1/2 overflow-hidden rounded-[12px] border pb-1"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              {MORE.map((section, n) => (
                <div
                  key={section.heading}
                  className={n > 0 ? 'mt-1 border-t pt-1' : undefined}
                  style={n > 0 ? { borderColor: 'var(--border)' } : undefined}
                >
                  <p
                    className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {section.heading}
                  </p>
                  {section.items.map(([label, href, hint]) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      onClick={() => setMore(false)}
                      className="block px-4 py-2.5 hover:bg-[var(--surface-sunken)]"
                    >
                      <span className="block text-[13.5px] font-medium">{label}</span>
                      <span
                        className="mt-0.5 block text-[12px] leading-snug"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {hint}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Everything left of this is navigation; everything here is the
          account. They are separate columns because they are separate jobs. */}
      <div className="nav-drop col-start-3 flex shrink-0 items-center justify-end gap-6">
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

        {/* Phone: three bare lines to the right of Get started, no outline or
            fill, that fold into a cross while the menu is down. */}
        <button
          onClick={() => setMobile((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={mobile}
          aria-controls="site-menu"
          aria-label={mobile ? 'Close menu' : 'Menu'}
          className="burger -mr-1.5 flex h-9 w-9 items-center justify-center md:hidden"
          data-open={mobile || undefined}
          style={{ color: 'var(--text)' }}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {/* The menu falls from the top and covers about a third of the screen;
          the page under it dims and stays put. Always mounted, so it can
          slide both ways; hidden from everyone while it is up. */}
      <div
        className="site-menu-backdrop fixed inset-0 z-[60] md:hidden"
        data-open={mobile || undefined}
        onClick={() => setMobile(false)}
        aria-hidden="true"
      />
      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="site-menu fixed inset-x-0 top-0 z-[61] rounded-b-[24px] border-b px-5 pb-6 pt-4 md:hidden"
        data-open={mobile || undefined}
        inert={!mobile || undefined}
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0" onClick={() => setMobile(false)}>
            {children}
          </div>
          {/* The three lines, now a cross, where they were. */}
          <button onClick={() => setMobile(false)} aria-label="Close menu" className="burger -mr-1.5 flex h-9 w-9 items-center justify-center" data-open={mobile || undefined} style={{ color: 'var(--text)' }}>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1">
          {LINKS.map(([label, href], i) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className="site-menu-item py-2 text-[22px] font-semibold tracking-[-0.02em]"
              style={{ color: 'var(--text)', '--i': i }}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="site-menu-item mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-4" style={{ borderColor: 'var(--border)', '--i': 4 }}>
          {MORE.flatMap((s) => s.items).map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setMobile(false)} className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {label}
            </Link>
          ))}
        </div>

        <div className="site-menu-item mt-5 grid grid-cols-2 gap-2" style={{ '--i': 5 }}>
          <Link href="/login" onClick={() => setMobile(false)} className="btn btn-outline control-md justify-center">
            Log in
          </Link>
          <Link href="/signup" onClick={() => setMobile(false)} className="btn btn-solid control-md justify-center">
            Get started
          </Link>
        </div>
      </div>
    </div>
  )
}
