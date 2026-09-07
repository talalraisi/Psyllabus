/**
 * Diagrams, graphs and data tables on a question.
 *
 * The figure is stored as data, not as an image or as SVG the model wrote, and
 * this component draws it. That is the whole design decision and it buys four
 * things a generated image could not: it follows light and dark mode, it
 * scales on a phone, it can be read aloud by a screen reader, and it can be
 * checked programmatically before it ships. A model asked for raw SVG produces
 * something that looks plausible in the response and renders as a tangle, and
 * nobody finds out until a student is sitting in front of it.
 *
 * Four kinds, chosen because they cover most of what an exam actually shows:
 *
 *   plot     a function or a physical relationship, drawn from points
 *   bar      categories against values, which is most of economics
 *   scatter  measured data, optionally with a line through it
 *   table    the data-based question, where the numbers are the figure
 *
 * Anything else renders as nothing rather than as a guess.
 */

import { figureIsUsable } from '@/lib/figures'

export { figureIsUsable }

const PAD = { top: 12, right: 14, bottom: 34, left: 44 }
const W = 420
const H = 260

function scales(points, xLabel, yLabel) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  // Include zero on the value axis so a bar chart cannot exaggerate a small
  // difference into a big one, which is the classic misleading chart.
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(0, ...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    x: (v) => PAD.left + ((v - xMin) / xSpan) * (W - PAD.left - PAD.right),
    y: (v) => H - PAD.bottom - ((v - yMin) / ySpan) * (H - PAD.top - PAD.bottom),
    xLabel,
    yLabel,
  }
}

function Axes({ s }) {
  const ticks = (min, max) => [min, min + (max - min) / 2, max]
  return (
    <g>
      <line
        x1={PAD.left}
        y1={H - PAD.bottom}
        x2={W - PAD.right}
        y2={H - PAD.bottom}
        stroke="var(--border-strong)"
      />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="var(--border-strong)" />

      {ticks(s.xMin, s.xMax).map((v) => (
        <text
          key={`x${v}`}
          x={s.x(v)}
          y={H - PAD.bottom + 14}
          textAnchor="middle"
          fill="var(--text-faint)"
          fontSize="10"
        >
          {Number(v.toFixed(2))}
        </text>
      ))}
      {ticks(s.yMin, s.yMax).map((v) => (
        <text
          key={`y${v}`}
          x={PAD.left - 6}
          y={s.y(v) + 3}
          textAnchor="end"
          fill="var(--text-faint)"
          fontSize="10"
        >
          {Number(v.toFixed(2))}
        </text>
      ))}

      {s.xLabel && (
        <text x={(W + PAD.left) / 2} y={H - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
          {s.xLabel}
        </text>
      )}
      {s.yLabel && (
        <text
          x={-(H - PAD.bottom + PAD.top) / 2}
          y={12}
          transform="rotate(-90)"
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="11"
        >
          {s.yLabel}
        </text>
      )}
    </g>
  )
}

function Plot({ figure }) {
  const series = figure.series?.length ? figure.series : [{ points: figure.points || [] }]
  const all = series.flatMap((s) => s.points || [])
  if (all.length < 2) return null
  const s = scales(all, figure.x_label, figure.y_label)
  const colours = ['var(--brand)', 'var(--status-fading)', 'var(--heat-extreme)']

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={figure.alt || 'Graph'}>
      <Axes s={s} />
      {series.map((line, i) => (
        <polyline
          key={i}
          fill="none"
          stroke={colours[i % colours.length]}
          strokeWidth="2"
          points={(line.points || []).map((p) => `${s.x(p.x)},${s.y(p.y)}`).join(' ')}
        />
      ))}
      {series.length > 1 &&
        series.map((line, i) =>
          line.label ? (
            <text
              key={`l${i}`}
              x={W - PAD.right}
              y={PAD.top + 12 + i * 14}
              textAnchor="end"
              fill={colours[i % colours.length]}
              fontSize="11"
            >
              {line.label}
            </text>
          ) : null
        )}
    </svg>
  )
}

function Scatter({ figure }) {
  const points = figure.points || []
  if (points.length < 2) return null
  const s = scales(points, figure.x_label, figure.y_label)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={figure.alt || 'Scatter plot'}>
      <Axes s={s} />
      {figure.fit_line && (
        <line
          x1={s.x(s.xMin)}
          y1={s.y(figure.fit_line.intercept + figure.fit_line.slope * s.xMin)}
          x2={s.x(s.xMax)}
          y2={s.y(figure.fit_line.intercept + figure.fit_line.slope * s.xMax)}
          stroke="var(--text-faint)"
          strokeDasharray="4 3"
        />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={s.x(p.x)} cy={s.y(p.y)} r="3.5" fill="var(--brand)" />
      ))}
    </svg>
  )
}

function Bars({ figure }) {
  const bars = figure.bars || []
  if (!bars.length) return null
  const max = Math.max(...bars.map((b) => b.value), 0)
  const span = max || 1
  const slot = (W - PAD.left - PAD.right) / bars.length
  const width = Math.min(46, slot * 0.6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={figure.alt || 'Bar chart'}>
      <line
        x1={PAD.left}
        y1={H - PAD.bottom}
        x2={W - PAD.right}
        y2={H - PAD.bottom}
        stroke="var(--border-strong)"
      />
      {bars.map((b, i) => {
        const h = (b.value / span) * (H - PAD.top - PAD.bottom)
        const x = PAD.left + slot * i + (slot - width) / 2
        return (
          <g key={i}>
            <rect x={x} y={H - PAD.bottom - h} width={width} height={h} fill="var(--brand)" rx="2" />
            <text
              x={x + width / 2}
              y={H - PAD.bottom - h - 5}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="10"
            >
              {b.value}
            </text>
            <text
              x={x + width / 2}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fill="var(--text-faint)"
              fontSize="10"
            >
              {b.label}
            </text>
          </g>
        )
      })}
      {figure.y_label && (
        <text
          x={-(H - PAD.bottom + PAD.top) / 2}
          y={12}
          transform="rotate(-90)"
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="11"
        >
          {figure.y_label}
        </text>
      )}
    </svg>
  )
}

function Table({ figure }) {
  const { columns = [], rows = [] } = figure
  if (!columns.length || !rows.length) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c}
                className="border-b border-[var(--border-strong)] px-3 py-2 text-left font-semibold text-[var(--text)]"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="border-b border-[var(--border)] px-3 py-2 tabular-nums text-[var(--text-body)]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const KINDS = { plot: Plot, scatter: Scatter, bar: Bars, table: Table }

export default function QuestionFigure({ figure }) {
  // The same guard the generator uses, so a figure that would render as an
  // empty box or a single lonely bar renders as nothing instead. The generator
  // already drops these, but rows written before it did, or by hand, reach
  // here too, and the student is the one who sees the difference.
  if (!figureIsUsable(figure)) return null
  const Render = KINDS[figure.kind]
  if (!Render) return null

  const body = <Render figure={figure} />
  if (!body) return null

  return (
    <figure className="mb-5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
      {body}
      {figure.caption && (
        <figcaption className="t-caption mt-2 text-center">{figure.caption}</figcaption>
      )}
    </figure>
  )
}
