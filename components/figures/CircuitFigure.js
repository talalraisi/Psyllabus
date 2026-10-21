'use client'

/**
 * A circuit drawn from a description of it.
 *
 * The question says what is in the circuit (a supply, components in series,
 * up to three parallel branches) and this draws it with the IB symbols. The
 * layout is fixed, so labels land where the code puts them: an AI-drawn
 * diagram in testing put a value a whole unit away from its line, and a
 * student reading it would have been marked wrong for reading it correctly.
 *
 *   supply on the left, series components along the top, parallel branches
 *   on the right running top to bottom, wires closing the loop.
 */

const W = 560
const H = 300
const TOP = 60
const BOTTOM = 240
const LEFT = 60
const MID = (TOP + BOTTOM) / 2
const BG = 'var(--surface-sunken)'
const INK = 'var(--text)'

/** One component, drawn horizontally around (0, 0); the caller rotates it. */
function Glyph({ type }) {
  const common = { stroke: INK, strokeWidth: 2, fill: BG }
  switch (type) {
    case 'lamp':
      return (
        <g>
          <circle r="13" {...common} />
          <path d="M-9 -9 L9 9 M9 -9 L-9 9" stroke={INK} strokeWidth="2" />
        </g>
      )
    case 'ammeter':
    case 'voltmeter':
      return (
        <g>
          <circle r="13" {...common} />
          <text y="5" textAnchor="middle" fontSize="14" fontWeight="600" fill={INK}>
            {type === 'ammeter' ? 'A' : 'V'}
          </text>
        </g>
      )
    case 'switch':
      return (
        <g>
          <rect x="-22" y="-8" width="44" height="16" fill={BG} stroke="none" />
          <circle cx="-16" r="3" fill={INK} />
          <circle cx="16" r="3" fill={INK} />
          <line x1="-16" y1="0" x2="14" y2="-14" stroke={INK} strokeWidth="2" />
        </g>
      )
    case 'diode':
      return (
        <g>
          <rect x="-14" y="-12" width="28" height="24" fill={BG} stroke="none" />
          <path d="M-10 -11 L-10 11 L10 0 Z" {...common} />
          <line x1="10" y1="-11" x2="10" y2="11" stroke={INK} strokeWidth="2" />
          <line x1="-22" y1="0" x2="-10" y2="0" stroke={INK} strokeWidth="2" />
          <line x1="10" y1="0" x2="22" y2="0" stroke={INK} strokeWidth="2" />
        </g>
      )
    case 'cell':
      return (
        <g>
          <rect x="-8" y="-16" width="16" height="32" fill={BG} stroke="none" />
          <line x1="-4" y1="-16" x2="-4" y2="16" stroke={INK} strokeWidth="2" />
          <line x1="4" y1="-8" x2="4" y2="8" stroke={INK} strokeWidth="4" />
        </g>
      )
    default: {
      // resistor and its relatives share the rectangle
      return (
        <g>
          <rect x="-20" y="-7" width="40" height="14" {...common} />
          {type === 'variable_resistor' && (
            <g stroke={INK} strokeWidth="1.6">
              <line x1="-18" y1="12" x2="16" y2="-12" />
              <path d="M16 -12 l-7 1 M16 -12 l-2 7" />
            </g>
          )}
          {type === 'thermistor' && (
            <polyline points="-22,14 -14,14 14,-14" fill="none" stroke={INK} strokeWidth="1.6" />
          )}
          {type === 'ldr' && (
            <g stroke={INK} strokeWidth="1.6">
              <line x1="-16" y1="-24" x2="-6" y2="-12" />
              <path d="M-6 -12 l-6 -1 M-6 -12 l-1 -6" />
              <line x1="-2" y1="-26" x2="8" y2="-14" />
              <path d="M8 -14 l-6 -1 M8 -14 l-1 -6" />
            </g>
          )}
        </g>
      )
    }
  }
}

function Part({ c, x, y, vertical }) {
  return (
    <g>
      <g transform={`translate(${x} ${y})${vertical ? ' rotate(90)' : ''}`}>
        <Glyph type={c.type} />
      </g>
      {c.label && (
        <text
          x={vertical ? x - 22 : x}
          y={vertical ? y + 5 : y - 22}
          textAnchor={vertical ? 'end' : 'middle'}
          fontSize="15.5"
          fill={INK}
        >
          {c.label}
        </text>
      )}
    </g>
  )
}

export default function CircuitFigure({ figure }) {
  const series = figure.series || []
  const branches = (figure.parallel || []).filter((b) => b?.length).slice(0, 3)
  const hasParallel = branches.length >= 2
  const RIGHT = hasParallel ? 340 + (branches.length - 1) * 100 : 500
  const seriesEnd = hasParallel ? 300 : RIGHT - 40
  const step = (seriesEnd - (LEFT + 40)) / Math.max(1, series.length)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[560px]" role="img" aria-label={figure.alt || 'Circuit diagram'}>
      <g stroke={INK} strokeWidth="2" fill="none">
        <polyline points={`${RIGHT},${TOP} ${LEFT},${TOP} ${LEFT},${BOTTOM} ${RIGHT},${BOTTOM}`} />
        {hasParallel ? (
          branches.map((_, i) => <line key={i} x1={340 + i * 100} y1={TOP} x2={340 + i * 100} y2={BOTTOM} />)
        ) : (
          <line x1={RIGHT} y1={TOP} x2={RIGHT} y2={BOTTOM} />
        )}
      </g>

      {/* The supply, with its label clear of the wire. */}
      <g transform={`translate(${LEFT} ${MID}) rotate(90)`}>
        <Glyph type="cell" />
      </g>
      <text x={LEFT + 24} y={MID + 4} fontSize="15.5" fill={INK}>
        {figure.source}
      </text>

      {series.map((c, i) => (
        <Part key={`s${i}`} c={c} x={LEFT + 40 + step * (i + 0.5)} y={TOP} />
      ))}

      {hasParallel &&
        branches.map((branch, i) => {
          const x = 340 + i * 100
          const gap = (BOTTOM - TOP) / (branch.length + 1)
          return branch.slice(0, 3).map((c, k) => <Part key={`p${i}-${k}`} c={c} x={x} y={TOP + gap * (k + 1)} vertical />)
        })}

      {hasParallel && (
        <g fill={INK}>
          <circle cx="340" cy={TOP} r="3.5" />
          <circle cx="340" cy={BOTTOM} r="3.5" />
        </g>
      )}
    </svg>
  )
}
