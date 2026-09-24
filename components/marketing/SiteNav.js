'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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

const SECTIONS = [
  ['How it works', '/#how-it-works', 'Three steps, and the second one is the point.'],
  ['Try a question', '/#try-it', 'A real one, marked the way the app marks it.'],
  ['The five levels', '/#mastery', 'What moves you up, and what quietly moves you down.'],
  ['What it does', '/#features', 'Eight things, grouped by the question they answer.'],
  ['For schools', '/#schools', 'One code for a year group. No teacher dashboard.'],
  ['Questions', '/#faq', 'The ones people actually ask before signing up.'],
]

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
      className="elev-lg pop-enter absolute left-0 top-11 z-50 w-[19rem] overflow-hidden rounded-[12px] border"
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
    <div ref={ref} className="flex flex-1 items-center justify-end gap-2">
      {/* Desktop: one menu, then the two things people came for. */}
      <div className="relative mr-auto hidden md:block">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="btn btn-quiet control-sm"
        >
          What it does
          <span aria-hidden="true" className="ml-0.5 text-[10px]">
            ▾
          </span>
        </button>
        {open && item}
      </div>

      <Link href="/pricing" className="btn btn-quiet control-sm hidden md:inline-flex">
        Pricing
      </Link>
      <Link href="/login" className="btn btn-quiet control-sm hidden sm:inline-flex">
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
          ☰
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
              href="/login"
              onClick={close}
              className="block px-4 py-3 text-[13.5px] font-medium"
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
