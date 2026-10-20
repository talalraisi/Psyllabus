'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import MathText from '@/components/MathText'
import SyllabiMark from '@/components/SyllabiMark'
import { subjectCode, shortName } from '@/lib/subject-short'
import { prepare, linksIn, host, MAX_FILES, ACCEPT, FileProblem } from '@/components/syllabi/files'
import { ArrowUp, Stop, Paperclip, Copy, Check, Chevron, FileIcon, LinkIcon, Close } from '@/components/syllabi/icons'

/**
 * Asking Syllabi something.
 *
 * Empty, it is one question in the middle of the page: what are we working
 * on, with your subjects circling the hub and the box to type in right
 * there. Once you ask, the conversation takes the page and the box docks at
 * the bottom. Photos, PDFs and text files ride on the message they are sent
 * with; links in a message are read for you. Answers stream in, and the
 * stop button really stops: the request is cancelled and so is the model
 * call behind it.
 *
 * Conversations are saved to the student's account as they go
 * (syllabi_chats, 069-syllabi-saved.sql): the first answer creates the chat
 * and every answer after it updates it. Files are not kept, only their names.
 */

const MAX = 2000
const LAST = 'psyllabus:tutor:last'
const KEEP = 60 // messages saved per chat

function lastSubject(subjects) {
  try {
    const s = sessionStorage.getItem(LAST)
    return s && subjects.includes(s) ? s : ''
  } catch {
    return ''
  }
}

/** **bold** and $maths$ inside one line of an answer. */
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
      <strong key={i} className="font-semibold" style={{ color: 'var(--text)' }}>
        <MathText>{p.slice(2, -2)}</MathText>
      </strong>
    ) : (
      <MathText key={i}>{p}</MathText>
    )
  )
}

