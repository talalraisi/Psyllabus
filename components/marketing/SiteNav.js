'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { IconMenu, IconChevronRight } from '@/components/Icons'

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
 * They sit next to the mark rather than in the middle of the bar, because the
 * mark and the navigation are one group: who this is, and what it has. The
 * account is the other group, and it is at the far end.
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
  return (
    <IconChevronRight
      aria-hidden="true"
      width={12}
      height={12}
      className="transition-transform duration-200"
      style={{ transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', opacity: 0.65 }}
    />
  )
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
    <div ref={ref} className="flex w-full items-center gap-8 lg:gap-11">
      {/* The mark, hard against the left edge of the page. */}
      <div className="flex shrink-0 items-center">{children}</div>

      {/* Words, not buttons. A bar of pills competes with the one button that
          matters; plain words let "Get started" be the only thing up here that
          looks pressable.

          `nav-drop` nudges them down a few pixels. The logo is a cap sitting
          above a wordmark, so the middle of the image is up in the empty space
          beside the cap rather than on the lettering — words centred against
          the image read as floating above the name. */}
      <nav className="nav-drop hidden items-center gap-7 md:flex lg:gap-8">
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

      {/* Everything left of this is navigation; everything right of it is the
          account. The spacer is what separates the two jobs. */}
      <div className="flex-1" />

      <div className="nav-drop flex shrink-0 items-center gap-6">
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

        {/* Phone: the whole lot behind one button, since the bar has no room. */}
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
              className="elev-lg pop-enter absolute right-0 top-11 z-50 max-h-[75vh] w-[15rem] overflow-y-auto rounded-[12px] border"
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
              {MORE.map((section) => (
                <div key={section.heading} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  {section.items.map(([label, href]) => (
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
                </div>
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
