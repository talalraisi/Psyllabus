'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { evaluate, formatResult, CalcError } from '@/lib/calc'

/**
 * The calculator, on the same screen as the question.
 *
 * Two modes, because students use two tools: a scientific calculator for
 * working a number out, and a grapher for seeing what a function does. Both
 * are here rather than in a browser tab, which is where the distraction lives.
 *
 * It behaves like the one on their desk: a 2nd key for the inverses, ×10ˣ
 * for standard form, % as percent, and an operator straight after = carries
 * on from the answer. Degrees or radians is remembered between sessions —
 * getting that wrong is a whole question lost.
 */

/**
 * The keypad, laid out like a scientific calculator: functions on top, then
 * DEL and AC beside the digits, operators down the right, = in the corner.
 * `shift` is what the key becomes under 2nd. The ×10ˣ slot is the x key on
 * the Graph tab, the only place a variable means anything.
 */
const FN_ROWS = [
  [
    { label: '2nd', action: 'shift', tone: 'fn' },
    { label: 'sin', insert: 'sin(', shift: { label: 'sin⁻¹', insert: 'sin⁻¹(' }, tone: 'fn' },
    { label: 'cos', insert: 'cos(', shift: { label: 'cos⁻¹', insert: 'cos⁻¹(' }, tone: 'fn' },
    { label: 'tan', insert: 'tan(', shift: { label: 'tan⁻¹', insert: 'tan⁻¹(' }, tone: 'fn' },
    { label: 'π', insert: 'π', tone: 'fn' },
  ],
  [
    { label: 'ln', insert: 'ln(', shift: { label: 'eˣ', insert: 'e^(' }, tone: 'fn' },
    { label: 'log', insert: 'log(', shift: { label: '10ˣ', insert: '10^(' }, tone: 'fn' },
    { label: '√', insert: '√(', shift: { label: '∛', insert: '∛(' }, tone: 'fn' },
    { label: 'x²', insert: '²', shift: { label: 'x³', insert: '³' }, tone: 'fn', continues: true },
    { label: 'xʸ', insert: '^', tone: 'fn', continues: true },
  ],
  [
    { label: '(', insert: '(', tone: 'fn' },
    { label: ')', insert: ')', tone: 'fn' },
    { label: 'x!', insert: '!', tone: 'fn', continues: true },
    { label: '%', insert: '%', tone: 'fn', continues: true },
    { label: 'e', insert: 'e', tone: 'fn' },
  ],
]

const PAD_ROWS = [
  [
    { label: '7', insert: '7' },
    { label: '8', insert: '8' },
    { label: '9', insert: '9' },
    { label: 'DEL', action: 'back', tone: 'clear' },
    { label: 'AC', action: 'clear', tone: 'clear' },
  ],
  [
    { label: '4', insert: '4' },
    { label: '5', insert: '5' },
    { label: '6', insert: '6' },
    { label: '×', insert: '×', tone: 'op', continues: true },
    { label: '÷', insert: '÷', tone: 'op', continues: true },
  ],
  [
    { label: '1', insert: '1' },
    { label: '2', insert: '2' },
    { label: '3', insert: '3' },
    { label: '+', insert: '+', tone: 'op', continues: true },
    { label: '−', insert: '−', tone: 'op', continues: true },
  ],
  [
    { label: '0', insert: '0' },
    { label: '.', insert: '.' },
    { label: '×10ˣ', insert: '×10^', tone: 'fn', graph: { label: 'x', insert: 'x', tone: 'var' } },
    { label: 'Ans', insert: 'Ans', tone: 'fn' },
    { label: '=', action: 'equals', tone: 'equals' },
  ],
]

/** 6.63e-34 the way it is written on paper: 6.63 × 10⁻³⁴. */
function Scientific({ value }) {
  const m = String(value).match(/^(-?[\d.]+)e([-+]?\d+)$/)
  if (!m) return value
  return (
    <>
      {m[1]}
      <span className="mx-1 font-normal opacity-70">×</span>10
      <sup className="ml-0.5 text-[0.55em]">{m[2].replace('+', '')}</sup>
    </>
  )
}

