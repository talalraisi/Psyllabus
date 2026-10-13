'use client'

/**
 * The product's own shapes, adrift in the space beside the headline.
 *
 * The hero fills the screen now and the right of it is empty. What goes there
 * has to do two things at once: stop the space reading as unfinished, and not
 * become the thing you look at. So it is the vocabulary the rest of the
 * product is drawn in — the cell a subtopic is, the ring a percentage sits in
 * — at a size and an opacity where you register that the page is alive rather
 * than registering the decoration.
 *
 * Three rules hold it to that:
 *
 * Green-dominant. The first pass used the whole status palette and came out
 * looking like confetti; worse, a red cell floating past the headline reads as
 * an alarm about nothing. Proficient — the green at hue 158, the one nearest
 * the brand — takes the largest shapes, mastered's violet sits under it as the
 * accent, one developing carries the warmth, and the colours that mean trouble
 * stay where trouble is. Note the ordering: mastered is the higher state but
 * the quieter colour here, because this is the hero, not the heatmap.
 *
 * The rings are arcs, not circles. A hollow circle is a shape; an arc on a
 * faint track is the progress ring this product draws everywhere, and it says
 * something while costing the same.
 *
 * Nothing glows. Two blooms lived in this space before and were disliked both
 * times. Ambient light reads as decoration; ambient movement reads as depth.
 *
 * It flanks the headline on both sides, because the hero is centred now. That
 * is also why it starts at xl rather than lg: the columns are 18% of the
 * viewport each, and below about 1280px the headline's own 768px would reach
 * into them. Narrow margins with nothing in them beat shapes sitting on top of
 * the words. Off under prefers-reduced-motion, and absent on phones, which
 * have better uses for the battery.
 */

/* Loosely clustered rather than evenly spread — scatter looks accidental,
   and a constellation looks placed. Percentages of the right-hand column. */
const CELLS = [
  { x: 18, y: 17, size: 26, tone: 'proficient', o: 0.3, path: 'a', s: 34, d: 0 },
  { x: 46, y: 8, size: 13, tone: 'mastered', o: 0.3, path: 'c', s: 29, d: -6 },
  { x: 6, y: 38, size: 15, tone: 'proficient', o: 0.24, path: 'b', s: 38, d: -14 },
  { x: 64, y: 43, size: 11, tone: 'developing', o: 0.3, path: 'c', s: 31, d: -3 },
  { x: 29, y: 62, size: 22, tone: 'proficient', o: 0.22, path: 'a', s: 41, d: -20 },
  { x: 59, y: 77, size: 14, tone: 'mastered', o: 0.26, path: 'b', s: 33, d: -9 },
  { x: 13, y: 83, size: 10, tone: 'proficient', o: 0.28, path: 'c', s: 36, d: -17 },
]

/* pct is how far round the arc goes — a ring that is part-done, like every
   ring in the app. r is chosen so the dash maths stays readable. */
const RINGS = [
  { x: 14, y: 24, size: 124, pct: 0.68, w: 1.5, path: 'b', s: 46, d: 0 },
  { x: 30, y: 60, size: 92, pct: 0.42, w: 1.5, path: 'c', s: 52, d: -18 },
]

function Ring({ size, pct, w }) {
  const r = 50 - w
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r={r} stroke="var(--border-strong)" strokeWidth={w} opacity="0.55" />
      <circle
        cx="50"
        cy="50"
        r={r}
        stroke="var(--brand)"
        strokeWidth={w}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        opacity="0.4"
        transform="rotate(-90 50 50)"
      />
    </svg>
  )
}

function Column({ cells, rings, className }) {
  return (
    <div className={`pointer-events-none absolute inset-y-0 w-[18%] select-none ${className}`}>
      {rings.map((r, i) => (
        <span
          key={`r${i}`}
          data-drift=""
          className="absolute"
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            animation: `drift-${r.path} ${r.s}s ease-in-out ${r.d}s infinite`,
          }}
        >
          <Ring size={r.size} pct={r.pct} w={r.w} />
        </span>
      ))}

      {cells.map((c, i) => (
        <span
          key={`c${i}`}
          data-drift=""
          className="absolute rounded-[5px]"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            width: c.size,
            height: c.size,
            background: `var(--status-${c.tone})`,
            opacity: c.o,
            animation: `drift-${c.path} ${c.s}s ease-in-out ${c.d}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

export default function Drift() {
  /* Split rather than mirrored. A mirror reads as a pattern, and the moment
     the eye catches the symmetry it starts looking at the decoration. */
  const half = Math.ceil(CELLS.length / 2)
  return (
    <div aria-hidden="true" className="absolute inset-0 hidden xl:block">
      <Column className="left-0" cells={CELLS.slice(0, half)} rings={RINGS.slice(0, 1)} />
      <Column className="right-0" cells={CELLS.slice(half)} rings={RINGS.slice(1)} />
    </div>
  )
}
