/**
 * A small piece of evidence for each of the six reasons.
 *
 * The first attempt at this was six abstract SVGs — grey bars, a curve, boxes
 * with arrows — and it looked forced, because it was. None of them carried
 * anything: you had to read the paragraph first and then work out which shape
 * stood for which part of it, which is decoration doing an impression of
 * information. A drawing earns its place by saying something the sentence
 * cannot say cheaply, usually a number or a comparison.
 *
 * So these are concrete. Each one shows the actual mechanism with the actual
 * figures the copy and the engine use — two weeks to Fading and five to Weak,
 * the one-five-seven day return of a wrong answer, a predicted grade against a
 * target with the confidence it rests on. Read the panel and you have the
 * point; the paragraph beside it is then the explanation rather than the
 * decoder ring.
 *
 * HTML rather than SVG, which is the other half of the fix. These are mostly
 * small type, and SVG text at 8px renders soft and ignores the page's font
 * stack. As markup they get the real typeface, real hinting and real line
 * breaks, and they end up looking like fragments of the product — which is
 * what they are meant to be.
 *
 * Server component, same as StepGraphic: a label-to-graphic map exported
 * across a 'use client' boundary arrives as an opaque reference and renders
 * holes. Taking the index as a prop sidesteps it.
 */

function Panel({ children }) {
  return (
    <div
      className="rounded-lg border p-3.5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {children}
    </div>
  )
}

/** A label, a proportional bar, and the figure it stands for. */
function Bar({ label, pct, tone, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[68px] shrink-0 text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
        {label}
      </span>
      <span
        className="h-[7px] flex-1 overflow-hidden rounded-full"
        style={{ background: 'var(--border)' }}
      >
        <span
          className="grow block h-full rounded-full"
          style={{ width: `${pct}%`, background: tone }}
        />
      </span>
      <span className="w-[62px] shrink-0 text-right text-[10.5px] font-medium tabular-nums">
        {value}
      </span>
    </div>
  )
}

/** 01 — the mood you reported, against the questions you answered. */
function SelfMarking() {
  return (
    <Panel>
      <div className="flex flex-col gap-2.5">
        <Bar label="You said" pct={100} tone="var(--border-strong)" value="Confident" />
        <Bar label="You proved" pct={40} tone="var(--status-proficient)" value="4 / 10" />
      </div>
    </Panel>
  )
}

/** A status cell with the word under it. */
function Step({ tone, head, sub, dashed = false }) {
  return (
    <div className="flex-1">
      <div
        className="cell h-[22px] rounded"
        style={
          dashed
            ? { border: `1px dashed var(--status-${tone})` }
            : { background: `var(--status-${tone})` }
        }
      />
      <p className="mt-2 text-[10.5px] font-medium" style={{ color: `var(--status-${tone})` }}>
        {head}
      </p>
      <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
        {sub}
      </p>
    </div>
  )
}

/** 02 — the two dates in the copy, drawn as the states they produce. */
function Decay() {
  return (
    <Panel>
      <div className="flex items-start gap-2">
        <Step tone="mastered" head="Proved" sub="day 0" />
        <Step tone="fading" head="Fading" sub="2 weeks" dashed />
        <Step tone="weak" head="Weak" sub="5 weeks" />
      </div>
    </Panel>
  )
}

/** 03 — the same answer, counted twice. */
function TwoJobs() {
  return (
    <Panel>
      <p className="text-[10.5px] font-medium" style={{ color: 'var(--status-proficient)' }}>
        One answer
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {['Tells the planner where you stand', 'Makes the thing harder to forget'].map((t) => (
          <div key={t} className="flex items-start gap-2">
            <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: 'var(--brand)' }} />
            <span className="text-[11px] leading-snug" style={{ color: 'var(--text-body)' }}>
              {t}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** 04 — a wrong answer, and when it comes back. */
function Spacing() {
  const stops = ['1 day', '5 days', '1 week']
  return (
    <Panel>
      <div className="flex items-end gap-1.5">
        <div className="shrink-0">
          <div className="cell h-[22px] w-[22px] rounded" style={{ background: 'var(--status-weak)' }} />
          <p className="mt-2 text-[10px]" style={{ color: 'var(--text-faint)' }}>
            wrong
          </p>
        </div>
        {stops.map((s, i) => (
          <div key={s} className="flex-1" style={{ flexGrow: i + 1 }}>
            <div className="flex items-center gap-1">
              <span className="h-px flex-1" style={{ background: 'var(--border-strong)' }} />
              <span
                className="cell h-[9px] w-[9px] shrink-0 rounded-full"
                style={{
                  background: i === stops.length - 1 ? 'var(--status-proficient)' : 'var(--border-strong)',
                  animationDelay: `${i * 140}ms`,
                }}
              />
            </div>
            <p className="mt-2 text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {s}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** 05 — one line of the plan, with the reason it is on it. */
function Direction() {
  return (
    <Panel>
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] font-medium">1h 30m tonight</span>
        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          85 min planned
        </span>
      </div>
      <div className="mt-2.5 flex items-start gap-2.5">
        <span className="mt-[3px] h-[26px] w-[3px] shrink-0 rounded-full" style={{ background: 'var(--status-weak)' }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium">Circular motion and gravitation</p>
          <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            Weak · unlocks 4 later topics
          </p>
        </div>
        <span className="shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
          35 min
        </span>
      </div>
    </Panel>
  )
}

/** 06 — the gap, and how much syllabus the number rests on. */
function Prediction() {
  return (
    <Panel>
      <div className="flex items-end gap-5">
        {[
          ['Predicted', '5', 'var(--status-developing)'],
          ['Target', '7', 'var(--brand)'],
        ].map(([label, n, tone]) => (
          <div key={label}>
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
              {label}
            </p>
            <p className="text-[22px] font-semibold leading-none tabular-nums" style={{ color: tone }}>
              {n}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <span className="block h-[5px] overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
          <span className="grow block h-full rounded-full" style={{ width: '18%', background: 'var(--status-developing)' }} />
        </span>
        <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-faint)' }}>
          Low confidence · 3 quizzes so far
        </p>
      </div>
    </Panel>
  )
}

const BY_INDEX = [SelfMarking, Decay, TwoJobs, Spacing, Direction, Prediction]

export default function ReasonGraphic({ n }) {
  const Inner = BY_INDEX[n]
  return Inner ? <Inner /> : null
}
