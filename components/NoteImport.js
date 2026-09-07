'use client'

import { useState, useRef } from 'react'
import { cardsFromNote } from '@/lib/flashcards'

/** Text files we can read directly in the browser. */
const READABLE = /\.(txt|md|markdown|csv|rtf)$/i

/**
 * Turn notes into cards, from a file or pasted text.
 *
 * Reading happens in the browser and nothing is uploaded anywhere: the text
 * goes straight into the same parser that reads notes written in the app, and
 * only the cards a student approves are ever saved. That keeps a feature that
 * sounds like it needs a server entirely local, which matters while there is
 * deliberately no API in the MVP.
 *
 * PDF and Word are not read here. Both need a parser heavy enough to notice in
 * the bundle, and both usually produce text so mangled that the cards come out
 * wrong, which is worse than not offering it. Pasting works and is honest.
 */
export default function NoteImport({ subject, subjects, onCards }) {
  const [text, setText] = useState('')
  const [subj, setSubj] = useState(subject || subjects?.[0] || '')
  const [subtopic, setSubtopic] = useState('')
  const [fileName, setFileName] = useState('')
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
      setFileName(file.name)
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
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
    // source stays manual: these did not come from a saved note, so there is no
    // note id to point back at.
    onCards(cards.map((c) => ({ ...c, source: 'manual', source_id: null })))
  }

  return (
    <div className="surface p-5">
      <p className="t-small">
        Paste notes, or drop in a <strong className="text-[var(--text)]">.txt</strong> or{' '}
        <strong className="text-[var(--text)]">.md</strong> file. Lines written as{' '}
        <strong className="text-[var(--text)]">term: definition</strong>, or a heading followed by
        what it means, become cards. Nothing is uploaded and nothing is saved until you approve it.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          readFile(e.dataTransfer.files?.[0])
        }}
        className="mt-4 rounded-[var(--r-md)] border border-dashed border-[var(--border-hover)] p-4 text-center"
      >
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
          Choose a file
        </button>
        <p className="t-caption mt-2">
          {fileName ? `Loaded ${fileName}` : 'or drag one here'}
        </p>
      </div>

      <label className="mt-4 block">
        <span className="t-overline">Or paste your notes</span>
        <textarea
          rows={7}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFileName('')
          }}
          placeholder={'Enzyme: a biological catalyst that lowers activation energy\nActive site: where the substrate binds\n\nQ: What does a competitive inhibitor do?\nA: Binds the active site and blocks the substrate.'}
          className="input mt-1 w-full resize-y"
          style={{ height: 'auto', padding: '12px 16px', lineHeight: 1.6 }}
        />
      </label>

      {error && (
        <p className="mt-3 rounded-[var(--r-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <button
        onClick={build}
        disabled={!text.trim() || !subj}
        className="btn btn-solid control-md mt-4"
      >
        Make cards from this
      </button>
    </div>
  )
}
