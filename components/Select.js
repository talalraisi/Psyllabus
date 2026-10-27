'use client'

import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pageZoom } from '@/lib/page-zoom'

/**
 * The app's dropdown, in place of the browser's <select>.
 *
 * The native one draws its own arrow, jammed against the right edge, and on a
 * rounded pill it looked pushed in rather than part of the control. This
 * keeps the same use (value, onChange with e.target.value, <option> children)
 * so swapping it in changes nothing around it, and draws its own: a light
 * chevron with room either side that turns when the list opens, and a list
 * that drops out of the field with the chosen one ticked.
 *
 * Keyboard: Enter, Space or the arrows open it; arrows move; Enter picks;
 * Escape or Tab closes; typing a letter jumps to the first match. The list
 * is drawn on the page's top layer so no card or drawer can clip it.
 */

function readOptions(children) {
  const out = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      out.push({ value: String(child.props.value ?? ''), label: child.props.children, disabled: Boolean(child.props.disabled) })
    } else if (child.props?.children) {
      out.push(...readOptions(child.props.children))
    }
  })
  return out
}

export function Chevron({ open = false, size = 10, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0, ...style }}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  )
}

export default function Select({ value, onChange, children, className = '', style, disabled = false, 'aria-label': ariaLabel, id }) {
  const options = readOptions(children)
  const current = options.find((o) => o.value === String(value ?? '')) || options[0]
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState(null)
  const trigger = useRef(null)
  const list = useRef(null)
  const listId = useId()

  const measure = () => {
    const r = trigger.current?.getBoundingClientRect()
    if (!r) return
    const height = Math.min(300, options.length * 38 + 12)
    const below = window.innerHeight - r.bottom
    const up = below < height + 16 && r.top > below
    // Measured in screen pixels; on a zoomed large screen, written back in page pixels.
    const z = pageZoom()
    setPlace({
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8) / z,
      width: Math.max(r.width, 200) / z,
      top: up ? undefined : (r.bottom + 6) / z,
      bottom: up ? (window.innerHeight - r.top + 6) / z : undefined,
      up,
    })
  }

  const show = () => {
    if (disabled || !options.length) return
    measure()
    setActive(Math.max(0, options.indexOf(current)))
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  const pick = (o) => {
    if (!o || o.disabled) return
    close()
    if (o.value !== String(value ?? '')) onChange?.({ target: { value: o.value } })
  }

  // While open: follow the field if the page scrolls, and close on a click
  // anywhere else.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (trigger.current?.contains(e.target) || list.current?.contains(e.target)) return
      close(false)
    }
    const onMove = () => measure()
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  })

  // Keep the highlighted option in view as the arrows move it.
  useEffect(() => {
    if (!open) return
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const step = (dir) => {
    let i = active
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length
      if (!options[i].disabled) break
    }
    setActive(i)
  }

  const onKey = (e) => {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === 'ArrowDown') (e.preventDefault(), step(1))
    else if (e.key === 'ArrowUp') (e.preventDefault(), step(-1))
    else if (e.key === 'Home') (e.preventDefault(), setActive(0))
    else if (e.key === 'End') (e.preventDefault(), setActive(options.length - 1))
    else if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), pick(options[active]))
    else if (e.key === 'Escape') (e.preventDefault(), close())
    else if (e.key === 'Tab') close(false)
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase()
      const at = options.findIndex((o, i) => i > active && String(o.label).toLowerCase().startsWith(k))
      const first = at >= 0 ? at : options.findIndex((o) => String(o.label).toLowerCase().startsWith(k))
      if (first >= 0) setActive(first)
    }
  }

  // Callers size the field with their own classes; display is only added
  // when they have not hidden it at some breakpoint themselves.
  const display = /(^|\s)hidden(\s|$)/.test(className) ? '' : 'flex'

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKey}
        className={`${display} cursor-pointer items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        style={style}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ''}</span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors" style={{ color: 'var(--text-faint)', background: open ? 'var(--surface-sunken)' : undefined }}>
          <Chevron open={open} />
        </span>
      </button>

      {open &&
        place &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[100] overflow-y-auto rounded-[14px] border p-1.5 shadow-2xl"
            style={{
              left: place.left,
              top: place.top,
              bottom: place.bottom,
              width: place.width,
              maxWidth: 'min(360px, calc(100vw - 16px))',
              maxHeight: 300,
              borderColor: 'var(--border-strong)',
              background: 'var(--surface)',
              transformOrigin: place.up ? 'bottom' : 'top',
              animation: 'select-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {options.map((o, i) => {
              const chosen = o === current
              return (
                <li
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={chosen}
                  aria-disabled={o.disabled || undefined}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px]"
                  style={{
                    background: i === active ? 'var(--surface-sunken)' : undefined,
                    color: o.disabled ? 'var(--text-faint)' : chosen ? 'var(--text)' : 'var(--text-body)',
                    fontWeight: chosen ? 600 : 500,
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {chosen && (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m3.5 8.5 3 3 6-7" />
                    </svg>
                  )}
                </li>
              )
            })}
          </ul>,
          document.body
        )}
    </>
  )
}
