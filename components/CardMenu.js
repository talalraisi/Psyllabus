'use client'

import { useEffect, useRef, useState } from 'react'
import { IconClose } from '@/components/Icons'

/**
 * The three dots on a card, same as the one on a question.
 *
 * A card you are mid-session with is exactly when you notice it is wrong —
 * the back is a typo, the front asks two things at once, it is a duplicate.
 * Without this the only options are to carry on being asked it or to leave
 * the session and go hunting for it in a list.
 */
export default function CardMenu({ card, onEdit, onDelete, onSkip }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const esc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const item =
    'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] hover:bg-[var(--surface-sunken)]'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Card options"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-faint)] hover:bg-[var(--surface-sunken)]"
      >
        ⋮
      </button>

      {open && (
        <div
          role="menu"
          className="elev-lg pop-enter absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-[10px] border"
          style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
        >
          {onSkip && (
            <button
              role="menuitem"
              className={item}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onSkip(card)
              }}
            >
              Skip for now
            </button>
          )}
          {onEdit && (
            <button
              role="menuitem"
              className={item}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onEdit(card)
              }}
            >
              Edit this card
            </button>
          )}
          {onDelete && (
            <button
              role="menuitem"
              className={item}
              style={{ color: 'var(--danger)' }}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onDelete(card)
              }}
            >
              <IconClose width={13} height={13} />
              Delete it
            </button>
          )}
        </div>
      )}
    </div>
  )
}
