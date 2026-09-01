'use client'

import { useState } from 'react'
import { IconCheck, IconCopy } from '@/components/Icons'

/**
 * Copy some text, and say so.
 *
 * Quiz options are buttons, so dragging to select them does not work the way it
 * does over ordinary text. Anyone wanting to paste a question into their notes
 * had no way to get it out, which is why this exists rather than relying on
 * selection.
 */
export default function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard access can be refused, and on http it is simply absent.
      // A hidden textarea plus execCommand still works in both cases.
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      try {
        document.execCommand('copy')
      } catch {
        return
      } finally {
        document.body.removeChild(el)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={`btn btn-quiet control-sm shrink-0 gap-1.5 px-2.5 text-xs ${className}`}
    >
      {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
      {copied ? 'Copied' : label}
    </button>
  )
}
