'use client'

import { useEffect, useRef, useState } from 'react'
import { subjectCode } from '@/lib/subject-short'
import { Close } from '@/components/syllabi/icons'
import { Chevron } from '@/components/Select'

/**
 * A student's saved Syllabi conversations: their own folders first, then
 * everything not in one, newest first and grouped by when.
 *
 * A chat goes into a folder from its ⋯ menu, or by dragging it onto the
 * folder. Folders can be renamed and deleted; deleting one keeps its chats,
 * which go back to the main list. Deleting a chat takes two taps so a stray
 * one does not lose a conversation.
 */

function group(at, now) {
  const d = new Date(at)
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  if (days < 31) return 'This month'
  return 'Earlier'
}

function FolderIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      {open ? <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7.5a2 2 0 0 0-1.9 1.4L3 19V7Z M3 19l2.6-7.6A2 2 0 0 1 7.5 10H22l-2.7 7.9a2 2 0 0 1-1.9 1.1H3Z" /> : <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />}
    </svg>
  )
}

function ChatRow({ chat, active, folders, onOpen, onDelete, onMove }) {
  const [menu, setMenu] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!menu) return
    const away = (e) => !ref.current?.contains(e.target) && (setMenu(false), setConfirming(false))
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [menu])

  return (
    <div
      ref={ref}
      className="group relative"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-chat', chat.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(chat)}
        className="flex w-full items-center gap-2 rounded-[10px] py-2 pl-2 pr-8 text-left transition-colors hover:bg-[var(--surface-sunken)]"
        style={active ? { background: 'var(--surface-sunken)' } : undefined}
        title={chat.title}
      >
        <span
          className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-semibold"
          style={{ background: active ? 'var(--text)' : 'var(--surface-sunken)', color: active ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          {subjectCode(chat.subject || '') || '·'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px]" style={{ color: active ? 'var(--text)' : 'var(--text-body)' }}>
            {chat.title || 'Chat'}
          </span>
          {chat.source && (
            <span className="block truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
              {chat.source}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-label={`Options for "${chat.title || 'Chat'}"`}
        aria-expanded={menu}
        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[14px] leading-none opacity-0 transition-opacity hover:bg-[var(--surface)] focus:opacity-100 group-hover:opacity-100"
        style={{ color: 'var(--text-faint)', opacity: menu ? 1 : undefined }}
      >
        ⋯
      </button>
      {menu && (
        <div className="pop-enter absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-[12px] border p-1 shadow-xl" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }} role="menu">
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
            Move to
          </p>
          {folders.map((f) => (
            <button
              key={f.id}
              role="menuitem"
              onClick={() => (setMenu(false), onMove(chat, f.id))}
              disabled={chat.folder_id === f.id}
              className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40"
            >
              <FolderIcon />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
          {chat.folder_id && (
            <button role="menuitem" onClick={() => (setMenu(false), onMove(chat, null))} className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--surface-sunken)]">
              Out of its folder
            </button>
          )}
          {!folders.length && (
            <p className="px-2.5 pb-1.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              Make a folder first.
            </p>
          )}
          <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
          <button
            role="menuitem"
            onClick={() => (confirming ? (setMenu(false), onDelete(chat)) : setConfirming(true))}
            className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors"
            style={confirming ? { background: 'var(--status-weak)', color: '#fff' } : { color: 'var(--status-weak)' }}
          >
            <Close size={10} />
            {confirming ? 'Tap again to delete' : 'Delete chat'}
          </button>
        </div>
      )}
    </div>
  )
}

function Folder({ folder, chats, activeId, folders, open, onToggle, onOpen, onDelete, onMove, onRename, onRemove }) {
  const [over, setOver] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(folder.name)
  const [confirming, setConfirming] = useState(false)

  return (
    <div
      className="mb-1 rounded-[12px] transition-colors"
      style={{ background: over ? 'var(--brand-tint)' : undefined, outline: over ? '1px dashed var(--brand)' : 'none' }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('text/x-chat')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData('text/x-chat')
        const chat = id && chats.all.find((c) => c.id === id)
        if (chat && chat.folder_id !== folder.id) onMove(chat, folder.id)
      }}
    >
      <div className="group flex items-center gap-1 rounded-[10px] pr-1 transition-colors hover:bg-[var(--surface-sunken)]">
        {renaming ? (
          <form
            className="flex flex-1 items-center gap-1 p-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) onRename(folder, name.trim())
              setRenaming(false)
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus onBlur={(e) => e.currentTarget.form.requestSubmit()} className="input h-8 flex-1 rounded-[8px] px-2 text-[16px] sm:text-[13px]" aria-label="Folder name" />
          </form>
        ) : (
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left">
            <span style={{ color: 'var(--text-faint)' }}>
              <Chevron open={open} style={{ transform: open ? 'none' : 'rotate(-90deg)' }} />
            </span>
            <span style={{ color: 'var(--brand)' }}>
              <FolderIcon open={open} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
              {folder.name}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {chats.inside.length}
            </span>
          </button>
        )}
        {!renaming && (
          <span className="hidden focus-within:flex group-hover:flex">
            <button type="button" onClick={() => setRenaming(true)} aria-label={`Rename ${folder.name}`} className="rounded-full px-1.5 py-1 text-[11px]" style={{ color: 'var(--text-faint)' }}>
              Rename
            </button>
            <button
              type="button"
              onClick={() => (confirming ? onRemove(folder) : setConfirming(true))}
              onBlur={() => setConfirming(false)}
              aria-label={`Delete folder ${folder.name}`}
              className="rounded-full px-1.5 py-1 text-[11px] font-medium"
              style={confirming ? { background: 'var(--status-weak)', color: '#fff' } : { color: 'var(--text-faint)' }}
            >
              {confirming ? 'Delete?' : <Close size={10} />}
            </button>
          </span>
        )}
      </div>
      {open && (
        <div className="ml-4 border-l pl-1.5" style={{ borderColor: 'var(--border)' }}>
          {chats.inside.length ? (
            chats.inside.map((c) => <ChatRow key={c.id} chat={c} active={c.id === activeId} folders={folders} onOpen={onOpen} onDelete={onDelete} onMove={onMove} />)
          ) : (
            <p className="px-2 py-2 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Empty. Drag a chat here, or use its ⋯ menu.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChatHistory({ chats, folders = [], activeId, onOpen, onNew, onDelete, onMove, onCreateFolder, onRenameFolder, onDeleteFolder, loading }) {
  const [now] = useState(() => new Date())
  const [openFolders, setOpenFolders] = useState(() => new Set())
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const loose = chats.filter((c) => !c.folder_id || !folders.some((f) => f.id === c.folder_id))
  const groups = []
  for (const c of loose) {
    const g = group(c.updated_at, now)
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] })
    groups[groups.length - 1].items.push(c)
  }
  // The open chat's folder stays open, so the highlighted chat is visible.
  const activeFolder = chats.find((c) => c.id === activeId)?.folder_id

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 gap-2">
        <button type="button" onClick={onNew} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[12px] border text-[13px] font-semibold transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderColor: 'var(--border-strong)' }}>
          <span className="text-[16px] leading-none" style={{ color: 'var(--brand)' }}>
            +
          </span>
          New chat
        </button>
        <button
          type="button"
          onClick={() => setNaming((v) => !v)}
          aria-label="New folder"
          title="New folder"
          aria-pressed={naming}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border transition-colors hover:bg-[var(--surface-sunken)]"
          style={{ borderColor: 'var(--border-strong)', color: naming ? 'var(--brand)' : 'var(--text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
            <path d="M12 10.5v5M9.5 13h5" />
          </svg>
        </button>
      </div>

      {naming && (
        <form
          className="mb-3 flex shrink-0 gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return
            const id = await onCreateFolder(name.trim())
            if (id) setOpenFolders((s) => new Set(s).add(id))
            setName('')
            setNaming(false)
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" maxLength={40} autoFocus aria-label="Folder name" className="input h-9 flex-1 rounded-[10px] px-3 text-[16px] sm:text-[13px]" />
          <button type="submit" disabled={!name.trim()} className="btn btn-solid control-sm">
            Add
          </button>
        </form>
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-[10px]" style={{ background: 'var(--surface-sunken)' }} />
            ))}
          </div>
        ) : (
          <>
            {folders.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                  Folders
                </p>
                {folders.map((f) => (
                  <Folder
                    key={f.id}
                    folder={f}
                    folders={folders}
                    chats={{ all: chats, inside: chats.filter((c) => c.folder_id === f.id) }}
                    activeId={activeId}
                    open={openFolders.has(f.id) || activeFolder === f.id}
                    onToggle={() =>
                      setOpenFolders((s) => {
                        const n = new Set(s)
                        n.has(f.id) ? n.delete(f.id) : n.add(f.id)
                        return n
                      })
                    }
                    onOpen={onOpen}
                    onDelete={onDelete}
                    onMove={onMove}
                    onRename={onRenameFolder}
                    onRemove={onDeleteFolder}
                  />
                ))}
              </div>
            )}

            {chats.length === 0 ? (
              <p className="px-2 py-4 text-center text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                Your chats will be kept here.
              </p>
            ) : (
              <div
                onDragOver={(e) => [...e.dataTransfer.types].includes('text/x-chat') && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const chat = chats.find((c) => c.id === e.dataTransfer.getData('text/x-chat'))
                  if (chat?.folder_id) onMove(chat, null)
                }}
              >
                {groups.map((g) => (
                  <div key={g.name} className="mb-3">
                    <p className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                      {g.name}
                    </p>
                    {g.items.map((c) => (
                      <ChatRow key={c.id} chat={c} active={c.id === activeId} folders={folders} onOpen={onOpen} onDelete={onDelete} onMove={onMove} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
