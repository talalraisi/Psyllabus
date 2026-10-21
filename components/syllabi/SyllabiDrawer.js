'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import SyllabiMark from '@/components/SyllabiMark'
import TutorChat from '@/components/syllabi/TutorChat'
import { hasSyllabi } from '@/lib/access'
import { Close } from '@/components/syllabi/icons'

/**
 * Syllabi, from anywhere in the app.
 *
 * Any page can open a drawer with Syllabi already pointed at what the
 * student is looking at: a question they got wrong, a flashcard, a task on
 * their plan, a test on their calendar. The drawer is the same tutor, with
 * the same limits (the route checks them), in a narrower frame, keeping its
 * own conversations so the full page's are left alone.
 *
 * Only students with Syllabi see the buttons; for everyone else the context
 * says it is not available and AskSyllabi renders nothing.
 */

const SyllabiContext = createContext({ available: false, open: () => {} })

export const useSyllabi = () => useContext(SyllabiContext)

export function SyllabiProvider({ profile, children }) {
  const available = hasSyllabi(profile)
  const [state, setState] = useState(null)
  const count = useRef(0)

  const open = useCallback((detail) => {
    count.current += 1
    setState({ n: count.current, ...detail })
  }, [])
  const close = useCallback(() => setState(null), [])

  // On a wide screen the panel docks to the right and the page moves over
  // for it (html.sy-docked in globals.css), so a quiz question and its
  // answers stay in full view beside the chat instead of under it.
  useEffect(() => {
    if (!state) return
    document.documentElement.classList.add('sy-docked')
    return () => document.documentElement.classList.remove('sy-docked')
  }, [state])

  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state, close])

  return (
    <SyllabiContext.Provider value={{ available, open }}>
      {children}
      {available && state && (
        <>
          <div className="fixed inset-0 z-[55] lg:hidden" style={{ background: 'rgb(0 0 0 / 0.4)' }} onClick={close} aria-hidden="true" />
          {/* Docked beside the page on a wide screen (the page makes room for
              it), a sheet from the bottom on a phone. */}
          <aside
            role="dialog"
            aria-label="Syllabi"
            className="sy-panel fixed inset-x-0 bottom-0 z-[60] flex h-[78dvh] flex-col overflow-hidden rounded-t-[22px] border shadow-2xl lg:inset-x-auto lg:bottom-3 lg:right-3 lg:top-3 lg:h-auto lg:w-[360px] lg:rounded-[20px] lg:shadow-xl"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <header className="flex h-[52px] shrink-0 items-center gap-2.5 border-b px-3.5" style={{ borderColor: 'var(--border)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
                <SyllabiMark size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-tight">Syllabi</p>
                {state.label && (
                  <p className="truncate text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                    {state.label}
                  </p>
                )}
              </div>
              <Link href="/dashboard/syllabi" onClick={close} className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
                Open full
              </Link>
              <button type="button" onClick={close} aria-label="Close Syllabi" className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
                <Close size={13} />
              </button>
            </header>
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-2.5 pt-1">
              <TutorChat
                key={state.n}
                compact
                source={state.label || null}
                subjects={profile?.subjects || []}
                initialSubject={state.subject || ''}
                initialTopic={state.topic || ''}
                initialInput={state.text || ''}
                autoSend={Boolean(state.autoSend && state.text)}
              />
            </div>
          </aside>
        </>
      )}
    </SyllabiContext.Provider>
  )
}

/**
 * A button that opens Syllabi about something. Renders nothing for a
 * student without Syllabi, so it can be dropped in anywhere.
 */
export function AskSyllabi({ subject, topic, text, label = 'Ask Syllabi', context, autoSend = true, size = 'sm', className = '' }) {
  const { available, open } = useSyllabi()
  if (!available) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        open({ subject, topic, text, autoSend, label: context })
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-[transform,filter] hover:brightness-110 active:scale-[0.97] ${size === 'xs' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-[12.5px]'} ${className}`}
      style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
    >
      <SyllabiMark size={size === 'xs' ? 11 : 13} />
      {label}
    </button>
  )
}
