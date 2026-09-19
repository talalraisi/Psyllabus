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
 * Opens over the page, keeps its history, and remembers degrees or radians
 * between sessions — getting that wrong is a whole question lost, and being
 * asked every time is its own kind of wrong.
 */

const KEYS = [
  ['sin(', 'cos(', 'tan(', '^', '('],
  ['ln(', 'log(', 'sqrt(', '!', ')'],
  ['7', '8', '9', '÷', 'C'],
  ['4', '5', '6', '×', '←'],
  ['1', '2', '3', '-', 'pi'],
  ['0', '.', 'ans', '+', '='],
]

function Plot({ expression, degrees }) {
  const canvasRef = useRef(null)
  const [span, setSpan] = useState(10) // x from -span to +span

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

    // Grid
    ctx.strokeStyle = faint
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const px = (width / 4) * i
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
    ctx.lineWidth = 1.75
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

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="h-[190px] w-full rounded-[var(--r-md)] border"
        style={{ borderColor: 'var(--border)' }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          x from −{span} to {span}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setSpan((s) => Math.max(1, s / 2))}
            className="btn btn-quiet control-sm"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setSpan((s) => Math.min(1000, s * 2))}
            className="btn btn-quiet control-sm"
            aria-label="Zoom out"
          >
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

  // Live answer as you type, so simple sums need no Enter at all. Derived
  // during render rather than stored: the answer is a function of what is in
  // the box, and keeping a copy of it in state is how the two drift apart.
  const { result, error } = useMemo(() => {
    if (!input.trim()) return { result: '', error: '' }
    try {
      return { result: formatResult(evaluate(input, { degrees, ans })), error: '' }
    } catch (e) {
      return { result: '', error: e instanceof CalcError ? e.message : 'That does not work' }
    }
  }, [input, degrees, ans])

  const commit = useCallback(() => {
    if (!input.trim() || !result) return
    setHistory((h) => [{ expression: input, value: result }, ...h].slice(0, 12))
    setAns(parseFloat(result))
    setInput('')
  }, [input, result])

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

  const press = (key) => {
    if (key === '=') return commit()
    if (key === 'C') {
      setInput('')
      return
    }
    if (key === '←') {
      setInput((v) => v.slice(0, -1))
      return
    }
    setInput((v) => v + key)
    inputRef.current?.focus()
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-[330px] max-w-[calc(100vw-2rem)] rounded-[14px] border shadow-xl"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      role="dialog"
      aria-label="Calculator"
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => setMode('calc')}
          className={mode === 'calc' ? 'btn btn-solid control-sm' : 'btn btn-quiet control-sm'}
        >
          Calculate
        </button>
        <button
          onClick={() => setMode('graph')}
          className={mode === 'graph' ? 'btn btn-solid control-sm' : 'btn btn-quiet control-sm'}
        >
          Graph
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setDegrees((d) => !d)}
          className="btn btn-quiet control-sm tabular-nums"
          title="Switch between degrees and radians"
        >
          {degrees ? 'DEG' : 'RAD'}
        </button>
        <button onClick={onClose} className="btn btn-quiet control-sm" aria-label="Close calculator">
          ✕
        </button>
      </div>

      <div className="p-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
          placeholder={mode === 'graph' ? 'y = x^2 - 3' : '2 + 3 × 4'}
          className="input w-full text-[15px]"
          spellCheck={false}
          autoComplete="off"
        />

        <div className="mt-2 flex min-h-[22px] items-baseline justify-between gap-3">
          {/* In graph mode the curve is the answer; f(0) printed above it is
              just a number nobody asked for. */}
          <span className="text-[17px] font-medium tabular-nums">{mode === 'calc' ? result : ''}</span>
          {error && input.trim() && (
            <span className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              {error}
            </span>
          )}
        </div>

        {mode === 'graph' ? (
          <div className="mt-2">
            {result || !error ? (
              <Plot expression={input || 'x'} degrees={degrees} />
            ) : (
              <p className="py-10 text-center text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                Type a function of x.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {KEYS.flat().map((key) => (
                <button
                  key={key}
                  onClick={() => press(key)}
                  className="rounded-[var(--r-md)] border py-2 text-[13px] transition-colors hover:bg-[var(--surface-sunken)]"
                  style={{
                    borderColor: key === '=' ? 'var(--brand)' : 'var(--border)',
                    background: key === '=' ? 'var(--brand)' : 'transparent',
                    color: key === '=' ? '#fff' : 'var(--text)',
                  }}
                >
                  {key.replace('(', '')}
                </button>
              ))}
            </div>

            {history.length > 0 && (
              <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                {history.slice(0, 3).map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(h.expression)}
                    className="flex w-full items-baseline justify-between gap-3 py-1 text-left"
                  >
                    <span className="truncate text-[12px]" style={{ color: 'var(--text-faint)' }}>
                      {h.expression}
                    </span>
                    <span className="shrink-0 text-[12.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {h.value}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
