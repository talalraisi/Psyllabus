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
 * One column, on the right, because the headline is left-aligned and that is
 * the side it leaves free. It flanked both sides while the hero was centred;
 * if it is ever centred again this wants splitting in two and raising to xl,
 * since 18%-wide flanks and a 768px headline collide below about 1280px.
 *
 * Hidden below lg, where there is no leftover space and a phone has better
 * uses for the battery, and off under prefers-reduced-motion.
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
  { x: 40, y: 26, size: 168, pct: 0.68, w: 1.5, path: 'b', s: 46, d: 0 },
  { x: 48, y: 58, size: 104, pct: 0.42, w: 1.5, path: 'c', s: 52, d: -18 },
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

export default function Drift() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] select-none lg:block"
    >
      {RINGS.map((r, i) => (
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

      {CELLS.map((c, i) => (
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
