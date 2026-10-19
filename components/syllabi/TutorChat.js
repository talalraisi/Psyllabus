'use client'

import { useEffect, useRef, useState } from 'react'
import MathText from '@/components/MathText'
import SyllabiMark from '@/components/SyllabiMark'

/**
 * Asking Syllabi something, as a conversation.
 *
 * The conversation is kept in this tab only (sessionStorage), per subject:
 * a school computer shared between students should not show the next one
 * what the last one asked. Answers stream in as they are written, and Stop
 * really stops: the request is cancelled and so is the model call behind it.
 */

const MAX = 2000
const KEY = (subject) => `psyllabus:tutor:${subject || 'general'}`

function load(subject) {
  try {
    return JSON.parse(sessionStorage.getItem(KEY(subject)) || '[]')
  } catch {
    return []
  }
}

function save(subject, messages) {
  try {
    sessionStorage.setItem(KEY(subject), JSON.stringify(messages.slice(-40)))
  } catch {
    /* the conversation just will not survive a reload */
  }
}

/** **bold** and $maths$ inside one line of an answer. */
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
      <strong key={i} className="font-semibold">
        <MathText>{p.slice(2, -2)}</MathText>
      </strong>
    ) : (
      <MathText key={i}>{p}</MathText>
    )
  )
}

/**
 * An answer, set as paragraphs and lists. Built as elements, never as HTML,
 * so nothing a model writes can become markup on the page.
 */
