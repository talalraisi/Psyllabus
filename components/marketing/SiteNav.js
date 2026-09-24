'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { IconChevronRight, IconMenu } from '@/components/Icons'

/**
 * The top of the front page, with somewhere to go.
 *
 * It was a logo and two buttons, which means the only way to find out what
 * the product does is to scroll the whole page and hope. A visitor who wants
 * the price, or a teacher who came for the school licence, had no way to say
 * so.
 *
 * The sections live behind one menu rather than spread across the bar,
 * because six top-level links is a site map and this is a landing page — the
 * two things most people actually want are the price and the sign-up, and
 * those stay visible.
 */

/**
 * Four, not six.
 *
 * "How it works" came out because the hero already has a button to it, and a
 * menu that repeats the button underneath it is a menu you stop reading. "The
 * five levels" came out because it is part of what the product does rather
 * than a destination of its own, and an item called "What it does" inside a
 * menu called "What it does" was never going to help anybody.
 *
 * What is left is four things somebody might actually have come for.
 */
const SECTIONS = [
  ['Every feature', '/#features', 'Eight of them, grouped by the question they answer.'],
  ['Try a question', '/#try-it', 'A real one, marked the way the app marks it.'],
  ['For schools', '/#schools', 'One code for a year group. No teacher dashboard.'],
  ['Questions', '/#faq', 'The ones people actually ask before signing up.'],
]

/** Down, and up when the menu is open. A rotated chevron, not a ▼ glyph —
 *  the glyph is a font's idea of an arrow and it never matches the text
 *  beside it in weight or size. */
function Caret({ open }) {
  return (
    <IconChevronRight
      aria-hidden="true"
      width={13}
      height={13}
      className="transition-transform duration-200"
      style={{ transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', opacity: 0.6 }}
    />
  )
}

export default function SiteNav() {
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open && !mobile) return
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setMobile(false)
      }
    }
    const esc = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setMobile(false)
      }
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open, mobile])

  const close = () => {
    setOpen(false)
    setMobile(false)
  }

  const item = (
    <div
      role="menu"
      className="elev-lg pop-enter absolute left-0 top-10 z-50 w-[19rem] overflow-hidden rounded-[12px] border"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      {SECTIONS.map(([label, href, hint]) => (
        <Link
          key={href}
          href={href}
          role="menuitem"
          onClick={close}
          className="block px-4 py-3 hover:bg-[var(--surface-sunken)]"
        >
          <span className="block text-[13.5px] font-medium">{label}</span>
          <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </span>
        </Link>
      ))}
    </div>
  )

  return (
    /* One rhythm across the whole bar.
       The left links sat on a 28px gap and the right pair on 8px plus a
       nudge, which is what made it look assembled rather than laid out. */
    <div ref={ref} className="flex flex-1 items-center gap-7">
      {/* Words, not buttons. A bar of pills competes with the one button
          that matters; plain words let "Get started" be the only thing on
          the bar that looks pressable. */}
      <nav className="hidden items-center gap-7 md:flex">
        <div className="relative">
          {/* The underline belongs to the word, not to the word plus its
              caret — a rule that runs on under the arrow reads as a mistake. */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex items-center gap-1.5 text-[13.5px] font-medium"
            style={{ color: 'var(--text-body)' }}
          >
            <span className="nav-word" data-open={open || undefined}>
              What it does
            </span>
            <Caret open={open} />
          </button>
          {open && item}
        </div>
        <Link
          href="/pricing"
          className="nav-word text-[13.5px] font-medium"
          style={{ color: 'var(--text-body)' }}
        >
          Pricing
        </Link>
        <Link
          href="/about"
          className="nav-word text-[13.5px] font-medium"
          style={{ color: 'var(--text-body)' }}
        >
          About
        </Link>
      </nav>

      {/* Everything above is navigation; everything below is the account.
          The spacer is what separates the two jobs. */}
      <div className="flex-1" />

      <Link
        href="/login"
        className="nav-word hidden text-[13.5px] font-medium sm:inline-block"
        style={{ color: 'var(--text-body)' }}
      >
        Log in
      </Link>
      <Link href="/signup" className="btn btn-solid control-sm">
        Get started
      </Link>

      {/* Phone: the same list behind one button, since the bar has no room. */}
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
            className="elev-lg pop-enter absolute right-0 top-11 z-50 w-[17rem] overflow-hidden rounded-[12px] border"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            {SECTIONS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={close}
                className="block px-4 py-3 text-[13.5px] hover:bg-[var(--surface-sunken)]"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/pricing"
              onClick={close}
              className="block border-t px-4 py-3 text-[13.5px] font-medium"
              style={{ borderColor: 'var(--border)' }}
            >
              Pricing
            </Link>
            <Link
              href="/about"
              onClick={close}
              className="block px-4 py-3 text-[13.5px] font-medium"
            >
              About
            </Link>
            <Link
              href="/login"
              onClick={close}
              className="block border-t px-4 py-3 text-[13.5px] font-medium"
              style={{ borderColor: 'var(--border)' }}
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
