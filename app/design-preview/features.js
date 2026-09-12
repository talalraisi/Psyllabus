'use client'

import { useInView } from './scroll'

/**
 * One module per feature, each with a purpose-built graphic.
 *
 * The brief is a high-end workspace: minimalist, modular, distraction-free.
 * That is a specific look and it is mostly restraint — a strict grid, hairlines
 * instead of cards, small radii, uppercase micro-labels, tabular numbers, and
 * one accent colour used sparingly. Tools that feel expensive feel that way
 * because nothing in them is fighting for attention.
 *
 * So every graphic here is drawn from the same small vocabulary the product
 * already uses: cells, bars, rings, rows. Eight illustrations in eight
 * different styles would be a gallery; eight built from one vocabulary is a
 * system, and that is what reads as high-end rather than decorated.
 *
 * Each one shows the mechanic rather than gesturing at it, so the section
 * doubles as documentation. Nothing here loops or moves on its own: they draw
 * once as you reach them and then hold still, because distraction-free means
 * the page stops moving when you stop scrolling.
 */

function Label({ children }) {
  return (
    <p
      className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: 'var(--faint)' }}
    >
      {children}
    </p>
  )
}

/**
 * The frame every graphic sits in, so all eight share one silhouette.
 *
 * Surface rather than sunken: these sit inside a tinted section, and a panel
 * the same colour as the thing behind it is not a panel. Modular only reads as
 * modular when each module has an edge.
 */
function Frame({ children, className = '' }) {
  return (
    <div
      className={`rounded-[10px] border p-5 ${className}`}
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      {children}
    </div>
  )
}

/* 1. Heatmap ---------------------------------------------------------------- */
function GraphicHeatmap() {
  const [ref, seen] = useInView({ threshold: 0.4 })
  const tones = [
    'mastered','proficient','proficient','developing','untested','untested',
    'proficient','developing','weak','untested','untested','untested',
    'developing','weak','untested','untested','untested','untested',
  ]
  return (
    <Frame>
      <div ref={ref} className="grid grid-cols-6 gap-[4px]">
        {tones.map((t, i) => (
          <span
            key={i}
            className="aspect-square rounded-[2px]"
            style={{
              background: `var(--${t})`,
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'scale(0.7)',
              transition: `all 320ms cubic-bezier(0.16,1,0.3,1) ${i * 26}ms`,
            }}
          />
        ))}
      </div>
    </Frame>
  )
}

/* 2. Fading ---------------------------------------------------------------- */
function GraphicFade() {
  const [ref, seen] = useInView({ threshold: 0.5 })
  return (
    <Frame>
      <div ref={ref} className="flex flex-col gap-2.5">
        {[
          ['Day 0', 'mastered', 100],
          ['Day 9', 'proficient', 74],
          ['Day 16', 'fading', 46],
          ['Day 24', 'fading', 22],
        ].map(([d, tone, w], i) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-12 text-[10.5px] tabular-nums" style={{ color: 'var(--faint)' }}>{d}</span>
            <span className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
              <span
                className="block h-full rounded-full"
                style={{
                  width: seen ? `${w}%` : 0,
                  background: `var(--${tone})`,
                  transition: `width 700ms cubic-bezier(0.16,1,0.3,1) ${i * 110}ms`,
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

/* 3. Mistake bank ---------------------------------------------------------- */
function GraphicMistakes() {
  const [ref, seen] = useInView({ threshold: 0.5 })
  return (
    <Frame>
      <div ref={ref} className="flex flex-col gap-2">
        {[['tomorrow', 1], ['in 3 days', 3], ['in a week', 7], ['in 16 days', 16]].map(([when, n], i) => (
          <div
            key={when}
            className="flex items-center justify-between rounded-[6px] border px-3 py-2"
            style={{
              borderColor: 'var(--border-strong)',
              background: 'var(--surface)',
              opacity: seen ? 1 : 0,
              transform: seen ? 'none' : 'translateX(-8px)',
              transition: `all 420ms cubic-bezier(0.16,1,0.3,1) ${i * 90}ms`,
            }}
          >
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--weak)' }} />
              <span className="text-[11.5px]" style={{ color: 'var(--body)' }}>Question you got wrong</span>
            </span>
            <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--faint)' }}>{when}</span>
          </div>
        ))}
      </div>
    </Frame>
  )
}

/* 4. Timed papers ---------------------------------------------------------- */
function GraphicPacing() {
  const [ref, seen] = useInView({ threshold: 0.5 })
  return (
    <Frame>
      <div ref={ref}>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-[19px] font-semibold tabular-nums">42:08</span>
          <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--muted)' }}>
            1.4 / 1.6 marks per min
          </span>
        </div>
        <div className="relative h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: seen ? '62%' : 0,
              background: 'var(--developing)',
              transition: 'width 900ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
          <span className="absolute inset-y-0 w-[2px]" style={{ left: '72%', background: 'var(--text)' }} />
        </div>
        <p className="mt-2.5 text-[10.5px]" style={{ color: 'var(--faint)' }}>
          The tick is the pace you need. You are behind it.
        </p>
      </div>
    </Frame>
  )
}

/* 5. Calendar -------------------------------------------------------------- */
function GraphicCalendar() {
  const [ref, seen] = useInView({ threshold: 0.5 })
  const marks = { 4: 'developing', 11: 'weak', 18: 'proficient', 19: 'weak' }
  return (
    <Frame>
      <div ref={ref} className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="flex aspect-square items-center justify-center rounded-[3px] text-[9.5px] tabular-nums"
            style={{
              background: marks[i] ? `var(--${marks[i]})` : 'var(--surface)',
              color: marks[i] ? '#fff' : 'var(--faint)',
              border: marks[i] ? 'none' : '1px solid var(--border)',
              opacity: seen ? 1 : 0,
              transition: `opacity 300ms ease ${i * 14}ms`,
            }}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--faint)' }}>
        A test on the 11th pulls that subject up the plan from the 4th.
      </p>
    </Frame>
  )
}

/* 6. Session timer --------------------------------------------------------- */
function GraphicTimer() {
  const [ref, seen] = useInView({ threshold: 0.5 })
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <Frame className="flex items-center gap-4">
      <div ref={ref}>
        <svg width="74" height="74" className="-rotate-90">
          <circle cx="37" cy="37" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="37" cy="37" r={r} fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c}
            style={{
              strokeDashoffset: seen ? c * 0.32 : c,
              transition: 'stroke-dashoffset 1000ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </svg>
      </div>
      <div>
        <p className="text-[17px] font-semibold tabular-nums">27:14</p>
        <p className="text-[10.5px]" style={{ color: 'var(--faint)' }}>
          block 2 of 3 · keeps running as you move around
        </p>
      </div>
    </Frame>
  )
}

/* 7. Resources ------------------------------------------------------------- */
function GraphicResources() {
  const [ref, seen] = useInView({ threshold: 0.5 })
  return (
    <Frame>
      <div ref={ref} className="flex flex-col gap-2">
        {[['VIDEO', 'Circular motion walkthrough'], ['NOTES', 'Gravitation summary'], ['PAST PAPER', 'Paper 1 style questions']].map(
          ([kind, title], i) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-[6px] border px-3 py-2.5"
              style={{
                borderColor: 'var(--border-strong)',
                background: 'var(--surface)',
                opacity: seen ? 1 : 0,
                transform: seen ? 'none' : 'translateY(6px)',
                transition: `all 400ms cubic-bezier(0.16,1,0.3,1) ${i * 110}ms`,
              }}
            >
              <span
                className="rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em]"
                style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
              >
                {kind}
              </span>
              <span className="truncate text-[11.5px]" style={{ color: 'var(--body)' }}>{title}</span>
            </div>
          )
        )}
      </div>
      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--faint)' }}>
        Opens on the creator&rsquo;s own site. Nothing rehosted.
      </p>
    </Frame>
  )
}

