'use client'

import { useEffect } from 'react'

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

  const hardReload = () => {
    sessionStorage.removeItem('psyllabus_reloaded_after_error')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center px-5">
      <div className="bg-white rounded-xl p-8 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-[#1a2e1e] mb-2">Something went wrong</h1>
        <p className="text-sm text-[#6b7280] mb-6">
          This is usually a cached file from an older version of the app. Reloading normally
          fixes it.
        </p>
        {error?.message && (
          <p className="text-xs text-[#9ca3af] bg-[#f9fafb] border border-[#f0f0f0] rounded-lg p-3 mb-6 text-left break-words">
            {error.message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-2.5 rounded-lg border border-[#e5e7eb] text-sm font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors"
          >
            Try again
          </button>
          <button
            onClick={hardReload}
            className="flex-1 py-2.5 rounded-lg bg-[#2D6A4F] text-white text-sm font-medium hover:bg-[#245a42] transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
