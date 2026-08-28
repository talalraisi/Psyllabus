'use client'

import { useState, useEffect } from 'react'

const KEY = 'psyllabus:theme'

/** Apply a theme, or follow the operating system when set to 'system'. */
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
 * Light and dark, with a third setting that follows the phone or laptop.
 *
 * The choice is written to localStorage and read back by an inline script in
 * the document head, before the browser paints. Without that, a dark-mode user
 * gets a white flash on every page load, which is worse than not having dark
 * mode at all.
 */
export default function ThemeToggle({ compact = false }) {
  const [theme, setTheme] = useState('system')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stored = 'system'
    try {
      stored = localStorage.getItem(KEY) || 'system'
    } catch {
      /* private mode: fall back to following the system */
    }
    setTheme(stored)
    setReady(true)

    // Keep following the system if that is what was chosen.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      try {
        if ((localStorage.getItem(KEY) || 'system') === 'system') applyTheme('system')
      } catch {
        applyTheme('system')
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const choose = (next) => {
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* the theme still applies for this page */
    }
    applyTheme(next)
  }

  const OPTIONS = [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'system', label: 'Auto' },
  ]

  // Render the control only once the stored choice is known, so the highlighted
  // option is never briefly wrong.
  if (!ready) {
    return <div className={compact ? 'h-8' : 'h-9'} aria-hidden="true" />
  }

  return (
    <div
      className="inline-flex rounded-[var(--r-md)] border border-[var(--border-strong)] p-0.5"
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => choose(o.key)}
          aria-pressed={theme === o.key}
          className={`rounded-[var(--r-sm)] px-2.5 text-xs font-medium transition-colors duration-150 ${
            compact ? 'h-7' : 'h-8'
          } ${
            theme === o.key
              ? 'bg-[var(--brand)] text-white'
              : 'text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