function Answer({ text }) {
  const blocks = []
  let list = null
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/)
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      if (!list || list.kind !== kind) {
        list = { kind, items: [] }
        blocks.push(list)
      }
      list.items.push(bullet ? bullet[1] : numbered[2])
      continue
    }
    list = null
    if (!line.trim()) blocks.push(null)
    else if (blocks.length && typeof blocks[blocks.length - 1] === 'string') blocks[blocks.length - 1] += `\n${line}`
    else blocks.push(line)
  }
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((b, i) => {
        if (b === null) return null
        if (typeof b === 'string') {
          return (
            <p key={i} className="whitespace-pre-wrap">
              <Inline text={b} />
            </p>
          )
        }
        const List = b.kind
        return (
          <List key={i} className={`flex flex-col gap-1 pl-5 ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'}`}>
            {b.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}

export default function TutorChat({ subjects = [], topicsFor }) {
  const [subject, setSubject] = useState(subjects[0] || '')
  const [topic, setTopic] = useState('')
  const [messages, setMessages] = useState(() => (typeof window === 'undefined' ? [] : load(subjects[0] || '')))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const abortRef = useRef(null)
  const endRef = useRef(null)
  const boxRef = useRef(null)

  const topics = topicsFor ? topicsFor(subject) : []

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  // Stop anything in flight when the page goes away.
  useEffect(() => () => abortRef.current?.abort(), [])

  const switchSubject = (s) => {
    if (busy) return
    setSubject(s)
    setTopic('')
    setMessages(load(s))
    setNotice(null)
  }

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || busy) return
    const history = [...messages, { role: 'user', content: question }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    if (boxRef.current) boxRef.current.style.height = '40px'
    setNotice(null)
    setBusy(true)

    const controller = new AbortController()
    abortRef.current = controller
    let answer = ''
    try {
      const res = await fetch('/api/syllabi/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, topic: topic || undefined, messages: history }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessages(history.slice(0, -1))
        setInput(question)
        setNotice({
          text: data.code === 'not_configured' ? 'Syllabi is being switched on. Try again soon.' : data.error || 'That did not work.',
          upgrade: data.code === 'upgrade_required',
        })
        setBusy(false)
        return
      }
      const left = res.headers.get('x-syllabi-remaining')
      if (left !== null && left !== '') setRemaining(Number(left))

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
    const final = [...history, { role: 'assistant', content: answer || '(stopped)' }]
    setMessages(final)
    save(subject, final)
    abortRef.current = null
    setBusy(false)
    boxRef.current?.focus()
  }

  const stop = () => abortRef.current?.abort()

  const clear = () => {
    if (busy) return
    setMessages([])
    save(subject, [])
    setNotice(null)
  }

  const starters = [
    topic ? `Explain ${topic} simply` : `What should I know first in ${subject || 'my subject'}?`,
    'Give me a practice question',
    'Check my answer to a question',
  ]

  return (
    <div className="flex flex-col">
      {/* What we are talking about. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {subjects.length > 0 && (
          <select
            value={subject}
            onChange={(e) => switchSubject(e.target.value)}
            disabled={busy}
            aria-label="Subject"
            className="input h-9 w-auto max-w-[16rem] px-3 text-[16px] sm:text-[13px]"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {topics.length > 0 && (
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={busy}
            aria-label="Topic"
            className="input h-9 w-auto max-w-[16rem] px-3 text-[16px] sm:text-[13px]"
          >
            <option value="">Any topic</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <div className="flex-1" />
        {remaining !== null && (
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
            {remaining} left today
          </span>
        )}
        {messages.length > 0 && (
          <button type="button" onClick={clear} disabled={busy} className="btn btn-quiet control-sm">
            New chat
          </button>
        )}
      </div>

      <div
        className="flex min-h-[50vh] flex-col rounded-[16px] border"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      >
        <div className="flex max-h-[calc(100dvh-330px)] min-h-[40vh] flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {messages.length === 0 ? (
            <div className="m-auto flex max-w-sm flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                <SyllabiMark size={20} />
              </span>
              <p className="mt-3 text-[15px] font-semibold">Ask anything about {subject || 'your subjects'}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {starters.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="btn btn-outline control-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === 'user' ? (
                <div
                  key={i}
                  className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-[14px] rounded-br-[4px] px-3.5 py-2.5 text-[14px] leading-relaxed"
                  style={{ background: 'var(--brand-tint)', color: 'var(--text)' }}
                >
                  {m.content}
                </div>
              ) : (
                <div key={i} className="flex max-w-[92%] gap-2.5">
                  <span className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }}>
                    <SyllabiMark size={16} />
                  </span>
                  <div className="min-w-0 text-[14px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {m.content ? (
                      <Answer text={m.content} />
                    ) : (
                      <span className="inline-flex gap-1" aria-label="Writing">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="h-1.5 w-1.5 animate-pulse rounded-full"
                            style={{ background: 'var(--text-faint)', animationDelay: `${d * 160}ms` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              )
            )
          )}
          <div ref={endRef} />
        </div>

        {notice && (
          <p className="mx-4 mb-2 text-[12.5px] sm:mx-6" style={{ color: 'var(--status-weak)' }} role="alert">
            {notice.text}{' '}
            {notice.upgrade && (
              <a href="/pricing" className="underline underline-offset-2">
                See the plans
              </a>
            )}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex items-end gap-2 border-t p-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <textarea
            ref={boxRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value.slice(0, MAX))
              // Grows with what is typed, up to a few lines.
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder={busy ? 'Syllabi is writing…' : 'Ask a question, or paste one you are stuck on'}
            aria-label="Message Syllabi"
            className="input max-h-40 min-h-[40px] flex-1 resize-none px-3 py-2 text-[16px] leading-snug sm:text-[14px]"
            style={{ height: 40 }}
          />
          {busy ? (
            <button type="button" onClick={stop} className="btn btn-outline control-md shrink-0">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="btn btn-solid control-md shrink-0 disabled:opacity-40">
              Send
            </button>
          )}
        </form>
      </div>

      <p className="mt-2 flex flex-wrap justify-between gap-2 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
        <span>Syllabi can make mistakes. It coaches coursework and never writes it.</span>
        {input.length > MAX * 0.8 && (
          <span className="tabular-nums">
            {input.length}/{MAX}
          </span>
        )}
      </p>
    </div>
  )
}