/** Typed * / - read as × ÷ −, so the screen looks the same however it was entered. */
const tidy = (v) => v.replace(/\*/g, '×').replace(/\//g, '÷')

const KEY_STYLE = {
  digit: { background: 'var(--surface-sunken)', color: 'var(--text)', fontSize: 17 },
  fn: { background: 'transparent', color: 'var(--text-body)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', fontSize: 13 },
  op: { background: 'color-mix(in srgb, var(--brand) 13%, var(--surface))', color: 'var(--brand)', fontSize: 19 },
  clear: { background: 'color-mix(in srgb, var(--status-weak) 12%, var(--surface))', color: 'var(--status-weak)', fontSize: 12.5, fontWeight: 600 },
  equals: { background: 'var(--brand)', color: '#fff', fontSize: 20 },
  var: { background: 'color-mix(in srgb, var(--brand) 22%, var(--surface))', color: 'var(--brand)', fontSize: 17, fontStyle: 'italic' },
}

function Plot({ expression, degrees }) {
  const canvasRef = useRef(null)
  const view = useRef(null)
  const [span, setSpan] = useState(10) // x from -span to +span
  const [trace, setTrace] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    view.current = null

    const style = getComputedStyle(canvas)
    const axis = style.getPropertyValue('--border-strong').trim() || '#999'
    const line = style.getPropertyValue('--brand').trim() || '#4f7c68'
    const faint = style.getPropertyValue('--border').trim() || '#ddd'

    // Sample first: the y range is whatever the function actually does over
    // the window, so a parabola and a sine wave both arrive framed.
    const samples = []
    for (let px = 0; px <= width; px++) {
      const x = (px / width) * 2 * span - span
      let y = null
      try {
        const value = evaluate(expression, { degrees, x })
        if (Number.isFinite(value)) y = value
      } catch {
        y = null
      }
      samples.push([px, y])
    }
    const finite = samples.map(([, y]) => y).filter((y) => y != null)
    if (!finite.length) return
    let lo = Math.min(...finite)
    let hi = Math.max(...finite)
    if (hi - lo < 1e-9) {
      lo -= 1
      hi += 1
    }
    const pad = (hi - lo) * 0.1
    lo -= pad
    hi += pad
    const toPy = (y) => height - ((y - lo) / (hi - lo)) * height
    view.current = { span, width, height, toPy }

    // Grid
    ctx.strokeStyle = faint
    ctx.lineWidth = 1
    for (let i = 1; i < 8; i++) {
      const px = (width / 8) * i
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, height)
      ctx.stroke()
    }

    // Axes
    ctx.strokeStyle = axis
    const zeroY = toPy(0)
    if (zeroY > 0 && zeroY < height) {
      ctx.beginPath()
      ctx.moveTo(0, zeroY)
      ctx.lineTo(width, zeroY)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()

    // The curve, broken wherever the function is undefined or jumps a screen
    // height — otherwise tan(x) draws vertical lines it does not have.
    ctx.strokeStyle = line
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    let drawing = false
    let lastPy = null
    for (const [px, y] of samples) {
      if (y == null) {
        drawing = false
        lastPy = null
        continue
      }
      const py = toPy(y)
      if (!drawing || (lastPy != null && Math.abs(py - lastPy) > height)) {
        ctx.moveTo(px, py)
        drawing = true
      } else {
        ctx.lineTo(px, py)
      }
      lastPy = py
    }
    ctx.stroke()
  }, [expression, degrees, span])

  // Read a point off the curve under the pointer or finger.
  const traceAt = (e) => {
    const v = view.current
    if (!v) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = Math.max(0, Math.min(v.width, e.clientX - rect.left))
    const x = (px / v.width) * 2 * v.span - v.span
    let y = null
    try {
      const value = evaluate(expression, { degrees, x })
      if (Number.isFinite(value)) y = value
    } catch {
      y = null
    }
    const py = y == null ? null : v.toPy(y)
    setTrace({ px, py: py != null && py >= 0 && py <= v.height ? py : null, x, y })
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerMove={traceAt}
          onPointerDown={traceAt}
          onPointerLeave={() => setTrace(null)}
          className="h-[150px] w-full touch-none rounded-[12px]"
          style={{ background: 'var(--surface-sunken)' }}
        />
        {trace?.py != null && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-full w-px"
              style={{ left: trace.px, background: 'color-mix(in srgb, var(--brand) 35%, transparent)' }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: trace.px, top: trace.py, background: 'var(--surface)', borderColor: 'var(--brand)' }}
            />
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {trace ? (
            <>
              x = {formatResult(trace.x)}
              <span className="ml-3">y = {trace.y == null ? '—' : <Scientific value={formatResult(trace.y)} />}</span>
            </>
          ) : (
            `x from −${span} to ${span} · tap the curve to read it`
          )}
        </span>
        <div className="flex shrink-0 gap-1">
          <button onClick={() => setSpan((s) => Math.max(1, s / 2))} className="btn btn-quiet control-sm" aria-label="Zoom in">
            +
          </button>
          <button onClick={() => setSpan((s) => Math.min(1000, s * 2))} className="btn btn-quiet control-sm" aria-label="Zoom out">
            −
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Calculator({ open, onClose }) {
  const [mode, setMode] = useState('calc') // calc | graph
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [ans, setAns] = useState(0)
  const [last, setLast] = useState(null) // the sum = just closed, shown until the next one starts
  const [shift, setShift] = useState(false)
  // Read once, at first render, rather than set from an effect: the panel is
  // closed (and renders nothing) until someone opens it, so there is no
  // flash of the wrong mode to worry about.
  const [degrees, setDegrees] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = window.localStorage.getItem('psy:calc:degrees')
      return saved == null ? true : saved === '1'
    } catch {
      return true
    }
  })
  const inputRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem('psy:calc:degrees', degrees ? '1' : '0')
    } catch {
      /* nothing to do */
    }
  }, [degrees])

  // Live answer as you type, so simple sums need no = at all. Derived during
  // render: the answer is a function of what is in the box.
  const { result, error } = useMemo(() => {
    if (!input.trim()) return { result: '', error: '' }
    try {
      return { result: formatResult(evaluate(input, { degrees, ans })), error: '' }
    } catch (e) {
      return { result: '', error: e instanceof CalcError ? e.message : 'That does not work' }
    }
  }, [input, degrees, ans])

  const commit = useCallback(() => {
    if (mode !== 'calc' || !input.trim() || !result) return
    setHistory((h) => [{ expression: input, value: result }, ...h].slice(0, 12))
    setAns(evaluate(input, { degrees, ans }))
    setLast({ expression: input, value: result })
    setInput('')
  }, [mode, input, result, degrees, ans])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  /** Put text where the cursor is, not always at the end. */
  const insertAt = (text, { continues = false } = {}) => {
    const el = inputRef.current
    // Straight after =, an operator carries on from the answer, as on a
    // real calculator: = then × 2 means Ans × 2.
    const prefix = !input && last && continues ? 'Ans' : ''
    const start = el && document.activeElement === el ? el.selectionStart : input.length
    const end = el && document.activeElement === el ? el.selectionEnd : input.length
    const next = input.slice(0, start) + prefix + text + input.slice(end)
    const caret = start + prefix.length + text.length
    setInput(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  const press = (key) => {
    if (key.action === 'shift') return setShift((s) => !s)
    if (key.action === 'equals') return commit()
    if (key.action === 'clear') {
      setInput('')
      setLast(null)
      setShift(false)
      inputRef.current?.focus()
      return
    }
    if (key.action === 'back') {
      const el = inputRef.current
      const start = el && document.activeElement === el ? el.selectionStart : input.length
      const end = el && document.activeElement === el ? el.selectionEnd : input.length
      const from = start === end ? Math.max(0, start - 1) : start
      setInput(input.slice(0, from) + input.slice(end))
      requestAnimationFrame(() => {
        el?.focus()
        el?.setSelectionRange(from, from)
      })
      return
    }
    const k = shift && key.shift ? { ...key, ...key.shift } : key
    setShift(false)
    insertAt(k.insert, { continues: key.continues })
  }

  const keyFor = (key) => (mode === 'graph' && key.graph ? { ...key, ...key.graph } : key)

  const renderKey = (raw) => {
    const key = keyFor(raw)
    const shown = shift && key.shift ? key.shift.label : key.label
    const tone = key.tone || 'digit'
    const on = key.action === 'shift' && shift
    return (
      <button
        key={raw.label}
        type="button"
        onClick={() => press(key)}
        // Keep the cursor in the box on desktop.
        onMouseDown={(e) => e.preventDefault()}
        aria-pressed={key.action === 'shift' ? shift : undefined}
        className={`press flex ${mode === 'graph' ? 'h-9' : 'h-10'} items-center justify-center rounded-[11px] font-medium tabular-nums transition-[filter,transform] hover:brightness-[0.95] active:brightness-90`}
        style={{
          ...KEY_STYLE[tone],
          ...(on ? { background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)' } : null),
          ...(shift && key.shift ? { color: 'var(--brand)', borderColor: 'color-mix(in srgb, var(--brand) 45%, transparent)' } : null),
        }}
      >
        {shown}
      </button>
    )
  }

  const big = input ? (mode === 'calc' ? result : '') : last && mode === 'calc' ? last.value : mode === 'calc' ? '0' : ''

  return (
    <div
      className="pop-enter fixed bottom-[76px] right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[20px] border p-3 shadow-2xl"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', maxHeight: 'calc(100dvh - 96px)' }}
      role="dialog"
      aria-label="Calculator"
    >
      {/* Mode, angle unit, close. */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-[10px] p-0.5" style={{ background: 'var(--surface-sunken)' }}>
          {[
            ['calc', 'Calculate'],
            ['graph', 'Graph'],
          ].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className="rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors"
              style={mode === m ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.12)' } : { color: 'var(--text-muted)' }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setDegrees((d) => !d)}
          className="rounded-[8px] border px-2 py-1 text-[11px] font-semibold tracking-[0.06em] tabular-nums"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Switch between degrees and radians"
        >
          {degrees ? 'DEG' : 'RAD'}
        </button>
        <button type="button" onClick={onClose} className="btn btn-quiet control-sm" aria-label="Close calculator">
          ✕
        </button>
      </div>

      {/* The screen. */}
      <div className="rounded-[14px] px-3.5 pb-2.5 pt-2" style={{ background: 'var(--surface-sunken)' }}>
        <div className="flex h-5 items-center justify-between text-[10.5px] font-semibold tracking-[0.08em]" style={{ color: 'var(--text-faint)' }}>
          <span>{shift ? '2nd' : ''}</span>
        </div>
        <div className="flex items-baseline gap-2">
          {mode === 'graph' && (
            <span className="shrink-0 whitespace-nowrap text-[16px] italic" style={{ color: 'var(--text-muted)' }}>
              y =
            </span>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const raw = e.target.value
              const pos = e.target.selectionStart
              // Typing an operator straight after = carries on from the answer.
              const carry = !input && last && /^[+*/×÷^%!]/.test(raw) ? 'Ans' : ''
              const next = carry + tidy(raw)
              setInput(next)
              if (next !== raw) requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos + carry.length, pos + carry.length))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === '=') {
                e.preventDefault()
                commit()
              }
            }}
            // The keypad is the keyboard; on a phone the system one would
            // cover it. A physical keyboard still types.
            inputMode="none"
            placeholder={mode === 'graph' ? 'x^2 − 3' : last ? `${last.expression} =` : ''}
            aria-label={mode === 'graph' ? 'Function of x' : 'Expression'}
            className={`w-full min-w-0 bg-transparent text-[17px] tabular-nums outline-none placeholder:text-[var(--text-faint)] ${mode === 'calc' ? 'text-right' : ''}`}
            style={{ color: 'var(--text-body)' }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {mode === 'calc' && (
          <div className="mt-0.5 flex min-h-[40px] items-end justify-between gap-3">
            <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              {error && input.trim() ? error : ''}
            </span>
            <span
              className="truncate text-right text-[30px] font-semibold leading-tight tracking-[-0.02em] tabular-nums transition-colors"
              style={{ color: input ? 'var(--text-muted)' : 'var(--text)' }}
              aria-live="polite"
            >
              <Scientific value={big} />
            </span>
          </div>
        )}
        {mode === 'graph' && error && input.trim() && (
          <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            {error}
          </p>
        )}
      </div>

      {mode === 'graph' && (
        <div className="mt-3">
          {!error || !input.trim() ? (
            <Plot expression={input || 'x'} degrees={degrees} />
          ) : (
            <p className="flex h-[150px] items-center justify-center rounded-[12px] text-[12.5px]" style={{ background: 'var(--surface-sunken)', color: 'var(--text-faint)' }}>
              Type a function of x.
            </p>
          )}
        </div>
      )}

      {/* Keys. */}
      <div className="mt-3 grid grid-cols-5 gap-1.5">{FN_ROWS.flat().map(renderKey)}</div>
      <div className="mt-2.5 grid grid-cols-5 gap-1.5">{PAD_ROWS.flat().map(renderKey)}</div>

      {mode === 'calc' && history.length > 0 && (
        <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
          {history.filter((h) => /^-?[\d.]+(e[-+]?\d+)?$/.test(h.value)).slice(0, 3).map((h, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAt(String(h.value).replace(/^(-?[\d.]+)e([-+]?\d+)$/, '($1×10^$2)'))}
              title="Use this answer"
              className="flex w-full items-baseline justify-between gap-3 rounded-[6px] px-1 py-1 text-left hover:bg-[var(--surface-sunken)]"
            >
              <span className="truncate text-[12px]" style={{ color: 'var(--text-faint)' }}>
                {h.expression}
              </span>
              <span className="shrink-0 text-[12.5px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
                <Scientific value={h.value} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
