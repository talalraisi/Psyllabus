'use client'

import { useEffect, useState } from 'react'
import { useInView } from './scroll'
import { IconChevronRight } from '@/components/Icons'

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

/**
 * Draw when the carousel arrives, not when the slide does.
 *
 * Every graphic watched its own position and started from nothing when it
 * first saw the viewport. Inside a carousel that is wrong twice over: the
 * slide is rebuilt on each advance, so the graphic reset to blank and redrew
 * every seven seconds; and if the observer had not reported by the time the
 * slide appeared, it drew nothing at all and left a hole in the panel.
 *
 * Given `shown`, it uses that instead — which is the carousel's own arrival,
 * settled once and true from then on. The first slide draws itself in; the
 * ones after it are already drawn when they fade up, which is what you want
 * from something that changes under you while you are reading something else.
 */
function useDraw(shown) {
  const [ref, seen] = useInView({ threshold: 0.35 })
  return [ref, shown === undefined ? seen : shown]
}

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
function GraphicHeatmap({ shown }) {
  const [ref, seen] = useDraw(shown)
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
function GraphicFade({ shown }) {
  const [ref, seen] = useDraw(shown)
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
function GraphicMistakes({ shown }) {
  const [ref, seen] = useDraw(shown)
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
function GraphicPacing({ shown }) {
  const [ref, seen] = useDraw(shown)
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
function GraphicCalendar({ shown }) {
  const [ref, seen] = useDraw(shown)
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
function GraphicTimer({ shown }) {
  const [ref, seen] = useDraw(shown)
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
function GraphicResources({ shown }) {
  const [ref, seen] = useDraw(shown)
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
function GraphicPrediction({ shown }) {
  const [ref, seen] = useDraw(shown)
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
const SLIDE_MS = 5200

/**
 * The features, in groups of what they are for.
 *
 * Eight modules in one run put the heatmap next to the session timer, which
 * are not the same kind of thing and do not belong in the same sentence. A
 * reader working out what the product does needs the three questions it
 * answers — where do I stand, what do I practise, when do I do it — and then
 * the features underneath each one.
 */
const GROUPS = [
  {
    heading: 'Know where you stand',
    blurb: 'Measured from what you proved, never from what you said about yourself.',
    keys: ['The map', 'Decay', 'Prediction'],
  },
  {
    heading: 'Practise until it holds',
    blurb: 'The same subtopic, until getting it right stops being luck.',
    keys: ['Papers', 'Review', 'Resources'],
  },
  {
    heading: 'Spend the time you actually have',
    blurb: 'Tonight is forty minutes, not a term. The plan is built for tonight.',
    keys: ['Calendar', 'Sessions'],
  },
]

/**
 * One step of the tour.
 *
 * Out at the edge of the frame rather than tucked into a control strip, and
 * round, because it is sitting over an illustration rather than in a bar. It
 * keeps a filled backing so it stays legible whatever it happens to be over.
 */
function Step({ onClick, label, back = false, className = '', style }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`press elev flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-150 hover:bg-[var(--surface-sunken)] md:h-11 md:w-11 ${className}`}
      style={{
        borderColor: 'var(--border-strong)',
        background: 'var(--surface)',
        color: 'var(--text-body)',
        ...style,
      }}
    >
      <IconChevronRight width={17} height={17} style={back ? { transform: 'rotate(180deg)' } : undefined} />
    </button>
  )
}

/**
 * One stage, and the slides either side of it showing through.
 *
 * The three panels this replaced were honest about their content and said
 * nothing about it: a bordered box with a strip of controls on top, three
 * times down the page. What a feature tour has to do is make the next thing
 * look worth waiting for, and a panel with a hard edge cannot, because there
 * is visibly nothing past it.
 *
 * So the slides sit in a row that runs off both sides of the frame, blurred
 * and stepped back, and the one you are on is the one in focus. Same eight
 * features, same illustrations. The difference is that you can see there are
 * more of them.
 */
function Stage({ items }) {
  const [ref, seen] = useInView({ threshold: 0.25 })
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setReduced(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  useEffect(() => {
    if (!seen || paused || reduced || items.length < 2) return
    const id = setTimeout(() => setAt((i) => (i + 1) % items.length), SLIDE_MS)
    return () => clearTimeout(id)
  }, [at, seen, paused, reduced, items.length])

  const go = (d) => setAt((i) => (i + d + items.length) % items.length)
  if (!items.length) return null

  /** Where a slide sits relative to the one in focus, wrapping the short way
   *  round so stepping back from the first goes left rather than flying the
   *  whole row across. */
  const offset = (i) => {
    const raw = i - at
    const half = items.length / 2
    if (raw > half) return raw - items.length
    if (raw < -half) return raw + items.length
    return raw
  }

  return (
    /* It pauses when something in it has keyboard focus, and not when the
       pointer is merely over it.

       Hovering the whole stage used to stop the slideshow, and the stage is
       most of the screen when you are reading it — so resting the cursor
       anywhere near the middle of the page, which is where a cursor sits,
       froze the thing on whichever slide it happened to be on. It looked
       broken rather than paused. Focus still stops it, because a person
       tabbing through the pills is working with it and should not have it
       move underneath them. */
    <div
      ref={ref}
      className="relative mt-14"
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* The words change with the slide and are stacked in one cell, so the
          stage below does not jump when a two-line title follows a one-line
          one. */}
      <div className="mx-auto grid max-w-2xl text-center">
        {items.map((slide, i) => (
          <div
            key={slide.title}
            aria-hidden={i !== at}
            className="col-start-1 row-start-1 px-4 transition-opacity duration-500"
            style={{ opacity: i === at ? 1 : 0, visibility: i === at ? 'visible' : 'hidden' }}
          >
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--brand)' }}
            >
              {slide.group}
            </p>
            <h3 className="mt-3 text-[clamp(1.55rem,3vw,2.05rem)] font-semibold leading-tight tracking-[-0.03em]">
              {slide.title}
            </h3>
            <p
              className="mx-auto mt-4 max-w-lg text-[14.5px] leading-[1.7]"
              style={{ color: 'var(--text-muted)' }}
            >
              {slide.body}
            </p>
          </div>
        ))}
      </div>

      {/* The row runs wider than the frame and is clipped, which is what puts
          the next slide at the edge of your eye rather than out of the room. */}
      <div className="relative mt-11 overflow-hidden py-3">
        <div className="mx-auto grid w-full max-w-lg">
          {items.map((slide, i) => {
            const d = offset(i)
            const near = Math.abs(d) <= 1
            return (
              <div
                key={slide.title}
                aria-hidden={i !== at}
                className="col-start-1 row-start-1 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform: `translateX(${d * 76}%) scale(${d === 0 ? 1 : 0.84})`,
                  opacity: d === 0 ? 1 : near ? 0.32 : 0,
                  filter: d === 0 ? 'none' : 'blur(3px)',
                  pointerEvents: d === 0 ? undefined : 'none',
                  visibility: near ? 'visible' : 'hidden',
                  zIndex: d === 0 ? 2 : 1,
                }}
              >
                <div
                  className="elev-lg flex min-h-[15rem] items-center rounded-[16px] border p-6 md:p-8"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
                >
                  <div className="w-full min-w-0">
                    <slide.Graphic shown={seen} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Floating either side of the card, but only where there is room
            beside it. On a phone the card is the full width of the page, so a
            button floated over its edge sits on the content; those go next to
            the pills instead. */}
        {items.length > 1 && (
          <div className="hidden md:block">
            <Step
              onClick={() => go(-1)}
              label="Previous feature"
              back
              className="absolute top-1/2 z-10 -translate-y-1/2"
              style={{ left: 'max(0.5rem, 2%)' }}
            />
            <Step
              onClick={() => go(1)}
              label="Next feature"
              className="absolute top-1/2 z-10 -translate-y-1/2"
              style={{ right: 'max(0.5rem, 2%)' }}
            />
          </div>
        )}
      </div>

      {/* One pill per feature, the one you are on stretched out. It is the
          position and the control at once, and it counts without a counter. */}
      <div className="mt-9 flex items-center justify-center gap-4">
        {items.length > 1 && (
          <Step onClick={() => go(-1)} label="Previous feature" back className="md:hidden" />
        )}
        <div className="flex items-center gap-2">
          {items.map((slide, i) => (
            <button
              key={slide.title}
              onClick={() => setAt(i)}
              aria-label={`Show ${slide.title}`}
              aria-current={i === at}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: i === at ? 30 : 6,
                background: i === at ? 'var(--brand)' : 'var(--border-strong)',
              }}
            />
          ))}
        </div>
        {items.length > 1 && <Step onClick={() => go(1)} label="Next feature" className="md:hidden" />}
      </div>
    </div>
  )
}

/**
 * Eight features, one after another.
 *
 * They were three separate carousels under three headings, which is three
 * sets of controls to work out and three places to be part-way through. The
 * grouping still does its job — it is the line above each title — but there
 * is one thing to operate.
 */
export function FeatureModules() {
  const byLabel = new Map(FEATURE_MODULES.map((m) => [m.label, m]))
  const slides = GROUPS.flatMap((g) =>
    g.keys
      .map((k) => byLabel.get(k))
      .filter(Boolean)
      .map((m) => ({ ...m, group: g.heading }))
  )
  return <Stage items={slides} />
}

export { Label }
