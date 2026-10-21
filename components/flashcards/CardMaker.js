'use client'

import { useRef, useState } from 'react'
import MathText from '@/components/MathText'
import Select from '@/components/Select'
import SyllabiMark from '@/components/SyllabiMark'
import { cardsFromNote } from '@/lib/flashcards'
import { prepare, ACCEPT, FileProblem } from '@/components/syllabi/files'
import { displaySubtopic } from '@/lib/progress'

/**
 * Where cards come from: three ways in, one way out.
 *
 *   Upload notes   photos of handwritten notes, PDFs or text files; Syllabi
 *                  reads them and writes the cards (Premium, its own daily
 *                  allowance, 074-notes-cards.sql)
 *   Paste notes    lines like "term: definition" or Q/A pairs, split here in
 *                  the browser, free and instant (lib/flashcards cardsFromNote)
 *   Write one      a front and a back
 *
 * Whatever made them, the cards land in one list to check: edit any of them,
 * drop the ones you do not want, then add the rest. Nothing is saved before
 * that, and nothing uploaded is kept.
 */

const MAX_FILES = 3
const TABS = [
  ['upload', 'Upload notes'],
  ['paste', 'Paste notes'],
  ['write', 'Write one'],
]

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

export default function CardMaker({ subjects, savedNotes = [], syllabi, onSave, onClose, initialTab, initialSubject }) {
  const [tab, setTab] = useState(initialTab || (syllabi ? 'upload' : 'paste'))
  const [subject, setSubject] = useState(subjects.includes(initialSubject) ? initialSubject : subjects[0] || '')
  const [subtopic, setSubtopic] = useState('')
  const [files, setFiles] = useState([])
  const [text, setText] = useState('')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [proposed, setProposed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)

  const addFiles = async (list) => {
    setError('')
    const next = [...files]
    for (const f of Array.from(list || [])) {
      if (next.length >= MAX_FILES) {
        setError(`Up to ${MAX_FILES} files at a time.`)
        break
      }
      try {
        const p = await prepare(f)
        if (!next.some((x) => x.id === p.id)) next.push(p)
      } catch (e) {
        setError(e instanceof FileProblem ? e.message : `${f.name} could not be read.`)
      }
    }
    setFiles(next)
  }

  const fromUpload = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setNote('')
    try {
      const res = await fetch('/api/syllabi/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, subtopic, text, attachments: files.map((f) => ({ name: f.name, data: f.data })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Syllabi could not read those notes just now.')
      setNote(data.note || '')
      setProposed(data.cards.map((c, i) => ({ ...c, key: i, keep: true })))
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  const fromPaste = () => {
    setError('')
    const cards = cardsFromNote({ id: null, subject, subtopic: subtopic || null, body: text })
    if (!cards.length) {
      setError(syllabi ? 'Nothing here reads as a card on its own. Try "term: definition" lines, or use Upload notes and let Syllabi read it.' : 'Nothing here reads as a card. Try lines written as "term: definition", or a heading followed by what it means.')
      return
    }
    setNote('')
    setProposed(cards.map((c, i) => ({ front: c.front, back: c.back, key: i, keep: true })))
  }

  const save = async (list, source) => {
    if (busy) return
    setBusy(true)
    setError('')
    const ok = await onSave(
      list.map((c) => ({ subject, subtopic: subtopic || null, front: c.front.trim(), back: c.back.trim(), source }))
    )
    setBusy(false)
    if (ok) {
      setProposed(null)
      setFiles([])
      setText('')
      setFront('')
      setBack('')
    } else setError('Those cards could not be saved. Try again.')
  }

  const kept = proposed?.filter((c) => c.keep && c.front.trim() && c.back.trim()) || []
  const edit = (key, patch) => setProposed((p) => p.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  return (
    <section className="elev-lg overflow-hidden rounded-[20px] border" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <h2 className="mr-auto text-[15px] font-semibold tracking-[-0.01em]">Make cards</h2>
        <div className="order-3 flex w-full rounded-full p-0.5 sm:order-none sm:w-auto" style={{ background: 'var(--surface-sunken)' }} role="tablist">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k)
                setError('')
              }}
              className="flex-1 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors sm:flex-none"
              style={tab === k ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.2)' } : { color: 'var(--text-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Close" className="order-2 flex h-8 w-8 items-center sm:order-none justify-center rounded-full transition-colors hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-faint)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="m3 3 6 6M9 3 3 9" />
          </svg>
        </button>
      </header>

      <div className="p-5 sm:p-6">
        {/* Where they go */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="t-overline">Subject</span>
            <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="input mt-1 pr-2">
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="t-overline">Subtopic (optional)</span>
            <input value={subtopic} onChange={(e) => setSubtopic(e.target.value)} placeholder="Enzymes" className="input mt-1" />
          </label>
        </div>

        {proposed ? (
          /* ------------------------------------------------- check them */
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[14px] font-semibold">
                {proposed.length} card{proposed.length === 1 ? '' : 's'} to check
              </p>
              <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
                Edit anything, untick what you do not want.
              </p>
            </div>
            {note && (
              <p className="mb-3 flex items-start gap-2 rounded-[12px] px-3.5 py-2.5 text-[12.5px]" style={{ background: 'var(--brand-tint)', color: 'var(--text-body)' }}>
                <SyllabiMark size={13} style={{ color: 'var(--brand)', marginTop: 2 }} />
                {note}
              </p>
            )}
            <ul className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
              {proposed.map((c) => (
                <li key={c.key} className="flex gap-3 rounded-[14px] border p-3 transition-opacity" style={{ borderColor: 'var(--border-strong)', opacity: c.keep ? 1 : 0.45 }}>
                  <input type="checkbox" checked={c.keep} onChange={(e) => edit(c.key, { keep: e.target.checked })} aria-label="Keep this card" className="mt-1.5 h-4 w-4 shrink-0 accent-[var(--brand)]" />
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <textarea value={c.front} onChange={(e) => edit(c.key, { front: e.target.value })} rows={2} aria-label="Front" className="input resize-none text-[16px] font-medium sm:text-[13.5px]" style={{ height: 'auto', padding: '8px 12px' }} />
                    <textarea value={c.back} onChange={(e) => edit(c.key, { back: e.target.value })} rows={2} aria-label="Back" className="input resize-none text-[16px] sm:text-[13px]" style={{ height: 'auto', padding: '8px 12px', color: 'var(--text-muted)' }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => save(kept, tab === 'upload' ? 'syllabi' : 'manual')} disabled={!kept.length || busy} className="btn btn-solid control-md">
                {busy ? 'Adding…' : `Add ${kept.length} card${kept.length === 1 ? '' : 's'}`}
              </button>
              <button onClick={() => setProposed(null)} className="btn btn-quiet control-md">
                Start again
              </button>
            </div>
          </div>
        ) : tab === 'upload' ? (
          /* ------------------------------------------------------ upload */
          !syllabi ? (
            <div className="mt-6 rounded-[16px] border border-dashed px-6 py-10 text-center" style={{ borderColor: 'var(--border-strong)' }}>
              <p className="text-[14px] font-semibold">Turn photos and PDFs of your notes into cards</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Syllabi reads them and writes the cards for you to check. Part of Premium. Pasting notes stays free.
              </p>
              <a href="/dashboard/profile#unlock" className="btn btn-outline control-md mt-5">
                Unlock Syllabi
              </a>
            </div>
          ) : (
            <div className="mt-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  addFiles(e.dataTransfer.files)
                }}
                onClick={() => input.current?.click()}
                className="flex cursor-pointer flex-col items-center rounded-[16px] border-2 border-dashed px-6 py-9 text-center transition-colors"
                style={{ borderColor: dragging ? 'var(--brand)' : 'var(--border-strong)', background: dragging ? 'var(--brand-tint)' : 'var(--surface-sunken)' }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}>
                  <UploadIcon />
                </span>
                <p className="mt-3 text-[14px] font-semibold">Drop your notes here, or choose files</p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  Photos of handwritten notes, PDFs or text files · up to {MAX_FILES} at a time
                </p>
                <input
                  ref={input}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>

              {files.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-2 text-[12.5px]" style={{ borderColor: 'var(--border-strong)' }}>
                      {f.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.preview} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full text-[9.5px] font-bold uppercase" style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}>
                          {f.kind}
                        </span>
                      )}
                      <span className="max-w-[12rem] truncate">{f.name}</span>
                      <button onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} aria-label={`Remove ${f.name}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]" style={{ color: 'var(--text-faint)' }}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Anything to add? Paste notes here too, or tell Syllabi what to focus on."
                className="input mt-3 w-full resize-y text-[16px] sm:text-[13.5px]"
                style={{ height: 'auto', padding: '10px 14px' }}
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={fromUpload} disabled={busy || (!files.length && text.trim().length < 40) || !subject} className="btn btn-solid control-md">
                  <SyllabiMark size={14} />
                  {busy ? 'Reading your notes…' : 'Make cards'}
                </button>
                <span className="t-caption">Nothing is kept. Only the cards you approve are saved.</span>
              </div>
            </div>
          )
        ) : tab === 'paste' ? (
          /* ------------------------------------------------------- paste */
          <div className="mt-6">
            {savedNotes.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {savedNotes.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setText(n.body || '')
                      setSubject(n.subject || subject)
                      setSubtopic(n.subtopic || '')
                    }}
                    className="rounded-full border px-3 py-1 text-[12px] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    {n.subtopic ? displaySubtopic(n.subtopic) : n.subject}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'Enzyme: a biological catalyst that lowers activation energy\nActive site: where the substrate binds\n\nQ: What does a competitive inhibitor do?\nA: Binds the active site and blocks the substrate.'}
              className="input w-full resize-y text-[16px] sm:text-[13.5px]"
              style={{ height: 'auto', padding: '12px 14px', lineHeight: 1.6 }}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={fromPaste} disabled={!text.trim() || !subject} className="btn btn-solid control-md">
                Make cards
              </button>
              <span className="t-caption">Lines like “term: definition”, headings, or Q: and A: pairs.</span>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------- write */
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (front.trim() && back.trim()) save([{ front, back }], 'manual')
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col rounded-[16px] border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }}>
                <span className="t-overline">Front</span>
                <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={4} placeholder="What does a competitive inhibitor do?" className="mt-2 flex-1 resize-none bg-transparent text-[16px] font-medium outline-none sm:text-[15px]" />
              </div>
              <div className="flex flex-col rounded-[16px] border p-4" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }}>
                <span className="t-overline">Back</span>
                <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={4} placeholder="Binds the active site and blocks the substrate." className="mt-2 flex-1 resize-none bg-transparent text-[16px] outline-none sm:text-[14.5px]" />
              </div>
            </div>
            {(front.includes('$') || back.includes('$')) && (
              <p className="mt-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                Preview: <MathText>{front}</MathText> → <MathText>{back}</MathText>
              </p>
            )}
            <button type="submit" disabled={busy || !front.trim() || !back.trim() || !subject} className="btn btn-solid control-md mt-4">
              {busy ? 'Adding…' : 'Add card'}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-[12px] px-4 py-3 text-[13px]" role="alert" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
