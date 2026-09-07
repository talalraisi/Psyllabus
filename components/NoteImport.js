'use client'

import { useState, useRef } from 'react'
import { cardsFromNote } from '@/lib/flashcards'
import { displaySubtopic } from '@/lib/progress'

/** Text files we can read directly in the browser. */
const READABLE = /\.(txt|md|markdown|csv|rtf)$/i

/**
 * Turn notes into cards.
 *
 * There used to be a separate button called "build from notes already in the
 * app", which asked a student to trust a sentence about notes they could not
 * see. Their own notes are now listed here by name: pick one and the text
 * appears in the box, so the thing being turned into cards is the thing on the
 * screen. One flow, text in, cards out, whether the text came from a subtopic,
 * a file, or the clipboard.
 *
 * Reading happens in the browser and nothing is uploaded: the text goes into
 * the same parser either way, and only the cards a student approves are saved.
 *
 * PDF and Word are not read here. Both need a parser heavy enough to notice in
 * the bundle, and both usually produce text so mangled that the cards come out
 * wrong, which is worse than not offering it. Pasting works and is honest.
 */
export default function NoteImport({ subject, subjects, savedNotes = [], onCards }) {
  const [text, setText] = useState('')
  const [subj, setSubj] = useState(subject || subjects?.[0] || '')
  const [subtopic, setSubtopic] = useState('')
  const [source, setSource] = useState('') // what filled the box, for the label
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const readFile = (file) => {
    setError('')
    if (!file) return

    if (!READABLE.test(file.name)) {
      setError(
        `${file.name.split('.').pop().toUpperCase()} files cannot be read here. Open it, copy the text, and paste it below.`
      )
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('That file is over 2MB. Paste the part you want cards from instead.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setText(String(reader.result || ''))
      setSource(file.name)
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
  }

  const useNote = (note) => {
    setText(note.body || '')
    setSubj(note.subject || subj)
    setSubtopic(note.subtopic || '')
    setSource(`${note.subject}${note.subtopic ? ` · ${displaySubtopic(note.subtopic)}` : ''}`)
    setError('')
  }

  const build = () => {
    setError('')
    const cards = cardsFromNote({ id: null, subject: subj, subtopic: subtopic || null, body: text })

    if (!cards.length) {
      setError(
        'Nothing here reads as a card. Try lines written as "term: definition", or a heading followed by what it means.'
      )
      return
    }
    // source stays manual: these did not come from a saved note row, so there
    // is no note id to point back at.
    onCards(cards.map((c) => ({ ...c, source: 'manual', source_id: null })))
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div className="flex flex-col gap-4">
      {savedNotes.length > 0 && (
        <div>
          <p className="t-overline mb-2">Notes you have written in the app</p>
          <div className="flex flex-wrap gap-2">
            {savedNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => useNote(n)}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-left text-xs text-[var(--text-body)] transition-colors duration-150 hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)]"
              >
                {n.subtopic ? displaySubtopic(n.subtopic) : n.subject}
                <span className="ml-2 text-[var(--text-faint)]">
                  {(n.body || '').trim().split(/\s+/).filter(Boolean).length}w
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="t-overline">Subject</span>
          <select value={subj} onChange={(e) => setSubj(e.target.value)} className="input mt-1">
            {(subjects || []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="t-overline">Subtopic (optional)</span>
          <input
            value={subtopic}
            onChange={(e) => setSubtopic(e.target.value)}
            placeholder="Enzymes"
            className="input mt-1"
          />
        </label>
      </div>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          readFile(e.dataTransfer.files?.[0])
        }}
        className="block"
      >
        <span className="t-overline">
          Notes {source ? <span className="text-[var(--brand)]">· from {source}</span> : ''}
        </span>
        <textarea
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setSource('')
          }}
          placeholder={'Paste notes here, drop a .txt or .md file on this box, or pick one of your notes above.\n\nEnzyme: a biological catalyst that lowers activation energy\nActive site: where the substrate binds\n\nQ: What does a competitive inhibitor do?\nA: Binds the active site and blocks the substrate.'}
          className="input mt-1 w-full resize-y"
          style={{ height: 'auto', padding: '12px 16px', lineHeight: 1.6 }}
        />
      </label>

      {error && (
        <p className="rounded-[var(--r-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={build} disabled={!text.trim() || !subj} className="btn btn-solid control-md">
          Make cards from this
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.csv,.rtf,text/plain,text/markdown"
          onChange={(e) => {
            readFile(e.target.files?.[0])
            e.target.value = ''
          }}
          className="hidden"
        />
        <button onClick={() => inputRef.current?.click()} className="btn btn-quiet control-md">
          Upload a file
        </button>
        <span className="t-caption">
          {words > 0 ? `${words} words` : 'Nothing is uploaded or saved until you approve the cards'}
        </span>
      </div>
    </div>
  )
}
