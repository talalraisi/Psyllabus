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
      style={{ color: 'var(--text-faint)' }}
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
              background: `var(--status-${t})`,
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
            <span className="w-12 text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>{d}</span>
            <span className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
              <span
                className="block h-full rounded-full"
                style={{
                  width: seen ? `${w}%` : 0,
                  background: `var(--status-${tone})`,
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
        {[
          ['due now', 'weak'],
          ['in 1 day', 'developing'],
          ['in 5 days', 'proficient'],
          ['in a week', 'mastered'],
        ].map(([when, tone], i) => (
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
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--status-${tone})` }} />
              <span className="text-[11.5px]" style={{ color: 'var(--text-body)' }}>Question you got wrong</span>
            </span>
            <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-faint)' }}>{when}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
        Right each time and the gap widens until it drops out of the bank. Wrong and it starts
        over.
      </p>
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
          <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            1.4 / 1.6 marks per min
          </span>
        </div>
        <div className="relative h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: seen ? '62%' : 0,
              background: 'var(--status-developing)',
              transition: 'width 900ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
          <span className="absolute inset-y-0 w-[2px]" style={{ left: '72%', background: 'var(--text)' }} />
        </div>
        <p className="mt-2.5 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
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
            className="relative flex aspect-square items-center justify-center rounded-[3px] text-[9.5px] tabular-nums"
            style={{
              background: 'var(--surface)',
              // White numerals on a light status colour came out at 2.9:1 at
              // ten pixels. A marked day is now ringed and underlined instead,
              // so the colour still says which day it is without a legibility
              // problem, and the number stays on the surface it was designed
              // against.
              color: marks[i] ? 'var(--text)' : 'var(--text-faint)',
              border: `1px solid ${marks[i] ? `var(--status-${marks[i]})` : 'var(--border)'}`,
              fontWeight: marks[i] ? 600 : 400,
              opacity: seen ? 1 : 0,
              transition: `opacity 300ms ease ${i * 14}ms`,
            }}
          >
            {i + 1}
            {marks[i] && (
              <span
                className="absolute inset-x-1 bottom-[2px] h-[2px] rounded-full"
                style={{ background: `var(--status-${marks[i]})` }}
              />
            )}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
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
        <p className="text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
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
              <span className="truncate text-[11.5px]" style={{ color: 'var(--text-body)' }}>{title}</span>
            </div>
          )
        )}
      </div>
      <p className="mt-3 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
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
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}> / 45</span>
          </span>
          <span className="text-right">
            <span className="block text-[10.5px]" style={{ color: 'var(--text-faint)' }}>you want</span>
            <span className="text-[15px] font-semibold tabular-nums">38</span>
          </span>
        </div>
        <div className="relative h-[7px] overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: seen ? '75.5%' : 0,
              background: 'var(--status-proficient)',
              transition: 'width 900ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
          <span className="absolute inset-y-0 w-[2px]" style={{ left: '84.4%', background: 'var(--text)' }} />
        </div>
        <p className="mt-2.5 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
          Based on 41% of your syllabus, so it says medium confidence.
        </p>
      </div>
    </Frame>
  )
}

const FEATURE_MODULES = [
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
    body: 'Every question you get wrong comes back straight away, then after a day, then five, then a week. Keep getting it right and it leaves the bank for good; get it wrong and the schedule restarts. You end up drilling your own gaps rather than a deck somebody else wrote.',
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

/**
 * The modules render themselves.
 *
 * FEATURE_MODULES holds references to client components, so a server component
 * importing the array receives a client reference rather than the array and
 * `.map` is not a function. Keeping the loop on this side of the boundary is
 * the fix, and it keeps the graphics private to this file, which they should
 * be anyway.
 */
export function FeatureModules() {
  return (
    <div className="mt-14 flex flex-col">
      {FEATURE_MODULES.map(({ label, title, body, Graphic }, i) => (
        <article
          key={title}
          className="rv-reveal grid gap-8 border-t py-10 md:grid-cols-[0.9fr_1.1fr] md:gap-14 md:py-12"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className={i % 2 === 1 ? 'md:order-2' : undefined}>
            <p
              className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {String(i + 1).padStart(2, '0')} · {label}
            </p>
            <h3 className="text-[20px] font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
            <p className="mt-3 text-[14.5px] leading-[1.7]" style={{ color: 'var(--text-body)' }}>
              {body}
            </p>
          </div>
          <div className={i % 2 === 1 ? 'md:order-1' : undefined}>
            <Graphic />
          </div>
        </article>
      ))}
    </div>
  )
}

export { Label }
