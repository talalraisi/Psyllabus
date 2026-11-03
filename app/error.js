'use client'

import { useEffect, useState } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Stale JS chunks from a previous deployment are the most common cause of a
    // hard client crash. Reload once (bypassing cache) to pick up fresh assets.
    const key = 'psyllabus_reloaded_after_error'
    const isChunkError =
      /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(
        error?.message || ''
      )
    if (isChunkError && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      window.location.reload()
    }
  }, [error])

  // Where it broke, for pasting to whoever is fixing it: the page, the
  // message and the first lines of the stack. Nothing is sent anywhere.
  const [copied, setCopied] = useState(false)
  const copyDetails = async () => {
    const text = [
      `Page: ${window.location.pathname}${window.location.search}`,
      `Error: ${error?.message || error}`,
      ...(String(error?.stack || '').split('\n').slice(0, 12)),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      window.prompt('Copy this:', text)
    }
  }

  const hardReload = () => {
    sessionStorage.removeItem('psyllabus_reloaded_after_error')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-5">
      <div className="surface p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-[var(--text)] mb-2">Something went wrong</h1>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          This is usually a cached file from an older version of the app. Reloading normally
          fixes it.
        </p>
        {error?.message && (
          <p className="text-xs text-[var(--text-faint)] bg-[var(--surface-sunken)] border border-[var(--border)] rounded-lg p-3 mb-6 text-left break-words">
            {error.message}
          </p>
        )}
        <button type="button" onClick={copyDetails} className="mb-3 text-xs font-medium text-[var(--brand)] hover:underline">
          {copied ? 'Copied. Paste it to us.' : 'Copy details for support'}
        </button>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 btn btn-quiet control-md"
          >
            Try again
          </button>
          <button
            onClick={hardReload}
            className="flex-1 btn btn-solid control-md"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
