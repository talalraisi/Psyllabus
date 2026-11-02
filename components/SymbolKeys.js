'use client'

import { useState } from 'react'

/**
 * Symbols for a typed answer: a small keyboard button beside the box that
 * opens rows of the symbols a phone or laptop keyboard hides (×, √, π, x²,
 * subscripts, Greek, reaction arrows). A key types into the box at the
 * cursor and keeps the cursor there, so it works mid-word.
 *
 * Marking reads them back (lib/grading.js plainMath): x² is x^2, H₂O is H2O.
 *
 *   <SymbolKeys target={inputRef} value={value} onChange={setValue} subject="Chemistry HL" />
 *
 * target: a ref to the input or textarea. Renders the toggle; the panel opens
 * below it, full width of its container.
 */

const SETS = {
  Maths: ['+', '−', '×', '÷', '=', '≠', '≈', '≤', '≥', '±', '√', '∛', '²', '³', '⁻¹', 'ⁿ', '^', '(', ')', 'π', '∞', '°', 'θ', '∫', 'Σ', 'Δ', '|', 'log', 'ln', 'sin', 'cos', 'tan', 'e', 'i'],
  Powers: ['×10^', '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁻', '⁺', '₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'],
  Greek: ['α', 'β', 'γ', 'δ', 'Δ', 'ε', 'η', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'Σ', 'τ', 'φ', 'ω', 'Ω'],
  Science: ['→', '⇌', '⁺', '⁻', '²⁺', '²⁻', '₂', '₃', '₄', '(aq)', '(s)', '(l)', '(g)', 'ΔH', '°C', 'μ', 'Ω', '·', '×10^', 'm s⁻¹', 'm s⁻²', 'mol dm⁻³'],
}

function defaultSet(subject = '') {
  if (/^(Chemistry|Biology|Physics|Environmental|Sports)/i.test(subject)) return 'Science'
  return 'Maths'
}

export default function SymbolKeys({ target, value = '', onChange, subject = '', disabled = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const [set, setSet] = useState(() => defaultSet(subject))

  const type = (sym) => {
    const el = target?.current
    const text = String(value ?? '')
    const start = el && typeof el.selectionStart === 'number' ? el.selectionStart : text.length
    const end = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : text.length
    // Functions arrive with their bracket, the cursor inside it.
    const fn = /^(log|ln|sin|cos|tan|√|∛)$/.test(sym)
    const insert = fn ? `${sym}(` + ')' : sym
    const caret = start + (fn ? insert.length - 1 : insert.length)
    onChange(text.slice(0, start) + insert + text.slice(end))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange?.(caret, caret)
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Hide the symbol keyboard' : 'Symbols: maths, powers, Greek and science'}
        title="Symbols"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40 ${className}`}
        style={{ borderColor: open ? 'var(--brand)' : 'var(--border-strong)', color: open ? 'var(--brand)' : 'var(--text-muted)', background: open ? 'var(--brand-tint)' : 'transparent' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
          <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 12.5h.01M18 12.5h.01M8.5 15.5h7" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="pop-enter order-last mt-2 w-full basis-full rounded-[14px] border p-2.5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }} role="group" aria-label="Symbols">
          <div className="mb-2 flex gap-1" role="tablist">
            {Object.keys(SETS).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={set === k}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSet(k)}
                className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
                style={set === k ? { background: 'var(--text)', color: 'var(--bg)' } : { color: 'var(--text-muted)' }}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SETS[set].map((sym) => (
              <button
                key={sym}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => type(sym)}
                aria-label={`Type ${sym}`}
                className="min-w-[2.5rem] rounded-[9px] border px-2 py-1.5 text-[15px] transition-colors hover:bg-[var(--surface-sunken)] active:scale-95"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', fontFamily: /^[a-z(]/i.test(sym) ? undefined : 'var(--font-sans)' }}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
