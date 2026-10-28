'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconClose, IconFolder, IconPlus } from '@/components/Icons'

/**
 * The small pieces decks and folders need: a sheet to name something, one to
 * confirm a delete, one to pick a deck or a folder, and the three dots that
 * open them.
 *
 * Sheets rise from the bottom on a phone and sit in the middle on a larger
 * screen, like the paper picker. They render into the body: the page around
 * them animates with a transform, which would make "fixed" mean fixed to the
 * page rather than the screen.
 */

export function Sheet({ title, sub, onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="pop-enter relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-[20px] border sm:rounded-[20px]" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
            {sub && (
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                {sub}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-muted)' }}>
            <IconClose width={17} height={17} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/** A line at the bottom of the screen that goes by itself. */
export function Toast({ children }) {
  return createPortal(
    <div className="pop-enter pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4" role="status">
      <span className="elev-lg rounded-full px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
        {children}
      </span>
    </div>,
    document.body
  )
}

/** Name a new deck or folder, or rename one. */
export function NameSheet({ title, sub, initial = '', placeholder, action = 'Save', onSubmit, onClose }) {
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const clean = name.trim().slice(0, 80)
  const submit = async (e) => {
    e.preventDefault()
    if (!clean || busy) return
    setBusy(true)
    const ok = await onSubmit(clean)
    setBusy(false)
    if (ok !== false) onClose()
  }
  return (
    <Sheet title={title} sub={sub} onClose={onClose}>
      <form onSubmit={submit}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={placeholder} aria-label="Name" className="input h-11 w-full text-[16px] sm:text-[14px]" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-quiet control-md">
            Cancel
          </button>
          <button type="submit" disabled={!clean || busy} className="btn btn-solid control-md">
            {busy ? 'Saving…' : action}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export function ConfirmSheet({ title, body, action = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
        {body}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-quiet control-md">
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onConfirm()
            setBusy(false)
            onClose()
          }}
          className="btn control-md"
          style={{ background: 'var(--danger)', color: '#fff' }}
        >
          {busy ? 'Working…' : action}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * Pick one of the student's decks, or name a new one. `suggest` fills the new
 * deck's name, so adding a ready-made topic to a fresh deck is two taps.
 */
export function PickDeckSheet({ title, sub, decks, folders, exclude, suggest = '', onPick, onClose }) {
  const [naming, setNaming] = useState(!decks.some((d) => d.id !== exclude))
  const [name, setName] = useState(suggest)
  const [busy, setBusy] = useState(false)
  const folderName = (id) => folders.find((f) => f.id === id)?.name
  const pick = async (target) => {
    if (busy) return
    setBusy(true)
    const ok = await onPick(target)
    setBusy(false)
    if (ok !== false) onClose()
  }
  const list = decks.filter((d) => d.id !== exclude)
  return (
    <Sheet title={title} sub={sub} onClose={onClose}>
      {list.length > 0 && (
        <ul className="-mx-2 mb-3 flex flex-col">
          {list.map((d) => (
            <li key={d.id}>
              <button disabled={busy} onClick={() => pick({ id: d.id })} className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left hover:bg-[var(--surface-sunken)]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{d.name}</span>
                  {d.folder_id && folderName(d.folder_id) && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                      <IconFolder width={11} height={11} />
                      {folderName(d.folder_id)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {naming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) pick({ name: name.trim().slice(0, 80) })
          }}
          className="flex gap-2"
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="New deck name" aria-label="New deck name" className="input h-10 min-w-0 flex-1 text-[16px] sm:text-[13.5px]" />
          <button type="submit" disabled={!name.trim() || busy} className="btn btn-solid control-md shrink-0">
            {busy ? 'Adding…' : 'Create'}
          </button>
        </form>
      ) : (
        <button onClick={() => setNaming(true)} className="flex items-center gap-2 text-[13.5px] font-medium" style={{ color: 'var(--brand)' }}>
          <IconPlus width={14} height={14} />
          New deck
        </button>
      )}
    </Sheet>
  )
}

/** Put a deck in a folder, or take it out of one. */
export function PickFolderSheet({ deck, folders, onPick, onNewFolder, onClose }) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const row = 'flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left text-[14px] hover:bg-[var(--surface-sunken)]'
  const go = async (id) => {
    await onPick(id)
    onClose()
  }
  return (
    <Sheet title="Move to a folder" sub={deck.name} onClose={onClose}>
      <ul className="-mx-2 mb-3 flex flex-col">
        {folders.map((f) => (
          <li key={f.id}>
            <button onClick={() => go(f.id)} className={row} aria-current={deck.folder_id === f.id || undefined}>
              <IconFolder width={15} height={15} style={{ color: 'var(--text-faint)' }} />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              {deck.folder_id === f.id && (
                <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  Here now
                </span>
              )}
            </button>
          </li>
        ))}
        {deck.folder_id && (
          <li>
            <button onClick={() => go(null)} className={row} style={{ color: 'var(--text-muted)' }}>
              Take it out of its folder
            </button>
          </li>
        )}
      </ul>
      {naming ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const f = name.trim() && (await onNewFolder(name.trim().slice(0, 80)))
            if (f) go(f.id)
          }}
          className="flex gap-2"
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Folder name" aria-label="Folder name" className="input h-10 min-w-0 flex-1 text-[16px] sm:text-[13.5px]" />
          <button type="submit" disabled={!name.trim()} className="btn btn-solid control-md shrink-0">
            Create
          </button>
        </form>
      ) : (
        <button onClick={() => setNaming(true)} className="flex items-center gap-2 text-[13.5px] font-medium" style={{ color: 'var(--brand)' }}>
          <IconPlus width={14} height={14} />
          New folder
        </button>
      )}
    </Sheet>
  )
}

/** Three dots and a short list: Rename, Move, Delete. */
export function DotsMenu({ label = 'Options', items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const away = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[17px] leading-none hover:bg-[var(--surface-sunken)]"
        style={{ color: 'var(--text-faint)' }}
      >
        ⋮
      </button>
      {open && (
        <div role="menu" className="elev-lg pop-enter absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-[10px] border py-1" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          {items.filter(Boolean).map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                it.onClick()
              }}
              className={`flex w-full px-3.5 py-2.5 text-left text-[13px] ${it.danger ? 'hover:bg-[var(--danger-bg)]' : 'hover:bg-[var(--surface-sunken)]'}`}
              style={{ color: it.danger ? 'var(--danger)' : 'var(--text)' }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