/** An answer as paragraphs and lists, built as elements so nothing a model writes becomes markup. */
function Answer({ text, streaming }) {
  const blocks = []
  let list = null
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/)
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      if (!list || list.kind !== kind) blocks.push((list = { kind, items: [] }))
      list.items.push(bullet ? bullet[1] : numbered[2])
      continue
    }
    list = null
    if (!line.trim()) blocks.push(null)
    else if (typeof blocks[blocks.length - 1] === 'string') blocks[blocks.length - 1] += `\n${line}`
    else blocks.push(line)
  }
  const shown = blocks.filter((b) => b !== null)
  return (
    <div className="flex flex-col gap-3">
      {shown.map((b, i) => {
        const last = streaming && i === shown.length - 1
        if (typeof b === 'string') {
          return (
            <p key={i} className={`whitespace-pre-wrap ${last ? 'sy-caret' : ''}`}>
              <Inline text={b} />
            </p>
          )
        }
        const List = b.kind
        return (
          <List key={i} className={`flex flex-col gap-1.5 pl-5 ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-[var(--text-faint)] ${last ? 'sy-caret' : ''}`}>
            {b.items.map((item, j) => (
              <li key={j} className="pl-1">
                <Inline text={item} />
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* nothing to do */
        }
      }}
      className="flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] transition-colors hover:bg-[var(--surface-sunken)]"
      style={{ color: 'var(--text-faint)' }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

/** The hub, breathing, with your subjects slowly circling it. Tap one to switch to it. */
function Hub({ subjects, subject, onPick }) {
  const ring = subjects.slice(0, 10)
  return (
    <div className="group relative h-[168px] w-[168px]">
      <div aria-hidden="true" className="absolute inset-0 rounded-full border" style={{ borderColor: 'var(--border-strong)' }} />
      <div aria-hidden="true" className="absolute inset-[34px] rounded-full border border-dashed" style={{ borderColor: 'var(--border)' }} />
      <div className="sy-orbit absolute inset-0 group-hover:[animation-play-state:paused]">
        {ring.map((s, i) => {
          const a = (i / ring.length) * 2 * Math.PI - Math.PI / 2
          const on = s === subject
          return (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              title={s}
              aria-label={`Switch to ${s}`}
              aria-pressed={on}
              className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[9.5px] font-semibold transition-colors"
              style={{
                left: `${50 + 50 * Math.cos(a)}%`,
                top: `${50 + 50 * Math.sin(a)}%`,
                background: on ? 'var(--text)' : 'var(--surface)',
                color: on ? 'var(--bg)' : 'var(--text-muted)',
                borderColor: on ? 'var(--text)' : 'var(--border-strong)',
              }}
            >
              <span className="sy-counter block group-hover:[animation-play-state:paused]">{subjectCode(s)}</span>
            </button>
          )
        })}
      </div>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <span aria-hidden="true" className="absolute h-[72px] w-[72px] animate-ping rounded-full" style={{ border: '1px solid color-mix(in srgb, var(--brand) 40%, transparent)', animationDuration: '2.8s' }} />
        <span
          className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full"
          style={{ background: 'var(--brand)', color: '#fff', boxShadow: '0 0 36px color-mix(in srgb, var(--brand) 45%, transparent)' }}
        >
          <SyllabiMark size={24} />
        </span>
      </div>
    </div>
  )
}

/**
 * chat: a saved conversation to carry on with ({ id, subject, messages }).
 * onSaved: told each time the conversation is saved, so a list can update.
 * source: where it was opened from, kept with it ("Flashcard · Physics").
 *
 * compact: the version in the Syllabi drawer, opened from elsewhere in the
 * app. It starts on whatever it was opened about, and with autoSend asks the
 * question straight away, because the student pressed a button that already
 * said what they wanted.
 */
export default function TutorChat({
  subjects = [],
  topicsFor,
  chat = null,
  onSaved,
  onNew,
  source = null,
  initialSubject = '',
  initialInput = '',
  initialTopic = '',
  autoSend = false,
  compact = false,
}) {
  const [subject, setSubject] = useState(() => {
    if (chat?.subject && subjects.includes(chat.subject)) return chat.subject
    if (initialSubject && subjects.includes(initialSubject)) return initialSubject
    return (typeof window !== 'undefined' && lastSubject(subjects)) || subjects[0] || ''
  })
  const [topic, setTopic] = useState(initialTopic)
  const [messages, setMessages] = useState(() => chat?.messages || [])
  const chatId = useRef(chat?.id || null)
  const [input, setInput] = useState(initialInput)
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [notice, setNotice] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [menu, setMenu] = useState(false)
  const [dragging, setDragging] = useState(false)
  const abortRef = useRef(null)
  const scrollRef = useRef(null)
  const boxRef = useRef(null)
  const fileRef = useRef(null)
  const stick = useRef(true)

  const topics = topicsFor ? topicsFor(subject) : []
  const links = linksIn(input)
  const empty = messages.length === 0

  // Keep up with a streaming answer, unless they have scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Opened by a button that already asked the question: ask it.
  const asked = useRef(false)
  useEffect(() => {
    if (!autoSend || !initialInput) return
    // The guard sits inside the timer: a cancelled first run (React runs
    // effects twice in development) must not stop the second from asking.
    const t = setTimeout(() => {
      if (asked.current) return
      asked.current = true
      send(initialInput)
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, initialInput])

  // A question handed over from Ideas arrives already written: fit the box to it.
  useEffect(() => {
    if (autoSend || !initialInput || !boxRef.current) return
    const el = boxRef.current
    el.style.height = 'auto'
    el.style.height = `${Math.min(200, el.scrollHeight)}px`
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [autoSend, initialInput])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menu])

  const resize = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(200, el.scrollHeight)}px`
  }

  const switchSubject = (s) => {
    if (busy || s === subject) return
    setSubject(s)
    setTopic('')
    // A different subject is a different conversation.
    if (messages.length) {
      chatId.current = null
      setMessages([])
    }
    setNotice(null)
    try {
      if (!compact) sessionStorage.setItem(LAST, s)
    } catch {
      /* fine */
    }
  }

  const addFiles = async (list) => {
    const incoming = [...list].slice(0, MAX_FILES - files.length)
    if (list.length > incoming.length) setNotice({ text: `Up to ${MAX_FILES} files per message.` })
    for (const f of incoming) {
      try {
        const ready = await prepare(f)
        setFiles((now) => (now.some((x) => x.id === ready.id) || now.length >= MAX_FILES ? now : [...now, ready]))
      } catch (e) {
        setNotice({ text: e instanceof FileProblem ? e.message : 'That file could not be added.' })
      }
    }
    boxRef.current?.focus()
  }

  const removeFile = (id) =>
    setFiles((now) => {
      const gone = now.find((f) => f.id === id)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return now.filter((f) => f.id !== id)
    })

  const send = async (text) => {
    const question = (text ?? input).trim()
    if ((!question && !files.length) || busy) return
    const asked = question || 'Have a look at this.'
    const sent = files
    const history = [...messages, { role: 'user', content: asked, files: sent.map((f) => ({ name: f.name, kind: f.kind })) }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setFiles([])
    if (boxRef.current) boxRef.current.style.height = 'auto'
    setNotice(null)
    setBusy(true)
    stick.current = true

    const controller = new AbortController()
    abortRef.current = controller
    let answer = ''
    try {
      const res = await fetch('/api/syllabi/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject,
          topic: topic || undefined,
          messages: history.map(({ role, content, files: f }) => ({
            role,
            content: f?.length ? `${content}\n\n(Attached: ${f.map((x) => x.name).join(', ')})` : content,
          })),
          attachments: sent.length ? sent.map((f) => ({ name: f.name, data: f.data })) : undefined,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessages(messages)
        setInput(question)
        setFiles(sent)
        requestAnimationFrame(() => resize(boxRef.current))
        setNotice({
          text: data.code === 'not_configured' ? 'Syllabi is being switched on. Try again soon.' : data.error || 'That did not work.',
          upgrade: data.code === 'upgrade_required',
        })
        setBusy(false)
        return
      }
      const left = res.headers.get('x-syllabi-remaining')
      if (left) setRemaining(Number(left))
      setStreaming(true)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
        setMessages([...history, { role: 'assistant', content: answer }])
      }
    } catch {
      if (!controller.signal.aborted) answer += answer ? '\n\nThe connection dropped.' : 'Could not reach Syllabi. Check your connection.'
    }
    sent.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
    const final = [...history, { role: 'assistant', content: answer || 'Stopped.' }]
    setMessages(final)
    if (answer) await persist(final)
    abortRef.current = null
    setStreaming(false)
    setBusy(false)
    boxRef.current?.focus()
  }

  /** Save the conversation to the account: created on the first answer, updated after. */
  const persist = async (all) => {
    const supabase = createClient()
    const kept = all.slice(-KEEP).map(({ role, content, files: f }) => (f?.length ? { role, content, files: f } : { role, content }))
    const title = (all.find((m) => m.role === 'user')?.content || 'Chat').replace(/\s+/g, ' ').trim().slice(0, 120)
    const now = new Date().toISOString()
    if (chatId.current) {
      const { error } = await supabase.from('syllabi_chats').update({ messages: kept, updated_at: now }).eq('id', chatId.current)
      if (!error) onSaved?.({ id: chatId.current, subject, title, source, updated_at: now })
      return
    }
    const { data, error } = await supabase
      .from('syllabi_chats')
      .insert({ subject: subject || null, title, source, messages: kept })
      .select('id, subject, title, source, updated_at')
      .single()
    if (data) {
      chatId.current = data.id
      onSaved?.(data)
    } else if (error) {
      console.error('syllabi chat save:', error.message)
    }
  }

  const clear = () => {
    if (busy) return
    if (onNew) return onNew()
    chatId.current = null
    setMessages([])
    setNotice(null)
  }

  const starters = [
    topic ? `Explain ${topic} simply` : `Where should I start in ${shortName(subject) || 'this subject'}?`,
    'Give me a practice question',
    'Mark my answer to a question',
  ]

  const composer = (
    <div className="w-full">
      <div
        className="relative rounded-[24px] border transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--brand)]"
        style={{
          borderColor: dragging ? 'var(--brand)' : 'var(--border-strong)',
          background: 'var(--surface)',
          boxShadow: '0 10px 40px -12px rgb(0 0 0 / 0.25)',
        }}
      >
        {(files.length > 0 || links.length > 0) && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {files.map((f) => (
              <span
                key={f.id}
                className="sy-rise flex h-11 items-center gap-2 rounded-[12px] border pl-1.5 pr-1 text-[12px]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
              >
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt="" className="h-8 w-8 rounded-[8px] object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px]" style={{ background: 'var(--surface)', color: f.kind === 'pdf' ? 'var(--status-weak)' : 'var(--text-muted)' }}>
                    <FileIcon />
                  </span>
                )}
                <span className="max-w-[9rem] truncate" style={{ color: 'var(--text-body)' }}>
                  {f.name}
                </span>
                <button type="button" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--surface)]" style={{ color: 'var(--text-faint)' }}>
                  <Close />
                </button>
              </span>
            ))}
            {links.map((l) => (
              <span key={l} className="sy-rise flex h-11 items-center gap-2 rounded-[12px] border px-3 text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)', color: 'var(--text-body)' }}>
                <LinkIcon />
                <span className="max-w-[10rem] truncate">Reads {host(l)}</span>
              </span>
            ))}
          </div>
        )}

        <textarea
          ref={boxRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value.slice(0, MAX))
            resize(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault()
              addFiles(e.clipboardData.files)
            }
          }}
          rows={1}
          placeholder={`Ask anything about ${shortName(subject) || 'your subjects'}`}
          aria-label="Message Syllabi"
          className="block max-h-[200px] w-full resize-none bg-transparent px-5 pb-2 pt-4 text-[16px] leading-relaxed outline-none placeholder:text-[var(--text-faint)] sm:text-[15px]"
          style={{ color: 'var(--text)' }}
        />

        <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
          <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || files.length >= MAX_FILES}
            title="Add a photo, PDF or text file"
            aria-label="Attach a file"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40"
            style={{ color: 'var(--text-muted)' }}
          >
            <Paperclip />
          </button>

          {subjects.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenu((m) => !m)
                }}
                disabled={busy}
                aria-expanded={menu}
                className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors hover:bg-[var(--surface-sunken)]"
                style={{ color: 'var(--text-body)' }}
              >
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[9.5px] font-semibold" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                  {subjectCode(subject)}
                </span>
                <span className="hidden max-w-[10rem] truncate sm:inline">{shortName(subject)}</span>
                <Chevron up={menu} />
              </button>
              {menu && (
                <div
                  className="pop-enter absolute bottom-full left-0 z-20 mb-2 max-h-72 w-64 overflow-y-auto rounded-[14px] border p-1.5 shadow-xl"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                >
                  {subjects.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => switchSubject(s)}
                      className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left text-[13px] transition-colors hover:bg-[var(--surface-sunken)]"
                      style={s === subject ? { background: 'var(--surface-sunken)' } : undefined}
                    >
                      <span className="flex h-6 w-7 items-center justify-center rounded-full text-[9.5px] font-semibold" style={{ background: s === subject ? 'var(--text)' : 'var(--surface-sunken)', color: s === subject ? 'var(--bg)' : 'var(--text-muted)' }}>
                        {subjectCode(s)}
                      </span>
                      <span className="flex-1 truncate">{s}</span>
                      {s === subject && <Check size={13} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {compact && topic && (
            <span className="max-w-[12rem] truncate rounded-full px-2.5 py-1 text-[12px]" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }} title={topic}>
              About: {topic}
            </span>
          )}
          {!compact && topics.length > 0 && (
            <span className="relative flex items-center">
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={busy}
                aria-label="Topic"
                className="h-9 max-w-[11rem] cursor-pointer appearance-none truncate rounded-full bg-transparent pl-2.5 pr-7 text-[13px] outline-none transition-colors hover:bg-[var(--surface-sunken)]"
                style={{ color: topic ? 'var(--text-body)' : 'var(--text-faint)', fieldSizing: 'content' }}
              >
                <option value="">Any topic</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5" style={{ color: 'var(--text-faint)' }}>
                <Chevron size={12} />
              </span>
            </span>
          )}

          <div className="flex-1" />
          {remaining !== null && (
            <span className="hidden text-[11.5px] tabular-nums sm:inline" style={{ color: 'var(--text-faint)' }}>
              {remaining} left today
            </span>
          )}
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop"
              className="flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-90"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              <Stop />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim() && !files.length}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full transition-[transform,background-color,opacity] duration-200 active:scale-90 disabled:opacity-30"
              style={{ background: input.trim() || files.length ? 'var(--brand)' : 'var(--text-faint)', color: '#fff' }}
            >
              <ArrowUp />
            </button>
          )}
        </div>
      </div>
      {notice && (
        <p className="sy-rise mt-2 px-2 text-[12.5px]" style={{ color: 'var(--status-weak)' }} role="alert">
          {notice.text}{' '}
          {notice.upgrade && (
            <a href="/pricing" className="underline underline-offset-2">
              See the plans
            </a>
          )}
        </p>
      )}
    </div>
  )

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[24px] border-2 border-dashed" style={{ borderColor: 'var(--brand)', background: 'color-mix(in srgb, var(--brand) 8%, transparent)' }}>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--brand)' }}>
            Drop to attach
          </p>
        </div>
      )}

      {empty && compact ? (
        <>
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--brand)', color: '#fff', boxShadow: '0 0 30px color-mix(in srgb, var(--brand) 40%, transparent)' }}>
              <SyllabiMark size={18} />
            </span>
            <p className="mt-4 text-[17px] font-semibold tracking-[-0.015em]">Ask about {topic || shortName(subject) || 'anything'}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-[12px] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]" style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2">{composer}</div>
        </>
      ) : empty ? (
        <div className="flex flex-1 flex-col items-center justify-center pb-6">
          <div className="sy-rise">
            <Hub subjects={subjects} subject={subject} onPick={switchSubject} />
          </div>
          <h2 className="sy-rise mt-7 text-center text-[clamp(1.4rem,3vw,1.85rem)] font-semibold tracking-[-0.025em]" style={{ animationDelay: '60ms' }}>
            What are we working on?
          </h2>
          <p className="sy-rise mt-2 text-center text-[13.5px]" style={{ color: 'var(--text-muted)', animationDelay: '100ms' }}>
            Ask a question, attach a photo of one, or paste a link.
          </p>
          <div className="sy-rise mt-7 w-full max-w-2xl" style={{ animationDelay: '140ms' }}>
            {composer}
          </div>
          <div className="sy-rise mt-4 flex max-w-2xl flex-wrap justify-center gap-2" style={{ animationDelay: '180ms' }}>
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            }}
            className="flex-1 overflow-y-auto"
          >
            <div className={`mx-auto flex flex-col gap-7 pb-6 pt-2 ${compact ? 'px-0.5' : 'max-w-3xl px-1'}`}>
              <div className="flex justify-end">
                <button type="button" onClick={clear} disabled={busy} className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40" style={{ color: 'var(--text-faint)' }}>
                  New chat
                </button>
              </div>
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="sy-rise flex flex-col items-end gap-1.5">
                    {m.files?.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {m.files.map((f, j) => (
                          <span key={j} className="flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[12px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            <FileIcon size={13} />
                            <span className="max-w-[10rem] truncate">{f.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] px-4 py-2.5 text-[15px] leading-relaxed" style={{ background: 'var(--surface-sunken)', color: 'var(--text)' }}>
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="sy-rise group flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
                      <SyllabiMark size={13} />
                    </span>
                    <div className="min-w-0 flex-1 text-[15px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
                      {m.content ? (
                        <>
                          <Answer text={m.content} streaming={streaming && i === messages.length - 1} />
                          {!(busy && i === messages.length - 1) && (
                            <div className="mt-2 -ml-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <CopyButton text={m.content} />
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="flex h-7 items-center gap-1.5" aria-label="Thinking">
                          {[0, 1, 2].map((d) => (
                            <span key={d} className="sy-dot h-2 w-2 rounded-full" style={{ background: 'var(--brand)', animationDelay: `${d * 160}ms` }} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
          <div className={`mx-auto w-full pt-2 ${compact ? '' : 'max-w-3xl'}`}>
            {composer}
            <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
              Syllabi can make mistakes. It coaches coursework and never writes it.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
