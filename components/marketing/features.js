'use client'

import { useInView } from './scroll'

/**
 * One module per feature, each with a purpose-built figure.
 *
 * These were eight identical bordered cards, each holding a small widget that
 * sprang in on a staggered delay. Uniform box, uniform easing, uniform
 * cascade — which is exactly the house style of a generated page, and it read
 * that way however carefully the contents were drawn.
 *
 * They are figures now, in the sense a textbook or a technical report means
 * it: a numbered rule above, the drawing on the page rather than in a panel,
 * and a caption under it in the same voice as the body text. Nothing is
 * boxed, because the grid already separates them, and a card drawn around
 * something the grid has already separated is decoration.
 *
 * Each one is also allowed to be a different shape. A grid, a curve, a
 * schedule, a scale and a ring are five different kinds of measurement, and
 * forcing all five into the same pill-shaped progress bar was what made three
 * of these look like the same graphic with different numbers.
 *
 * Motion is down to one gesture per figure, and several have none. They draw
 * once as you reach them and then hold still.
 */

/**
 * The frame every figure shares: a rule, a number, and a caption. No box.
 *
 * The number is not decoration. Eight features described in prose all at once
 * is a wall; numbering them lets the text below point at one and lets a reader
 * keep their place.
 */
function Figure({ n, caption, children }) {
  return (
    <figure className="m-0">
      <div
        className="mb-5 flex items-baseline justify-between gap-4 border-t pt-2.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.18em] tabular-nums"
          style={{ color: 'var(--text-faint)' }}
        >
          Fig. {String(n).padStart(2, '0')}
        </span>
      </div>
      {children}
      {caption && (
        <figcaption
          className="mt-4 text-[12px] leading-[1.6]"
          style={{ color: 'var(--text-faint)' }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

/* 1. Heatmap ---------------------------------------------------------------- */
/** A fragment of a real syllabus, referenced the way the syllabus references it. */
function GraphicHeatmap() {
  const rows = [
    ['1', ['mastered', 'mastered', 'proficient', 'proficient', 'developing', 'untested']],
    ['2', ['proficient', 'developing', 'developing', 'weak', 'untested', 'untested']],
    ['3', ['developing', 'weak', 'weak', 'untested', 'untested', 'untested']],
  ]
  return (
    <Figure n={1} caption="Physics SL, topics 1 to 3. Every cell is one subtopic, and its colour came from answers.">
      <div className="flex flex-col gap-[5px]">
        {rows.map(([topic, cells]) => (
          <div key={topic} className="flex items-center gap-3">
            <span
              className="w-3 shrink-0 text-[10px] tabular-nums"
              style={{ color: 'var(--text-faint)' }}
            >
              {topic}
            </span>
            <div className="flex flex-1 gap-[5px]">
              {cells.map((t, i) => (
                <span
                  key={i}
                  className="h-[22px] flex-1"
                  style={{ background: `var(--status-${t})` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Figure>
  )
}

/* 2. Decay ------------------------------------------------------------------ */
/**
 * The forgetting curve itself, drawn once.
 *
 * Four bars of decreasing length said "something is going down". A curve says
 * how fast, and the shape of that curve is the entire argument for retesting.
 */
function GraphicFade() {
  const [ref, seen] = useInView({ threshold: 0.4 })
  const W = 300
  const H = 96
  const rate = 0.085
  const pts = Array.from({ length: 41 }, (_, i) => {
    const day = (i / 40) * 28
    const y = Math.exp(-rate * day)
    return [Math.round((day / 28) * W * 100) / 100, Math.round((H - y * (H - 8)) * 100) / 100]
  })
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ')

  return (
    <Figure n={2} caption="Mastered on day 0, left alone. By day 24 the app calls it fading and puts it back in the plan.">
      <svg ref={ref} viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
        {[0, 1].map((i) => (
          <line
            key={i}
            x1="0"
            x2={W}
            y1={8 + i * ((H - 8) / 2)}
            y2={8 + i * ((H - 8) / 2)}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border-strong)" strokeWidth="1" />
        <path
          d={d}
          fill="none"
          stroke="var(--status-fading)"
          strokeWidth="1.5"
          pathLength="1"
          strokeDasharray="1"
          style={{
            strokeDashoffset: seen ? 0 : 1,
            transition: 'stroke-dashoffset 1100ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {[
          [0, 'day 0'],
          [W / 2, 'day 14'],
          [W, 'day 28'],
        ].map(([x, t], i) => (
          <text
            key={t}
            x={x}
            y={H + 14}
            fontSize="9.5"
            fill="var(--text-faint)"
            textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
          >
            {t}
          </text>
        ))}
      </svg>
    </Figure>
  )
}

/* 3. Mistake bank ----------------------------------------------------------- */
/** A schedule, set as a schedule: ruled rows, real questions, dates on the right. */
function GraphicMistakes() {
  const rows = [
    ['Why the centripetal force does no work', 'due now'],
    ['Sign convention for lens equations', 'in 1 day'],
    ['Price elasticity at the midpoint', 'in 5 days'],
    ['Enthalpy of combustion, per mole', 'in a week'],
  ]
  return (
    <Figure n={3} caption="Right each time and the gap widens until it drops out of the bank. Wrong and it starts over.">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map(([q, when], i) => (
            <tr key={q} style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <td className="py-2 pr-4 text-[11.5px]" style={{ color: 'var(--text-body)' }}>
                {q}
              </td>
              <td
                className="w-20 py-2 text-right text-[11px] tabular-nums"
                style={{ color: i === 0 ? 'var(--status-weak)' : 'var(--text-faint)' }}
              >
                {when}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Figure>
  )
}

/* 4. Pacing ----------------------------------------------------------------- */
/**
 * Marks against minutes, with the line you have to keep up with.
 *
 * A single bar could only say how far through you were. Two lines say the
 * thing that matters, which is that you are falling behind and by how much.
 */
function GraphicPacing() {
  const [ref, seen] = useInView({ threshold: 0.4 })
  const W = 300
  const H = 92
  const actual = [0, 9, 17, 24, 29, 34, 38]
  const max = 60
  const pt = (v, i) => [
    Math.round((i / (actual.length - 1)) * W * 100) / 100,
    Math.round((H - (v / max) * H) * 100) / 100,
  ]
  const line = actual.map((v, i) => `${i ? 'L' : 'M'} ${pt(v, i).join(' ')}`).join(' ')

  return (
    <Figure n={4} caption="Grey is the pace the paper needs. You are ten marks behind it with a quarter of the paper left.">
      <svg ref={ref} viewBox={`0 0 ${W} ${H + 16}`} className="w-full">
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border-strong)" strokeWidth="1" />
        <line x1="0" y1={H} x2={W} y2={H - (48 / max) * H} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3" />
        <path
          d={line}
          fill="none"
          stroke="var(--status-developing)"
          strokeWidth="1.5"
          pathLength="1"
          strokeDasharray="1"
          style={{
            strokeDashoffset: seen ? 0 : 1,
            transition: 'stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        <text x="0" y={H + 13} fontSize="9.5" fill="var(--text-faint)">
          0 min
        </text>
        <text x={W} y={H + 13} fontSize="9.5" fill="var(--text-faint)" textAnchor="end">
          42 min
        </text>
      </svg>
    </Figure>
  )
}

/* 5. Calendar --------------------------------------------------------------- */
/** A month as a ruled sheet. Two dates matter, and only those two are marked. */
function GraphicCalendar() {
  const marks = { 3: 'plan', 10: 'test' }
  return (
    <Figure n={5} caption="A mock on the 11th pulls Physics to the top of the plan from the 4th onward.">
      <div className="grid grid-cols-7">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="relative flex h-[30px] items-center justify-center border-b border-r text-[10px] tabular-nums"
            style={{
              borderColor: 'var(--border)',
              color: marks[i] ? 'var(--text)' : 'var(--text-faint)',
              fontWeight: marks[i] ? 600 : 400,
              background:
                marks[i] === 'test' ? 'color-mix(in oklab, var(--status-weak) 16%, transparent)' : 'transparent',
            }}
          >
            {i + 1}
            {marks[i] === 'plan' && (
              <span
                className="absolute bottom-[3px] h-[2px] w-3"
                style={{ background: 'var(--brand)' }}
              />
            )}
          </span>
        ))}
      </div>
    </Figure>
  )
}

/* 6. Session timer ---------------------------------------------------------- */
/** The one number that says whether tonight happened. */
function GraphicTimer() {
  const [ref, seen] = useInView({ threshold: 0.4 })
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <Figure n={6} caption="Started on the plan, still running in the quiz. It does not reset when you move.">
      <div ref={ref} className="flex items-center gap-6">
        <svg width="82" height="82" className="-rotate-90 shrink-0">
          <circle cx="41" cy="41" r={r} fill="none" stroke="var(--border)" strokeWidth="1.5" />
          <circle
            cx="41"
            cy="41"
            r={r}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="1.5"
            strokeDasharray={c}
            style={{
              strokeDashoffset: seen ? c * 0.32 : c,
              transition: 'stroke-dashoffset 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>
        <div>
          <p className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            27:14
          </p>
          <p className="mt-2 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            block 2 of 3
          </p>
        </div>
      </div>
    </Figure>
  )
}

/* 7. Resources -------------------------------------------------------------- */
/** A reading list, set as a reading list. */
function GraphicResources() {
  const rows = [
    ['Video', 'Circular motion, worked from first principles', 'khanacademy.org'],
    ['Notes', 'Gravitation summary sheet', 'physicsandmathstutor.com'],
    ['Paper', 'Paper 1 questions on this subtopic', 'ibdocuments.com'],
  ]
  return (
    <Figure n={7} caption="Chosen for one subtopic, not for the subject. Every link opens on the creator's own site.">
      <ul className="flex flex-col">
        {rows.map(([kind, title, host], i) => (
          <li
            key={title}
            className="flex items-baseline gap-3 py-2.5"
            style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}
          >
            <span
              className="w-10 shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--text-faint)' }}
            >
              {kind}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-body)' }}>
                {title}
              </span>
              <span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-faint)' }}>
                {host}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Figure>
  )
}

/* 8. Predicted grade -------------------------------------------------------- */
/**
 * A scale with two marks on it: where you are and where you said you wanted to
 * be. Drawn as a ruler rather than a progress bar, because it is a measurement
 * and not an achievement.
 */
function GraphicPrediction() {
  const W = 300
  const at = (n) => Math.round(((n - 24) / (45 - 24)) * W * 100) / 100
  return (
    <Figure n={8} caption="Built only from quiz results, and it says so: 41% of the syllabus tested means medium confidence.">
      <div className="mb-5 flex items-baseline gap-2">
        <span className="text-[34px] font-semibold leading-none tracking-[-0.035em] tabular-nums">
          34
        </span>
        <span className="text-[13px]" style={{ color: 'var(--text-faint)' }}>
          / 45 predicted
        </span>
      </div>
      <svg viewBox={`0 0 ${W} 40`} className="w-full">
        <line x1="0" x2={W} y1="14" y2="14" stroke="var(--border-strong)" strokeWidth="1" />
        {[24, 30, 36, 45].map((n) => (
          <g key={n}>
            <line x1={at(n)} x2={at(n)} y1="14" y2="19" stroke="var(--border-strong)" strokeWidth="1" />
            <text x={at(n)} y="32" fontSize="9.5" fill="var(--text-faint)" textAnchor="middle">
              {n}
            </text>
          </g>
        ))}
        <line x1="0" x2={at(34)} y1="14" y2="14" stroke="var(--status-proficient)" strokeWidth="3" />
        <line x1={at(38)} x2={at(38)} y1="6" y2="22" stroke="var(--text)" strokeWidth="1.5" />
        <text x={at(38)} y="3" fontSize="9.5" fill="var(--text)" textAnchor="middle">
          target
        </text>
      </svg>
    </Figure>
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

