'use client'

import { useState, useEffect } from 'react'
import { IconSun, IconMoon } from '@/components/Icons'

const KEY = 'psyllabus:theme'

export function applyTheme(theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
}

/**
 * One button that flips between light and dark.
 *
 * A three-way Light / Dark / Auto control was three buttons of chrome for a
 * setting most people touch once, and it does not belong in a row of footer
 * links. Until it is pressed the theme follows the operating system, which is
 * the sensible default; pressing it makes the choice explicit and it sticks.
 *
 * The icon shows what you will get, not what you have, which is the convention
 * people already read correctly.
 */
export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const read = () => {
      const attr = document.documentElement.getAttribute('data-theme')
      setIsDark(attr === 'dark')
    }
    read()
    setReady(true)

    // Keep following the system until an explicit choice is stored.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      let stored = null
      try {
        stored = localStorage.getItem(KEY)
      } catch {
        /* private mode */
      }
      if (!stored || stored === 'system') {
        applyTheme('system')
        read()
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* the theme still applies for this page */
    }
    applyTheme(next)
  }

  // Hold the space until the real theme is known, so the icon is never wrong
  // for a frame.
  if (!ready) return <span className={`inline-block h-9 w-9 ${className}`} aria-hidden="true" />

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--border-strong)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--text)] ${className}`}
    >
      {isDark ? <IconSun width={17} height={17} /> : <IconMoon width={17} height={17} />}
    </button>
  )
}