/* 8. Predicted grade ------------------------------------------------------- */
function GraphicPrediction() {
  const [ref, seen] = useInView({ threshold: 0.5 })
  return (
    <Frame>
      <div ref={ref}>
        <div className="mb-3 flex items-end justify-between">
          <span>
            <span className="text-[27px] font-semibold tabular-nums">34</span>
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}> / 45</span>
          </span>
          <span className="text-right">
            <span className="block text-[10.5px]" style={{ color: 'var(--faint)' }}>you want</span>
            <span className="text-[15px] font-semibold tabular-nums">38</span>
          </span>
        </div>
        <div className="relative h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: seen ? '75.5%' : 0,
              background: 'var(--proficient)',
              transition: 'width 900ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
          <span className="absolute inset-y-0 w-[2px]" style={{ left: '84.4%', background: 'var(--text)' }} />
        </div>
        <p className="mt-2.5 text-[10.5px]" style={{ color: 'var(--faint)' }}>
          Based on 41% of your syllabus, so it says medium confidence.
        </p>
      </div>
    </Frame>
  )
}

export const FEATURE_MODULES = [
  {
    label: 'The map',
    title: 'A heatmap you cannot fake',
    body: 'Five levels, from Weak to Mastered, every one set by questions you either got right or did not. There is no confidence slider anywhere in this product, because a map of how you feel is not a map of what you know.',
    Graphic: GraphicHeatmap,
  },
  {
    label: 'Decay',
    title: 'Topics that fade on their own',
    body: 'Prove something, leave it two weeks, and it fades back into your plan for a short retest. Nothing else takes a green tick away from you, and that is why other trackers quietly overstate what you still remember by May.',
    Graphic: GraphicFade,
  },
  {
    label: 'Review',
    title: 'A mistake bank that schedules itself',
    body: 'Every question you get wrong returns on a widening schedule: tomorrow, then three days, then a week, then a fortnight. You end up drilling your own gaps rather than a deck somebody else wrote.',
    Graphic: GraphicMistakes,
  },
  {
    label: 'Papers',
    title: 'Timed papers with real pacing',
    body: 'Build a paper from any mix of topics, or sit Paper 1 and Paper 2 as your subject actually examines them. A live marks-per-minute figure tells you whether you are on pace while there is still time to change it.',
    Graphic: GraphicPacing,
  },
  {
    label: 'Calendar',
    title: 'Deadlines that change the plan',
    body: 'Put your tests and internal assessment dates in. As one gets close the planner moves that subject up on its own, so the week before a mock reorders itself without you deciding what to prioritise.',
    Graphic: GraphicCalendar,
  },
  {
    label: 'Sessions',
    title: 'A timer that follows you around',
    body: 'Start a study block and it keeps running while you move between quizzes, notes and the plan. It is the one number that tells you whether tonight actually happened.',
    Graphic: GraphicTimer,
  },
  {
    label: 'Resources',
    title: 'Something to read for the exact gap',
    body: 'Every subtopic carries hand-picked lessons, videos and notes for that one thing, so a wrong answer leads somewhere instead of into a search box. Links open on the creator’s own site and nothing is rehosted or resold.',
    Graphic: GraphicResources,
  },
  {
    label: 'Prediction',
    title: 'A grade you can check the maths on',
    body: 'A running total out of 45 next to the grades you told us you want, built only from quiz results. It states how much of your syllabus it is based on, so a prediction from three quizzes is labelled low confidence instead of presented as a forecast.',
    Graphic: GraphicPrediction,
  },
]

export { Label }
