'use client'

import { useState } from 'react'
import { subjectCode } from '@/lib/subject-short'
import { Close } from '@/components/syllabi/icons'

/**
 * A student's saved Syllabi conversations, newest first, grouped by when.
 * Deleting takes two taps so a stray one does not lose a conversation.
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

export default function ChatHistory({ chats, activeId, onOpen, onNew, onDelete, loading }) {
  const [confirming, setConfirming] = useState(null)
  const [now] = useState(() => new Date())

  const groups = []
  for (const c of chats) {
    const g = group(c.updated_at, now)
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] })
    groups[groups.length - 1].items.push(c)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onNew}
        className="mb-3 flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[12px] border text-[13px] font-semibold transition-colors hover:bg-[var(--surface-sunken)]"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        <span className="text-[16px] leading-none" style={{ color: 'var(--brand)' }}>
          +
        </span>
        New chat
      </button>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-[10px]" style={{ background: 'var(--surface-sunken)' }} />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
            Your chats will be kept here.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.name} className="mb-3">
              <p className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
                {g.name}
              </p>
              {g.items.map((c) => {
                const on = c.id === activeId
                return (
                  <div key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onOpen(c)}
                      className="flex w-full items-center gap-2 rounded-[10px] py-2 pl-2 pr-8 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                      style={on ? { background: 'var(--surface-sunken)' } : undefined}
                      title={c.title}
                    >
                      <span
                        className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-semibold"
                        style={{ background: on ? 'var(--text)' : 'var(--surface-sunken)', color: on ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
                      >
                        {subjectCode(c.subject || '') || '·'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]" style={{ color: on ? 'var(--text)' : 'var(--text-body)' }}>
                          {c.title || 'Chat'}
                        </span>
                        {c.source && (
                          <span className="block truncate text-[11px]" style={{ color: 'var(--text-faint)' }}>
                            {c.source}
                          </span>
                        )}
                      </span>
                    </button>
                    {confirming === c.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirming(null)
                          onDelete(c)
                        }}
                        onBlur={() => setConfirming(null)}
                        autoFocus
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[8px] px-2 py-1 text-[11.5px] font-semibold"
                        style={{ background: 'var(--status-weak)', color: '#fff' }}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(c.id)}
                        aria-label={`Delete "${c.title}"`}
                        className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-[var(--surface)] focus:opacity-100 group-hover:opacity-100"
                        style={{ color: 'var(--text-faint)' }}
                      >
                        <Close size={11} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
