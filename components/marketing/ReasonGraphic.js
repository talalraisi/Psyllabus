/**
 * A small picture for each of the six reasons.
 *
 * This was the heaviest block of unbroken prose on the page — six paragraphs,
 * two columns, no visual at all — and the one place where a reader is asked to
 * take six separate claims on trust in a row. Each reason makes a concrete
 * claim about a mechanism, so each gets a drawing of that mechanism rather than
 * an icon standing in for its topic.
 *
 * They are small on purpose. At this size they sit under a paragraph as
 * punctuation; any larger and six of them compete with the three step diagrams
 * further up the page and the section stops being text with support and starts
 * being a gallery.
 *
 * Server component, same as StepGraphic, and for the same reason: a
 * label-to-graphic map exported across a 'use client' boundary arrives as an
 * opaque reference and renders holes. Taking the index as a prop sidesteps it.
 */

const SW = 1.4
const W = 160
const H = 54

/** 01 — what you think you know, against what you proved. */
function SelfMarking() {
  return (
    <>
      <rect x="0" y="8" width="124" height="9" rx="4.5" fill="var(--border)" className="cell" style={{ transformOrigin: 'left' }} />
      <rect x="0" y="30" width="68" height="9" rx="4.5" fill="var(--status-proficient)" className="cell" style={{ transformOrigin: 'left', animationDelay: '140ms' }} />
      {/* the overrating, drawn as the distance between the two */}
      <path d={`M68 4V43`} stroke="var(--border-strong)" strokeWidth={SW} strokeDasharray="3 3" />
      <path d={`M124 4V12`} stroke="var(--border-strong)" strokeWidth={SW} strokeDasharray="3 3" />
      <path d="M72 6h48m0 0l-5-3m5 3l-5 3" stroke="var(--status-weak)" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

/** 02 — the default is downward. */
function Decay() {
  return (
    <>
      <path d="M0 44h152" stroke="var(--border)" strokeWidth={SW} />
      <path d="M0 6c34 0 46 10 60 20s32 17 92 17" stroke="var(--status-fading)" strokeWidth="2" fill="none" className="draw-line" style={{ '--len': 190 }} />
      {/* the floor you fall to if nothing is retested */}
      <path d="M0 33h152" stroke="var(--border-strong)" strokeWidth={SW} strokeDasharray="4 4" />
      <rect className="cell" x="146" y="37" width="12" height="12" rx="3" fill="var(--status-weak)" style={{ animationDelay: '700ms' }} />
    </>
  )
}

/** 03 — one quiz, two jobs. */
function TwoJobs() {
  return (
    <>
      <rect x="0" y="18" width="40" height="18" rx="4" fill="none" stroke="var(--status-proficient)" strokeWidth={SW} />
      <path d="M14 27h12m0 0l-3.5-3m3.5 3l-3.5 3" stroke="var(--status-proficient)" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M46 24c14-12 28-14 44-14" stroke="var(--border-strong)" strokeWidth={SW} fill="none" className="draw-line" style={{ '--len': 70 }} />
      <path d="M46 30c14 12 28 14 44 14" stroke="var(--border-strong)" strokeWidth={SW} fill="none" className="draw-line" style={{ '--len': 70, animationDelay: '120ms' }} />
      <rect className="cell" x="96" y="2" width="58" height="15" rx="4" fill="var(--border)" style={{ transformOrigin: 'left', animationDelay: '300ms' }} />
      <rect className="cell" x="96" y="37" width="44" height="15" rx="4" fill="var(--border)" style={{ transformOrigin: 'left', animationDelay: '400ms' }} />
    </>
  )
}

/** 04 — the wrong one comes back, at widening gaps. */
function Spacing() {
  const stops = [4, 30, 76, 142]
  return (
    <>
      <path d="M4 27h148" stroke="var(--border)" strokeWidth={SW} />
      <rect className="cell" x="0" y="21" width="12" height="12" rx="3" fill="var(--status-weak)" />
      {stops.slice(1).map((x, i) => (
        <circle
          key={x}
          className="cell"
          cx={x}
          cy="27"
          r="5"
          fill={i === stops.length - 2 ? 'var(--status-proficient)' : 'var(--border-strong)'}
          style={{ animationDelay: `${200 + i * 160}ms` }}
        />
      ))}
    </>
  )
}

/** 05 — the evening, in order, worst first. */
function Direction() {
  const rows = [
    { tone: 'weak', w: 104 },
    { tone: 'developing', w: 78 },
    { tone: 'proficient', w: 54 },
  ]
  return (
    <>
      {/* the time you said you had */}
      <path d="M0 2v50M152 2v50" stroke="var(--border-strong)" strokeWidth={SW} />
      <path d="M0 27h152" stroke="var(--border)" strokeWidth={SW} strokeDasharray="3 4" />
      {rows.map((r, i) => (
        <g key={r.tone}>
          <rect x="8" y={6 + i * 16} width="3" height="11" rx="1.5" fill={`var(--status-${r.tone})`} />
          <rect
            className="cell"
            x="16"
            y={6 + i * 16}
            width={r.w}
            height="11"
            rx="3"
            fill="var(--border)"
            style={{ transformOrigin: 'left', animationDelay: `${i * 90}ms` }}
          />
        </g>
      ))}
    </>
  )
}

/** 06 — the gap between where you are and where you want to be. */
function Prediction() {
  return (
    <>
      <path d="M0 44h152" stroke="var(--border)" strokeWidth={SW} />
      <rect className="cell" x="22" y="18" width="26" height="26" rx="3" fill="var(--status-proficient)" opacity="0.85" style={{ transformOrigin: 'bottom' }} />
      <rect className="cell" x="88" y="4" width="26" height="40" rx="3" fill="none" stroke="var(--brand)" strokeWidth={SW} strokeDasharray="4 3" style={{ transformOrigin: 'bottom', animationDelay: '160ms' }} />
      <path d="M56 24h24m0 0l-5-3m5 3l-5 3" stroke="var(--border-strong)" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* how much syllabus the number rests on */}
      <rect x="22" y="48" width="92" height="3" rx="1.5" fill="var(--border)" />
      <rect className="cell" x="22" y="48" width="34" height="3" rx="1.5" fill="var(--status-developing)" style={{ transformOrigin: 'left', animationDelay: '320ms' }} />
    </>
  )
}

const BY_INDEX = [SelfMarking, Decay, TwoJobs, Spacing, Direction, Prediction]

export default function ReasonGraphic({ n }) {
  const Inner = BY_INDEX[n]
  if (!Inner) return null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden="true" className="w-full max-w-[200px]">
      <Inner />
    </svg>
  )
}
