/**
 * One small picture per step of "How it works".
 *
 * That section was three cards of pure prose, which is the one place on this
 * page where a reader has to take a sentence's word for it. Each step already
 * describes something the app draws — a map, a quiz, an ordered plan — so the
 * picture is that thing at a size where it reads in a glance and does not try
 * to be the real screen.
 *
 * Deliberately a server component. The lookup-table version of this idea has
 * burned this page once already: a label-to-graphic map exported from a
 * 'use client' module crosses the boundary as an opaque reference, so indexing
 * it from a server component rendered eight holes. A component takes the key
 * as a prop instead, and with no client JS here the boundary never comes up.
 * The animation is the existing .cell class, which prefers-reduced-motion
 * already switches off.
 */

const SW = 1.4

/** Step 01 — three topics, each opened out into its subtopics. */
function MapGraphic() {
  const rows = [
    { y: 8, n: 9, lit: [0, 3] },
    { y: 32, n: 7, lit: [1] },
    { y: 56, n: 8, lit: [2, 6] },
  ]
  const tones = ['proficient', 'mastered', 'developing']
  return (
    <>
      {rows.map((r, ri) => (
        <g key={r.y}>
          {/* the topic's name, as a rule rather than as lettering nobody reads */}
          <rect x="0" y={r.y} width="26" height="2.5" rx="1.25" fill="var(--border-strong)" />
          {Array.from({ length: r.n }, (_, i) => (
            <rect
              key={i}
              className="cell"
              x={34 + i * 14}
              y={r.y - 4}
              width="10"
              height="10"
              rx="2.5"
              fill={r.lit.includes(i) ? `var(--status-${tones[ri]})` : 'var(--border)'}
              style={{ animationDelay: `${(ri * 9 + i) * 26}ms` }}
            />
          ))}
        </g>
      ))}
    </>
  )
}

/** Step 02 — three options, one answered, and the cell that answer moved. */
function QuizGraphic() {
  return (
    <>
      {[6, 26, 46].map((y, i) => (
        <rect
          key={y}
          x="0"
          y={y}
          width={i === 1 ? 104 : 88}
          height="13"
          rx="6.5"
          fill="none"
          stroke={i === 1 ? 'var(--status-proficient)' : 'var(--border)'}
          strokeWidth={SW}
        />
      ))}
      {/* the tick sits in the answered option */}
      <path
        d="M90 32.5l3.2 3.4 6-6.6"
        stroke="var(--status-proficient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* and the subtopic it belongs to takes the colour */}
      <path d="M116 32.5h12" stroke="var(--border-strong)" strokeWidth={SW} strokeDasharray="3 3" />
      <rect
        className="cell"
        x="134"
        y="25"
        width="15"
        height="15"
        rx="3.5"
        fill="var(--status-proficient)"
        style={{ animationDelay: '420ms' }}
      />
    </>
  )
}

/** Step 03 — the plan, in the order it puts things. */
function PlanGraphic() {
  const rows = [
    { tone: 'weak', w: 118 },
    { tone: 'fading', w: 96, dashed: true },
    { tone: 'developing', w: 74 },
    { tone: 'proficient', w: 52 },
  ]
  return (
    <>
      {rows.map((r, i) => {
        const y = 6 + i * 18
        return (
          <g key={r.tone}>
            <rect x="0" y={y} width="3" height="12" rx="1.5" fill={`var(--status-${r.tone})`} />
            <rect
              className="cell"
              x="9"
              y={y}
              width={r.w}
              height="12"
              rx="3"
              fill="var(--border)"
              style={{ animationDelay: `${i * 80}ms`, transformOrigin: 'left' }}
            />
            {r.dashed && (
              <rect
                x="9"
                y={y}
                width={r.w}
                height="12"
                rx="3"
                fill="none"
                stroke="var(--status-fading)"
                strokeWidth={SW}
                strokeDasharray="4 3"
                opacity="0.7"
              />
            )}
          </g>
        )
      })}
      {/* what the ordering is: the ones you are worst at, first */}
      <path
        d="M152 58V16m0 0l-4.5 5m4.5-5l4.5 5"
        stroke="var(--brand)"
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.75"
      />
    </>
  )
}

const BY_STEP = { '01': MapGraphic, '02': QuizGraphic, '03': PlanGraphic }

export default function StepGraphic({ step }) {
  const Inner = BY_STEP[step]
  if (!Inner) return null
  return (
    <svg
      viewBox="0 0 160 76"
      fill="none"
      aria-hidden="true"
      className="w-full max-w-[280px]"
    >
      <Inner />
    </svg>
  )
}
