import { Fragment } from 'react'
import Counting from '@/components/Counting'
import SyllabiMark from '@/components/SyllabiMark'

/**
 * Layout primitives. Every dashboard page composes these rather than
 * hand-rolling padding and headings, which is what keeps the vertical rhythm
 * and container widths identical across the app — and what makes it possible
 * to restyle the whole product by editing this file.
 *
 * These now carry the landing page's language: a display title at tight
 * tracking, uppercase micro-labels above sections, hairlines instead of boxes
 * around everything, and panels with an edge rather than a shadow. The rule
 * behind all of it is that a page should have one thing that is obviously
 * first, and everything else should look like reference.
 */

const WIDTHS = {
  narrow: 'max-w-2xl',  // forms, single-column reading
  default: 'max-w-4xl', // lists, syllabus
  wide: 'max-w-6xl',    // dashboards, grids
}

export function Page({ children, width = 'default' }) {
  return (
    // The bottom padding is clearance for the floating buttons. On a desktop
    // they sit in dead space at the corner of a wide page; on a phone they
    // are directly over the last row of whatever you were reading, and the
    // page has to end above them rather than behind them.
    <div
      className={`app-enter mx-auto px-5 pt-8 pb-24 md:px-12 md:pt-10 md:pb-16 ${WIDTHS[width]}`}
    >
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, action, eyebrow }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p
            className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'var(--text-faint)' }}
          >
            {eyebrow}
          </p>
        )}
        <h1 className="text-[clamp(1.7rem,3.4vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`mb-12 ${className}`}>
      {(title || action) && (
        <div
          className="mb-5 flex items-baseline justify-between gap-4 border-b pb-3"
          style={{ borderColor: 'var(--border)' }}
        >
          {title && (
            <h2 className="text-[15px] font-semibold tracking-[-0.012em]">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * A row list without a box around it.
 *
 * The app wrapped every list in a card and then ruled between the rows, which
 * is two kinds of separation doing one job and is most of what made the
 * interface feel heavy. Rows sit on the page and light up on hover instead.
 */
export function Rows({ children, className = '' }) {
  return <ul className={`flex flex-col gap-0.5 ${className}`}>{children}</ul>
}

export function Row({ children, className = '', as: Tag = 'li' }) {
  return (
    <Tag className={className}>
      <div className="flex items-center gap-4 rounded-[10px] px-3 py-3.5">{children}</div>
    </Tag>
  )
}

/** Numbers as reference: no cards, grouped by a hairline, colour only where it means something. */
export function StatRow({ stats, className = '', countUp = false }) {
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-12 gap-y-6 border-t pt-6 ${className}`}
      style={{ borderColor: 'var(--border)' }}
    >
      {stats.map(({ label, value, tone }) => (
        <div key={label}>
          <p
            className="text-[30px] font-semibold leading-none tracking-[-0.028em] tabular-nums"
            style={{ color: tone || 'var(--text)' }}
          >
            {countUp ? <Counting to={value} /> : value}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  )
}

/** Bordered white panel. `flush` removes padding for full-bleed lists. */
export function Card({ children, className = '', interactive = false, flush = false }) {
  return (
    <div
      className={`elev rounded-[12px] border ${interactive ? 'surface-interactive' : ''} ${flush ? '' : 'p-5'} ${className}`}
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      {children}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div
      className="rounded-[12px] border border-dashed px-6 py-12 text-center"
      style={{ borderColor: 'var(--border-strong)' }}
    >
      <p className="text-[16px] font-semibold tracking-[-0.015em]">{title}</p>
      {description && (
        <p
          className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-7 flex justify-center">{action}</div>}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Loading states.

   Each skeleton is drawn from the page it stands in for: the same container
   widths, the same paddings and radii, and each line of text as a box the
   height of that line with a bone in the middle of it, the way the glyphs sit.
   That is what keeps the page still when the data lands. A skeleton that is
   roughly the right shape still jumps by the difference, and a page that jumps
   on arrival reads as one that broke and fixed itself.

   Static words (section titles, a fixed subtitle) are drawn as words, not
   bones: there is nothing to wait for, and a heading that is already right is
   one less thing to change.
   -------------------------------------------------------------------------- */

const range = (n) => Array.from({ length: n }, (_, i) => i)

// Widths that vary down a list without being random, so the server and the
// browser draw the same thing.
const vary = (i, base, spread) => `${base + ((i * 37) % spread)}%`

const px = (v) => (typeof v === 'number' ? `${v}px` : v)

// A bone that is hidden below some width carries `hidden sm:block` of its own;
// adding `block` as well would leave the two fighting over which comes last.
const shown = (className, display) => (/(^|\s)hidden(\s|$)/.test(className) ? '' : display)

/** One bone. A span, so it can sit inside a heading or a paragraph. */
export function SkeletonLine({ width = '100%', height = 16, className = '', style }) {
  return <span className={`skeleton ${shown(className, 'block')} ${className}`} style={{ width, height, ...style }} />
}

/**
 * A line of text at a given size and leading: the box is the line's height,
 * the bone is the height of the letters. Size takes a number of pixels or any
 * CSS length, so a heading set with clamp() is mirrored with the same clamp().
 */
export function SkeletonText({ size = 14, leading = 1.5, width = '60%', className = '' }) {
  const fs = px(size)
  return (
    <span className={`${shown(className, 'flex')} items-center ${className}`} style={{ height: `calc(${fs} * ${leading})` }}>
      <span className="skeleton block max-w-full rounded-[4px]" style={{ width, height: `calc(${fs} * 0.62)` }} />
    </span>
  )
}

const CONTROL = { sm: 32, md: 40, lg: 44 }

/** A button, at one of the three control heights the real ones use. */
function SkeletonButton({ width = 112, size = 'md', className = '' }) {
  return <SkeletonLine width={width} height={CONTROL[size]} className={`shrink-0 rounded-full ${className}`} />
}

function SkeletonCircle({ size = 24, className = '' }) {
  return <span className={`skeleton ${shown(className, 'block')} shrink-0 rounded-full ${className}`} style={{ width: size, height: size }} />
}

/** A ring: a circle with its middle masked out, so the sweep still runs round it. */
function SkeletonRing({ size = 46, stroke = 4 }) {
  const mask = `radial-gradient(circle, transparent ${size / 2 - stroke - 0.5}px, #000 ${size / 2 - stroke}px)`
  return (
    <span
      className="skeleton block shrink-0 rounded-full"
      style={{ width: size, height: size, maskImage: mask, WebkitMaskImage: mask }}
    />
  )
}

/** A card, with the edge, fill and lift of the real ones. */
function SkeletonPanel({ radius = 12, elev = 'elev', className = '', children, border = 'var(--border-strong)' }) {
  return (
    <div
      className={`${elev} border ${className}`}
      style={{ borderRadius: radius, borderColor: border, background: 'var(--surface)' }}
    >
      {children}
    </div>
  )
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {range(rows).map((i) => (
        <div key={i} className="flex items-center gap-4 border-b py-3.5" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0 flex-1">
            <SkeletonText size={11.5} width={vary(i, 30, 20)} />
            <SkeletonText size={14} width={vary(i, 50, 30)} className="mt-1" />
          </div>
          <SkeletonText size={12} width={60} />
        </div>
      ))}
    </div>
  )
}

/** Numbers under a rule, the shape StatRow makes. */
export function SkeletonStats({ count = 4, className = 'mb-12' }) {
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-12 gap-y-6 border-t pt-6 ${className}`}
      style={{ borderColor: 'var(--border)' }}
      aria-hidden="true"
    >
      {range(count).map((i) => (
        <div key={i}>
          <SkeletonLine width={40} height={30} />
          <SkeletonText size={13} width={64} className="mt-2" />
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- dashboard */

const WEEK = [38, 62, 24, 80, 50, 8, 8]

/**
 * The streak card: the flame, the count and today's ring on one side, the
 * week's bars on the other, the next badge along the bottom. Exported because
 * the card loads its own numbers and draws this while it does, so the
 * dashboard's skeleton and the card's are the same shape.
 */
export function SkeletonStreak({ id }) {
  return (
    <section
      id={id}
      aria-hidden="true"
      className="elev mb-10 scroll-mt-24 overflow-hidden rounded-[18px] border"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-3.5">
            <SkeletonLine width={48} height={48} className="shrink-0 rounded-[14px]" />
            <div className="min-w-0 flex-1">
              <SkeletonLine width={126} height={26} />
              <SkeletonText size={12} width={140} className="mt-1" />
            </div>
            <SkeletonRing size={58} stroke={5} />
          </div>
          <SkeletonText size={13.5} leading={1.625} width="78%" className="mt-5" />
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <SkeletonButton size="sm" width={148} />
            <SkeletonButton size="sm" width={104} />
          </div>
        </div>

        <div>
          <ol className="grid h-[104px] grid-cols-7 items-end gap-2 sm:h-[132px]">
            {WEEK.map((h, i) => (
              <li key={i} className="flex h-full flex-col justify-end">
                <span className="skeleton block w-full rounded-[8px]" style={{ height: `${h}%` }} />
              </li>
            ))}
          </ol>
          <ol className="mt-2 grid grid-cols-7 gap-2">
            {WEEK.map((_, i) => (
              <li key={i} className="flex flex-col items-center">
                <SkeletonText size={11} width={i === 6 ? 30 : 10} />
                <SkeletonText size={10.5} width={18} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-5 py-3.5 sm:px-6" style={{ borderColor: 'var(--border)' }}>
        <SkeletonText size={12.5} width={170} />
        <span className="skeleton block h-1.5 min-w-[6rem] flex-1 rounded-full" />
        <span className="flex gap-1">
          {range(8).map((i) => (
            <span key={i} className="skeleton block h-2 w-2 rounded-full" />
          ))}
        </span>
      </div>
    </section>
  )
}

/**
 * The orbit: a hub, the faint dotted ring and the topics round it, each with
 * its name beside it. A subject has six or so topics, which the map puts on a
 * single ring.
 */
function SkeletonOrbit({ planets = 5, hub = 'clamp(92px, 26vmin, 184px)', rx = 27, narrowRx = 34, ry = 34, labels = true }) {
  // The ring's width is a custom property so a phone can widen it: there the
  // names go above and below the planets rather than beside them, the way the
  // map lays them out under 520px, and the ring takes the room they leave.
  const label = (cls) => (
    <span className={`absolute w-[110px] flex-col gap-1.5 ${cls}`}>
      <SkeletonLine width="80%" height={9} />
      <SkeletonLine width="46%" height={7} />
    </span>
  )
  return (
    <div
      className="absolute inset-0 overflow-hidden [--rx:var(--rx-narrow)] sm:[--rx:var(--rx-wide)]"
      style={{ '--rx-narrow': `${narrowRx}%`, '--rx-wide': `${rx}%` }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-[8%]"
        style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--brand) 9%, transparent), transparent)' }}
      />
      {/* Dotted CSS rather than SVG: the box stretches with the canvas, and
          dashes on a stretched SVG stroke vanish. */}
      <span
        className="absolute rounded-[50%] border border-dotted"
        style={{ left: 'calc(50% - var(--rx))', right: 'calc(50% - var(--rx))', top: `${50 - ry}%`, bottom: `${50 - ry}%`, borderColor: 'var(--border-strong)' }}
      />
      {range(planets).map((i) => {
        const a = -Math.PI / 2 + (i / planets) * 2 * Math.PI
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        const size = 40 + ((i * 11) % 22)
        // The name goes outward: beside the planet at the sides, above it at the top.
        const side = Math.abs(cos) > 0.35
        const stacked = `left-1/2 -translate-x-1/2 items-center ${sin < 0 ? 'bottom-full mb-2' : 'top-full mt-2'}`
        return (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `calc(50% + var(--rx) * ${cos.toFixed(4)})`, top: `${50 + ry * sin}%` }}
          >
            <SkeletonRing size={size} stroke={3} />
            {labels &&
              (side ? (
                <>
                  {label(`flex sm:hidden ${stacked}`)}
                  {label(`hidden sm:flex top-1/2 -translate-y-1/2 ${cos > 0 ? 'left-full ml-2' : 'right-full mr-2 items-end'}`)}
                </>
              ) : (
                label(`flex ${stacked}`)
              ))}
          </span>
        )
      })}
      <span
        className="absolute left-1/2 top-1/2 flex aspect-square -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-full border"
        style={{
          width: hub,
          borderColor: 'var(--border-strong)',
          background: 'var(--surface)',
          boxShadow: '0 0 0 3px var(--bg), 0 0 0 7px var(--border), 0 10px 40px -12px rgba(0,0,0,0.35)',
        }}
      >
        <SkeletonLine width="34%" height={7} />
        <SkeletonLine width="56%" height={11} />
        <SkeletonLine width="40%" height={8} />
      </span>
    </div>
  )
}

/**
 * The dashboard, top to bottom: the next step, the streak, the ways to study,
 * the three cards, time studied, the next three, and the subjects beside the
 * map. Every section is drawn, because a used account shows all of them and a
 * skeleton that leaves some out makes the page grow under you as it loads.
 */
export function SkeletonDashboard() {
  return (
    <div aria-hidden="true">
      <SkeletonPanel radius={16} elev="elev-lg" className="mb-8 p-6 sm:p-7">
        <SkeletonText size={10.5} width={140} />
        <SkeletonText size="clamp(1.35rem,2.8vw,1.8rem)" leading={1.25} width="56%" className="mt-3" />
        <SkeletonText size={13.5} width="40%" className="mt-2" />
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <SkeletonButton size="lg" width={150} />
          <SkeletonButton size="md" width={124} />
        </div>
      </SkeletonPanel>

      <SkeletonStreak />

      <Section title="Ways to study">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {range(8).map((i) => (
            <li key={i}>
              <SkeletonPanel radius={14} className="flex h-full flex-col p-4">
                <SkeletonLine width={36} height={36} className="rounded-[10px]" />
                <SkeletonText size={14} width={vary(i, 40, 30)} className="mt-3.5" />
                <SkeletonText size={12} leading={1.375} width="94%" className="mt-1" />
                <SkeletonText size={12} leading={1.375} width={vary(i, 36, 40)} />
                {/* The last door's line is the long one, and runs to three. */}
                {i === 7 && <SkeletonText size={12} leading={1.375} width="48%" />}
              </SkeletonPanel>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        <SkeletonPanel radius={14} className="flex items-center gap-4 p-5">
          <SkeletonRing size={46} stroke={4} />
          <div className="min-w-0 flex-1">
            <SkeletonText size={13} width="68%" />
            <SkeletonText size={12.5} width="52%" className="mt-1" />
          </div>
        </SkeletonPanel>
        {[0, 1].map((i) => (
          <SkeletonPanel key={i} radius={14} className="p-5">
            <SkeletonLine width={36} height={26} />
            <SkeletonText size={13} width="50%" className="mt-2" />
            <SkeletonText size={12.5} width="72%" className="mt-1" />
          </SkeletonPanel>
        ))}
      </div>

      <Section title="Time studied" action={<SkeletonLine width={84} height={9} />}>
        <SkeletonPanel radius={16} elev="" className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {range(4).map((i) => (
              <div key={i}>
                <SkeletonText size={11} width="55%" />
                <SkeletonText size={18} leading={24 / 18} width="40%" className="mt-0.5" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <SkeletonLine width={170} height={28} className="rounded-[10px]" />
            <span className="flex gap-1.5">
              {range(5).map((i) => (
                <span key={i} className="skeleton block h-2.5 w-2.5 rounded-[3px]" />
              ))}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-[3px] sm:gap-1">
            {range(5).map((i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-3">
                <SkeletonText size={10} width={28} className="w-10 shrink-0" />
                {/* One bone per row, cut into the 31 days by a repeating mask
                    rather than 31 elements each running its own sweep. */}
                <span
                  className="skeleton block h-3.5 flex-1 rounded-none sm:h-[18px]"
                  style={{
                    maxWidth: 31 * 23,
                    maskImage: 'linear-gradient(90deg, #000 calc(100% - 3px), transparent 0)',
                    WebkitMaskImage: 'linear-gradient(90deg, #000 calc(100% - 3px), transparent 0)',
                    maskSize: 'calc(100% / 31) 100%',
                    WebkitMaskSize: 'calc(100% / 31) 100%',
                  }}
                />
              </div>
            ))}
          </div>
        </SkeletonPanel>
      </Section>

      <Section title="After that" action={<SkeletonLine width={56} height={9} />}>
        <ul className="flex flex-col">
          {range(3).map((i) => (
            <li key={i} className="flex items-center gap-3 border-b py-3 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              <span className="skeleton block h-1.5 w-1.5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <SkeletonText size={11.5} width={vary(i, 22, 14)} />
                <SkeletonText size={13.5} width={vary(i, 46, 26)} className="mt-0.5" />
              </div>
              <SkeletonButton size="sm" width={56} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Your subjects" action={<SkeletonLine width={150} height={9} />}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            <div className="relative h-[420px] overflow-hidden rounded-[18px] border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <SkeletonOrbit planets={5} hub="clamp(84px, 26%, 120px)" rx={30} narrowRx={34} ry={33} labels={false} />
            </div>
            <SkeletonText size={13} width={120} className="mt-3" />
          </div>
          <div className="min-w-0">
            <SkeletonText size={12} width={150} className="mb-2" />
            <ul className="flex flex-col">
              {range(6).map((i) => (
                <li key={i} className="flex items-center gap-1 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="flex min-w-0 flex-1 items-center gap-4 px-2 py-3">
                    <SkeletonText size={13.5} width={vary(i, 36, 30)} className="min-w-0 flex-1" />
                    <span className="skeleton hidden h-1 w-20 shrink-0 rounded-full sm:block" />
                    <SkeletonText size={12.5} width={28} className="w-10 shrink-0 justify-end" />
                  </span>
                  <span className="h-9 w-9 shrink-0" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  )
}

/* ---------------------------------------------------------------- analytics */

function AnalyticsCard({ title, aside = true, children, className = '' }) {
  return (
    <SkeletonPanel radius={20} className={`p-5 sm:p-6 ${className}`}>
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside && <SkeletonLine width={52} height={8} />}
      </header>
      {children}
    </SkeletonPanel>
  )
}

/** Stacked bars over time, with the row of dates under them. */
function SkeletonBarChart({ bars = 24, height = 220 }) {
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {range(bars).map((i) => (
          <span key={i} className="skeleton block flex-1 rounded-[4px]" style={{ height: `${12 + ((i * 41) % 70)}%` }} />
        ))}
      </div>
      <div className="flex h-5 items-end justify-between">
        {range(6).map((i) => (
          <SkeletonLine key={i} width={26} height={7} />
        ))}
      </div>
    </div>
  )
}

/** Labelled horizontal bars, four to a card. */
function SkeletonHBars({ rows = 4 }) {
  return (
    <div className="flex flex-col gap-[10px]">
      {range(rows).map((i) => (
        <div key={i} className="flex h-[18px] items-center gap-3">
          <SkeletonLine width={84} height={8} className="shrink-0" />
          <span className="flex-1">
            <SkeletonLine width={vary(i, 30, 60)} height={10} className="rounded-full" />
          </span>
          <SkeletonLine width={28} height={8} className="shrink-0" />
        </div>
      ))}
    </div>
  )
}

function SkeletonLegendList({ rows = 4 }) {
  return (
    <ul className="flex w-full min-w-0 flex-1 flex-col gap-2.5">
      {range(rows).map((i) => (
        <li key={i} className="flex items-center gap-2.5">
          <span className="skeleton block h-2.5 w-2.5 shrink-0 rounded-[3px]" />
          <SkeletonText size={13} width={vary(i, 40, 30)} className="min-w-0 flex-1" />
          <SkeletonText size={12.5} width={40} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Analytics has its own header, a size down from the other pages with the
 * subject and period controls beside it, so this draws that rather than the
 * shared one. Then the six numbers and the charts, card for card.
 */
export function SkeletonAnalytics({ title = 'Analytics', subtitle }) {
  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-semibold tracking-[-0.03em]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <SkeletonButton width={160} />
          <span className="flex gap-0.5 rounded-full p-0.5" style={{ background: 'var(--surface-sunken)' }}>
            {range(5).map((i) => (
              <span key={i} className="flex h-[30.75px] items-center px-3">
                <SkeletonLine width={16} height={8} />
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {range(6).map((i) => (
            <SkeletonPanel key={i} radius={18} className="p-4 sm:p-5">
              <SkeletonText size={11.5} width={vary(i, 45, 30)} />
              <SkeletonLine width="48%" height="clamp(1.4rem,3vw,1.85rem)" className="mt-2" />
              <SkeletonText size={12} width={vary(i, 60, 30)} className="mt-1.5" />
            </SkeletonPanel>
          ))}
        </div>

        <AnalyticsCard title="Study time">
          <SkeletonBarChart />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {range(4).map((i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="skeleton block h-2.5 w-2.5 rounded-[3px]" />
                <SkeletonText size={12} width={70} />
              </span>
            ))}
          </div>
        </AnalyticsCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Time by subject">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <SkeletonRing size={176} stroke={22} />
              <SkeletonLegendList />
            </div>
          </AnalyticsCard>
          <AnalyticsCard title="Accuracy">
            <SkeletonLine height={150} className="rounded-[10px]" />
            <div className="mt-5">
              <SkeletonHBars />
            </div>
          </AnalyticsCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <AnalyticsCard title="Focus activity">
            <SkeletonLine height={167} className="rounded-[10px]" />
            <SkeletonLine height={58} className="mt-2 rounded-[12px]" />
          </AnalyticsCard>
          <AnalyticsCard title="Focus sessions">
            <SkeletonHBars />
            <ul className="mt-5 flex flex-col">
              {range(6).map((i) => (
                <li key={i} className="flex items-center gap-2.5 border-t py-2 first:border-t-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="skeleton block h-2 w-2 shrink-0 rounded-full" />
                  <SkeletonText size={12.5} width={vary(i, 36, 30)} className="min-w-0 flex-1" />
                  <SkeletonText size={11.5} width={40} />
                  <SkeletonText size={12.5} width={30} />
                </li>
              ))}
            </ul>
          </AnalyticsCard>
        </div>

        <AnalyticsCard title="Streak" aside={false}>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {range(4).map((i) => (
              <div key={i} className={`flex h-[71px] items-center gap-3.5 rounded-[16px] p-3.5 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`} style={{ background: 'var(--surface-sunken)' }}>
                {i === 0 && <SkeletonCircle size={28} />}
                <div className="min-w-0 flex-1">
                  <SkeletonLine width={40} height={22} />
                  <SkeletonText size={11.5} width="70%" className="mt-1" />
                </div>
              </div>
            ))}
          </div>
          <SkeletonLine height={356} className="rounded-[12px]" />
          <SkeletonText size={11.5} width={260} className="mt-1" />
        </AnalyticsCard>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- flashcards */

function SkeletonDeckCard({ i, ready = false }) {
  return (
    <li>
      <SkeletonPanel radius={16} className="flex h-full flex-col p-5">
        <SkeletonText size={14.5} leading={1.375} width={vary(i, 50, 34)} />
        <SkeletonLine width={ready ? 64 : 40} height={26} className={ready ? 'mt-4' : 'mt-5'} />
        <SkeletonText size={12} width={ready ? '58%' : 34} className="mt-1" />
        <SkeletonLine height={6} className="mt-4 rounded-full" />
        {ready && <SkeletonText size={11.5} width="44%" className="mt-1.5" />}
      </SkeletonPanel>
    </li>
  )
}

/** Flashcards: your cards, your decks, then the ready-made shelf. */
export function SkeletonFlashcards() {
  return (
    <div>
      <SkeletonPanel radius={20} elev="elev-lg" className="mb-10 overflow-hidden">
        <div aria-hidden="true" className="grid gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-center">
          <div>
            <SkeletonText size={10.5} width={80} />
            <div className="mt-2 flex items-end gap-2.5">
              <SkeletonLine width={84} height="clamp(2.2rem,5vw,2.9rem)" />
              <SkeletonText size={14} width={64} />
            </div>
            <div className="mt-2.5 max-w-sm">
              <SkeletonText size={13} width="100%" />
              <SkeletonText size={13} width="86%" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <SkeletonLine width={190} height={36} className="rounded-full" />
              <SkeletonButton width={92} />
            </div>
          </div>
          <div className="rounded-[16px] p-4" style={{ background: 'var(--surface-sunken)' }}>
            <SkeletonText size={11.5} width={150} className="mb-3" />
            <div className="flex h-24 items-end gap-1.5">
              {[54, 30, 40, 22, 12, 34].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <SkeletonText size={11} width={10} />
                  <span className="skeleton block w-full rounded-[6px]" style={{ height: h }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {range(6).map((i) => (
                <SkeletonText key={i} size={10} width="70%" className="flex-1 justify-center" />
              ))}
            </div>
          </div>
        </div>
      </SkeletonPanel>

      <section className="mb-12">
        <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">Your decks</h2>
        <ul aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {range(3).map((i) => (
            <SkeletonDeckCard key={i} i={i} />
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Ready-made decks</h2>
          <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            Every subtopic of your subjects, checked before anyone sees it. Open a subject to pick what to study.
          </span>
        </div>
        <ul aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {range(6).map((i) => (
            <SkeletonDeckCard key={i} i={i + 3} ready />
          ))}
        </ul>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ syllabi */

/** Syllabi's hub: the subjects in orbit round the mark. */
function SkeletonHub() {
  return (
    <div className="relative h-[168px] w-[168px]">
      <div className="absolute inset-0 rounded-full border" style={{ borderColor: 'var(--border-strong)' }} />
      <div className="absolute inset-[34px] rounded-full border border-dashed" style={{ borderColor: 'var(--border)' }} />
      {range(6).map((i) => {
        const a = (i / 6) * 2 * Math.PI - Math.PI / 2
        return (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%` }}
          >
            <SkeletonCircle size={32} />
          </span>
        )
      })}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <SkeletonCircle size={60} />
      </span>
    </div>
  )
}

/**
 * Syllabi fills the screen rather than sitting in a page, so this does too:
 * the title and its tabs, the saved chats down the side on a wide screen, and
 * the new-chat screen (the hub, the question, the composer) in the middle,
 * which is where coming back to Syllabi now always starts.
 */
export function SkeletonSyllabi() {
  return (
    <div className="app-enter mx-auto flex h-[calc(100dvh-56px)] w-full max-w-7xl flex-col px-4 pb-4 pt-4 md:h-dvh md:px-8 md:pb-5 md:pt-6">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-0.025em]">
          <SkeletonLine width={66} height={36} className="mr-1 rounded-full lg:hidden" />
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--brand)', color: '#fff' }}>
            <SyllabiMark size={15} />
          </span>
          Syllabi
        </h1>
        <span className="flex rounded-full p-1" style={{ background: 'var(--surface-sunken)' }} aria-hidden="true">
          {[24, 92, 32].map((w, i) => (
            <span key={i} className="flex h-[31.5px] items-center px-4">
              <SkeletonLine width={w} height={9} />
            </span>
          ))}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 gap-5" aria-hidden="true">
        <aside className="hidden w-64 shrink-0 flex-col border-r pr-5 lg:flex" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-3 flex shrink-0 gap-2">
            <SkeletonLine height={40} className="flex-1 rounded-[12px]" width="auto" />
            <SkeletonLine width={40} height={40} className="rounded-[12px]" />
          </div>
          {range(6).map((i) => (
            <div key={i}>
              {/* The chats come in groups (folders, today, this week), each under a small label. */}
              {i % 2 === 0 && <SkeletonText size={10.5} width={i ? 64 : 56} className="mb-1 mt-3 px-2" />}
              <div className="flex items-center gap-2 py-2 pl-2 pr-8">
                <SkeletonCircle size={24} />
                <span className="min-w-0 flex-1">
                  <SkeletonText size={13} width={vary(i, 55, 40)} />
                  <SkeletonText size={11} width={vary(i, 30, 20)} />
                </span>
              </div>
            </div>
          ))}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center pb-6">
          <SkeletonHub />
          <SkeletonText size="clamp(1.4rem,3vw,1.85rem)" width="min(19rem, 80%)" className="mt-7 w-full justify-center" />
          <SkeletonText size={13.5} width="min(18rem, 75%)" className="mt-2 w-full justify-center" />
          <div
            className="mt-7 w-full max-w-2xl rounded-[24px] border"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', boxShadow: '0 10px 40px -12px rgb(0 0 0 / 0.25)' }}
          >
            <div className="px-5 pb-2 pt-4">
              <SkeletonText size={15} leading={1.625} width="44%" />
            </div>
            <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
              <SkeletonCircle size={36} />
              <SkeletonLine width={112} height={36} className="rounded-full" />
              <span className="flex-1" />
              <SkeletonCircle size={36} />
            </div>
          </div>
          <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
            {[172, 160, 196].map((w, i) => (
              <SkeletonLine key={i} width={w} height={31} className="rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- map */

/**
 * The subject map: the toolbar, the outline down the left on a very wide
 * screen, the orbit with its key and the strip of what is next, and the
 * details panel from a laptop up, which opens empty until something is picked
 * and so is drawn with its own words. It fills the screen like the map does,
 * so nothing reflows when it arrives.
 */
export function SkeletonMap() {
  return (
    <div className="flex h-[calc(100dvh-56px)] min-h-0 flex-col md:h-dvh">
      <div className="flex h-14 shrink-0 items-center gap-1.5 border-b px-3 sm:px-4" style={{ borderColor: 'var(--border)' }} aria-hidden="true">
        <SkeletonCircle size={36} />
        <span className="skeleton block h-9 w-[9.5rem] shrink-0 rounded-full sm:w-[13rem]" />
        <span className="ml-1 hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <SkeletonLine width={64} height={9} />
        </span>
        <span className="flex-1 md:hidden" />
        <span className="skeleton block h-9 w-9 shrink-0 rounded-full sm:w-[104px]" />
        <SkeletonCircle size={36} />
        <SkeletonCircle size={36} />
        <SkeletonCircle size={36} className="hidden sm:block" />
        <SkeletonCircle size={36} className="hidden lg:block" />
      </div>

      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-[272px] shrink-0 border-r px-4 py-4 2xl:block" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-hidden="true">
          <SkeletonLine height={36} className="mb-4 rounded-full" />
          {range(5).map((t) => (
            <div key={t} className="mb-3">
              <div className="flex items-center gap-2 py-1.5">
                <SkeletonCircle size={8} />
                <SkeletonText size={13} width={vary(t, 50, 30)} className="flex-1" />
                <SkeletonText size={11} width={24} />
              </div>
              {t < 2 &&
                range(3).map((u) => (
                  <div key={u} className="flex items-center gap-2 py-1 pl-5">
                    <SkeletonCircle size={6} />
                    <SkeletonText size={12.5} width={vary(u + t, 40, 36)} className="flex-1" />
                  </div>
                ))}
            </div>
          ))}
        </aside>

        <section className="relative min-w-0 flex-1" style={{ background: 'var(--bg)' }} aria-hidden="true">
          <SkeletonOrbit />
          <span className="absolute right-4 top-4 hidden max-w-[16rem] flex-wrap justify-end gap-x-3 gap-y-2 sm:flex">
            {[52, 58, 62, 34, 36, 50].map((w, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="skeleton block h-1.5 w-1.5 rounded-full" />
                <SkeletonLine width={w - 12} height={7} />
              </span>
            ))}
          </span>
          <span
            className="absolute bottom-4 left-1/2 flex h-[38px] w-[min(19rem,calc(100%-120px))] -translate-x-1/2 items-center gap-2 rounded-full border pl-3 pr-1.5"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <SkeletonLine width={30} height={7} />
            <SkeletonLine height={9} className="flex-1" />
          </span>
        </section>

        <aside className="hidden w-[340px] shrink-0 border-l lg:block" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p className="text-[13.5px] font-medium">Select anything on the map</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
              Its level, what is inside it and what to do next appear here. Double-click a topic, or use its arrow, to open its own map.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- test and quiz */

/** Build a Test: the five steps, the first question, its choices, the way on. */
export function SkeletonTestBuilder({ rows = 4 }) {
  return (
    <div className="mx-auto max-w-2xl" aria-hidden="true">
      <div className="mb-10 flex items-center gap-1.5">
        {range(5).map((i) => (
          <div key={i} className="flex flex-1 flex-col gap-2">
            <span className="skeleton block h-[3px] w-full rounded-full" />
            <SkeletonText size={11} width={vary(i, 36, 24)} />
          </div>
        ))}
      </div>
      <SkeletonText size="clamp(1.35rem,3vw,1.75rem)" leading={1.25} width="44%" />
      <SkeletonText size={14} leading={1.625} width="34%" className="mt-2.5" />
      <div className="mt-8 flex flex-col gap-2">
        {range(rows).map((i) => (
          <div key={i} className="flex items-start gap-4 rounded-[12px] border px-5 py-4" style={{ borderColor: 'var(--border-strong)' }}>
            <SkeletonCircle size={18} className="mt-[3px]" />
            <SkeletonText size={15} width={vary(i, 36, 30)} className="flex-1" />
          </div>
        ))}
      </div>
      <div className="mt-10 flex items-center gap-3 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
        <SkeletonButton width={84} />
        <SkeletonText size={12.5} width={40} className="flex-1 justify-center" />
        <SkeletonButton width={84} />
      </div>
    </div>
  )
}

/** A quiz question: the rail and where you are on it, the stem, four options. */
export function SkeletonQuiz() {
  return (
    <div aria-hidden="true">
      <div className="mb-6">
        <div className="flex gap-1">
          {range(10).map((i) => (
            <span key={i} className="skeleton block h-1 flex-1 rounded-full" />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <SkeletonText size={12.5} width={110} />
          <SkeletonText size={12.5} width={44} />
        </div>
      </div>
      <SkeletonText size={17} leading={1.625} width="100%" />
      <SkeletonText size={17} leading={1.625} width="64%" />
      <div className="mt-6 flex flex-col gap-2">
        {range(4).map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: 'var(--border-strong)' }}>
            <SkeletonText size={14.5} leading={1.625} width={vary(i, 30, 40)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The quiz page before the questions arrive: the back link, then a question. */
function SkeletonQuizPage() {
  return (
    <>
      <SkeletonText size={13} width={52} className="mb-8" />
      <SkeletonQuiz />
    </>
  )
}

/* ---------------------------------------------------------- paper and lesson */

/** A predicted paper's cover: back, then the panel with its numbers and the start button. */
export function SkeletonPaper() {
  return (
    <div className="mx-auto w-full max-w-2xl" aria-hidden="true">
      <SkeletonButton size="sm" width={136} />
      <SkeletonPanel radius={20} elev="" className="mt-6 p-6 sm:p-8">
        <SkeletonText size={11} width="52%" />
        <SkeletonText size="clamp(1.6rem,4vw,2.1rem)" leading={1.15} width="78%" className="mt-2" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {range(3).map((i) => (
            <div key={i} className="flex flex-col items-center rounded-[14px] px-3 py-3" style={{ background: 'var(--surface-sunken)' }}>
              <SkeletonText size={17} width="54%" className="w-full justify-center" />
              <SkeletonText size={12} width="40%" className="w-full justify-center" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {range(2).map((i) => (
            <SkeletonText key={i} size={14.5} leading={1.625} width={vary(i, 62, 30)} />
          ))}
        </div>
        <div className="mt-5">
          <SkeletonText size={13.5} width="100%" />
          <SkeletonText size={13.5} width="62%" />
        </div>
        <SkeletonLine height={44} className="mt-6 rounded-full" />
      </SkeletonPanel>
    </div>
  )
}

/** A lesson's first screen: back and the tools, the frame rail, then the overview. */
export function SkeletonLesson() {
  return (
    <div className="mx-auto w-full max-w-2xl" aria-hidden="true">
      <div className="flex items-center justify-between gap-2">
        <SkeletonButton size="sm" width={128} />
        <div className="flex items-center gap-2">
          <SkeletonLine width={96} height={28} className="rounded-full" />
          <SkeletonButton size="sm" width={68} />
        </div>
      </div>
      <div className="mt-4 flex gap-1">
        {range(11).map((i) => (
          <span key={i} className="skeleton block h-1 flex-1 rounded-full" />
        ))}
      </div>
      <SkeletonPanel radius={22} elev="" className="mt-6 min-h-[52vh] p-5 sm:p-8">
        <SkeletonText size={11} width="46%" />
        <SkeletonText size="clamp(1.7rem,4.4vw,2.3rem)" leading={1.1} width="72%" className="mt-2" />
        <div className="mt-3">
          <SkeletonText size={18} leading={1.625} width="96%" />
          <SkeletonText size={18} leading={1.625} width="54%" />
        </div>
        <div className="mt-4">
          <SkeletonText size={16} leading={1.7} width="100%" />
          <SkeletonText size={16} leading={1.7} width="97%" />
          <SkeletonText size={16} leading={1.7} width="99%" />
          <SkeletonText size={16} leading={1.7} width="42%" />
        </div>
        <div className="mt-6 rounded-[18px] p-5" style={{ background: 'var(--surface-sunken)' }}>
          <SkeletonText size={12} width={200} />
          <div className="mt-3 flex flex-col gap-2.5">
            {range(5).map((i) => (
              <div key={i} className="flex gap-2.5">
                <SkeletonCircle size={15} className="mt-1" />
                <span className="min-w-0 flex-1">
                  <SkeletonText size={15.5} leading={1.625} width={i % 2 ? vary(i, 54, 36) : '100%'} />
                  {i % 2 === 0 && i < 4 && <SkeletonText size={15.5} leading={1.625} width={vary(i, 30, 30)} />}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SkeletonPanel>
      <div className="mt-5 flex items-center gap-3">
        <SkeletonButton width={84} />
        <span className="flex-1" />
        <SkeletonButton size="lg" width={110} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- the other pages */

/** Feedback: the four counts, then the messages with their line of detail. */
export function SkeletonFeedback({ rows = 5 }) {
  return (
    <div aria-hidden="true">
      <SkeletonStats count={4} />
      <ul className="flex flex-col">
        {range(rows).map((i) => (
          <li key={i} className="border-b py-5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <SkeletonText size={12} width={52} />
              <SkeletonText size={12} width={130} />
              <SkeletonText size={12} width={44} />
              <SkeletonText size={11.5} width={90} />
            </div>
            <SkeletonText size={14} leading={1.625} width="100%" />
            <SkeletonText size={14} leading={1.625} width={vary(i, 30, 50)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** My Subjects: the section, then a card per subject with its bar and button. */
export function SkeletonSubjects({ count = 6 }) {
  return (
    <Section title="Subjects">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {range(count).map((i) => (
          <SkeletonPanel key={i} className="flex flex-col p-5">
            <SkeletonText size={15.5} leading={1.375} width={vary(i, 50, 34)} />
            <SkeletonText size={13} width="40%" className="mt-1.5" />
            <div className="mb-6 mt-6">
              <div className="flex items-end gap-2">
                <SkeletonLine width={28} height={26} />
                <SkeletonText size={13} width={86} />
              </div>
              <SkeletonLine height={6} className="mt-4 rounded-full" />
              <div className="mt-3.5 flex gap-4">
                <SkeletonText size={11.5} width={70} />
                <SkeletonText size={11.5} width={56} />
              </div>
            </div>
            <SkeletonButton width="100%" className="mt-auto" />
          </SkeletonPanel>
        ))}
      </div>
    </Section>
  )
}

// Where the busy blocks sit in the week skeleton: [day, start hour from 06:00, hours].
const WEEK_BLOCKS = [
  [0, 3, 1.5], [1, 2, 2], [1, 9, 1], [2, 4, 1], [2, 11, 1.5], [3, 3, 2], [4, 2, 1.5], [4, 8, 1], [5, 5, 2], [6, 6, 1],
]
const HOUR = 45 // the week view draws 0.75px a minute

/** The calendar opens on the week: its header, the key, then the hours grid. */
export function SkeletonCalendar() {
  const cols = { gridTemplateColumns: '3rem repeat(7, minmax(0, 1fr))' }
  return (
    <div aria-hidden="true">
      <div className="mb-4 flex gap-2">
        <SkeletonButton size="sm" width={68} />
        <SkeletonButton size="sm" width={76} />
      </div>
      <section className="mb-12">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <SkeletonText size={15} width={150} />
            <SkeletonText size={12} width={110} />
          </div>
          <div className="flex items-center gap-1.5">
            <SkeletonButton size="sm" width={36} />
            <SkeletonButton size="sm" width={64} />
            <SkeletonButton size="sm" width={36} />
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {[78, 62, 110].map((w, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="skeleton block h-2.5 w-2.5 rounded-[3px]" />
              <SkeletonText size={11.5} width={w} />
            </span>
          ))}
        </div>
        <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-[640px]">
            <div className="grid border-b" style={{ ...cols, borderColor: 'var(--border)' }}>
              <div />
              {range(7).map((i) => (
                <div key={i} className="border-l px-1.5 pb-1.5 pt-2" style={{ borderColor: 'var(--border)' }}>
                  <SkeletonText size={11} width={24} />
                  <SkeletonCircle size={24} className="mt-0.5" />
                  <span className="mt-1 block h-[18px]" />
                </div>
              ))}
            </div>
            <div className="relative grid" style={{ ...cols, height: 18 * HOUR }}>
              <div className="relative">
                {range(17).map((h) => (
                  <span key={h} className="absolute right-1.5 -translate-y-1/2" style={{ top: (h + 1) * HOUR }}>
                    <SkeletonLine width={26} height={7} />
                  </span>
                ))}
              </div>
              {range(7).map((d) => (
                <div
                  key={d}
                  className="relative border-l"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundImage: 'linear-gradient(color-mix(in srgb, var(--border) 60%, transparent) 1px, transparent 1px)',
                    backgroundSize: `100% ${HOUR}px`,
                    backgroundPosition: `0 ${HOUR}px`,
                    backgroundRepeat: 'repeat-y',
                  }}
                >
                  {WEEK_BLOCKS.filter(([day]) => day === d).map(([, from, hours], n) => (
                    <span
                      key={n}
                      className="skeleton absolute inset-x-1 block rounded-[6px]"
                      style={{ top: from * HOUR + 1, height: hours * HOUR - 2 }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/** The Diploma core: three component cards, then each component's checklist. */
export function SkeletonCore() {
  return (
    <div aria-hidden="true">
      <div className="mb-10 grid gap-3 sm:grid-cols-3">
        {range(3).map((i) => (
          <SkeletonPanel key={i} elev="" className="p-4">
            <SkeletonText size={14.5} width="62%" />
            <SkeletonText size={12.5} leading={1.375} width="94%" className="mt-1.5" />
            <SkeletonText size={12.5} leading={1.375} width="50%" />
            <SkeletonLine width={52} height={22} className="mt-3" />
            <SkeletonLine height={4} className="mt-2 rounded-full" />
          </SkeletonPanel>
        ))}
      </div>
      {range(2).map((s) => (
        <section key={s} className="mb-8">
          <SkeletonText size={15} width={190} className="mb-3" />
          <SkeletonText size={11.5} width={100} className="mb-1.5" />
          <ul className="flex flex-col">
            {range(4).map((i) => (
              <li key={i} className="flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <SkeletonLine width={18} height={18} className="shrink-0 rounded-[5px]" />
                <SkeletonText size={14} leading={1.375} width={vary(i + s, 44, 40)} className="flex-1" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/**
 * Redemption: the waiting panel with its three stages, the line under it, when
 * the rest come back, then the questions grouped by subject.
 */
export function SkeletonRedemption({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      <SkeletonPanel radius={18} elev="elev-lg" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-5 p-6 sm:p-7">
          <div className="min-w-0">
            <SkeletonText size={10.5} width={110} />
            <div className="mt-2 flex items-end gap-2.5">
              <SkeletonLine width={56} height="clamp(2.2rem,5vw,2.9rem)" />
              <SkeletonText size={14} width={96} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SkeletonLine width="11rem" height={44} className="rounded-full" />
            <SkeletonButton size="lg" width={150} />
          </div>
        </div>
        <div className="grid grid-cols-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {range(3).map((i) => (
            <div key={i} className={`px-4 py-4 sm:px-6 ${i ? 'border-l' : ''}`} style={{ borderColor: 'var(--border)' }}>
              <span className="flex gap-1">
                {range(3).map((d) => (
                  <span key={d} className="skeleton block h-[7px] w-[7px] rounded-full" />
                ))}
              </span>
              <SkeletonLine width={26} height={22} className="mt-2.5" />
              <SkeletonText size={12} width="70%" className="mt-1.5" />
            </div>
          ))}
        </div>
      </SkeletonPanel>
      <SkeletonText size={12.5} width="66%" className="mt-3" />

      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {range(4).map((i) => (
          <SkeletonPanel key={i} radius={14} elev="" border="var(--border)" className="px-3.5 py-3">
            <SkeletonLine width={22} height={20} />
            <SkeletonText size={11.5} width="66%" className="mt-1.5" />
          </SkeletonPanel>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {range(2).map((g) => (
          <SkeletonPanel key={g} radius={16} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: 'var(--border)' }}>
              <SkeletonText size={14.5} width={vary(g, 36, 20)} className="min-w-0 flex-1" />
              <SkeletonText size={12} width={150} className="hidden sm:flex" />
            </div>
            <ul>
              {range(g === 0 ? rows : Math.max(2, rows - 2)).map((i) => (
                <li key={i} className="border-t first:border-t-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <SkeletonCircle size={24} />
                    <div className="min-w-0 flex-1">
                      <SkeletonText size={13.5} width={vary(i + g, 40, 34)} />
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="skeleton block h-1 w-24 rounded-full" />
                        <SkeletonText size={11} width={66} />
                      </span>
                    </div>
                    <SkeletonButton size="sm" width={86} />
                  </div>
                </li>
              ))}
            </ul>
          </SkeletonPanel>
        ))}
      </div>
    </div>
  )
}

/** Today's plan: the two views, the day's headline and timer, then the timeline. */
export function SkeletonPlan({ rows = 5 }) {
  return (
    <div aria-hidden="true">
      <div className="mb-8 flex flex-wrap gap-2">
        <SkeletonButton size="sm" width={68} />
        <SkeletonButton size="sm" width={124} />
      </div>
      <div className="mb-8">
        <SkeletonText size={11} leading={16 / 11} width={120} />
        <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-1">
          <SkeletonLine width={150} height="clamp(1.6rem,3.2vw,2.1rem)" />
          <SkeletonText size={13} width={130} />
        </div>
        <SkeletonLine height={4} className="mt-4 rounded-full" />
        <div className="mt-4 flex items-center gap-3">
          <SkeletonText size={20} width={58} className="w-[4.5rem] shrink-0" />
          <span className="skeleton block h-1 flex-1 rounded-full" />
          <SkeletonButton size="sm" width={64} />
        </div>
      </div>
      <ol className="relative">
        {range(rows).map((i) => (
          <Fragment key={i}>
            {/* A break between blocks of work, the way the plan spaces them. */}
            {(i === 2 || i === 4) && (
              <li className="flex items-center">
                <span className="w-16 shrink-0" />
                <span className="relative flex w-5 shrink-0 justify-center self-stretch">
                  <span className="w-px" style={{ backgroundImage: 'linear-gradient(var(--border-strong) 50%, transparent 0)', backgroundSize: '1px 6px' }} />
                </span>
                <span className="py-2 pl-3">
                  <SkeletonText size={11.5} width={60} />
                </span>
              </li>
            )}
            <li className="flex">
              <span className="flex w-16 shrink-0 justify-end pr-3 pt-3.5">
                <SkeletonText size={12} width={28} />
              </span>
              <span className="relative flex w-5 shrink-0 justify-center">
                <span
                  className="absolute inset-y-0 w-px"
                  style={{ background: 'var(--border)', top: i === 0 ? 18 : 0, bottom: i === rows - 1 ? 'calc(100% - 18px)' : 0 }}
                />
                <span className="skeleton relative mt-[15px] block h-[11px] w-[11px] rounded-full" />
              </span>
              <div className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <SkeletonText size={11.5} width={vary(i, 26, 20)} />
                  <SkeletonText size={15} leading={1.375} width={vary(i, 46, 34)} className="mt-0.5" />
                  <SkeletonText size={12} width={vary(i, 30, 30)} className="mt-1" />
                </div>
                <span className="flex shrink-0 items-center gap-1.5">
                  <SkeletonButton size="sm" width={62} />
                  <SkeletonCircle size={32} />
                </span>
              </div>
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  )
}

/** The predicted total and its three numbers, then the subjects and the targets. */
export function SkeletonPrediction() {
  const row = (i) => (
    <li key={i} className="flex flex-wrap items-center gap-4 border-b py-3.5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <div className="min-w-0 flex-1">
        <SkeletonText size={14} leading={20 / 14} width={vary(i, 40, 30)} />
        <SkeletonText size={12} leading={16 / 12} width={vary(i, 24, 20)} className="mt-1" />
      </div>
      <div className="flex items-center gap-4">
        {[0, 1].map((k) => (
          <div key={k} className="flex flex-col items-end">
            <SkeletonText size={12} leading={16 / 12} width={50} />
            <SkeletonText size={18} leading={28 / 18} width={18} />
          </div>
        ))}
        <SkeletonButton size="sm" width={60} />
      </div>
    </li>
  )
  return (
    <div aria-hidden="true">
      <div className="mb-14">
        <SkeletonText size={10.5} width={130} className="mb-3" />
        <div className="flex items-end gap-3">
          <SkeletonLine width={110} height="calc(clamp(3rem,9vw,4.5rem) * 0.95)" />
          <SkeletonText size={17} width={36} />
        </div>
        <div className="mt-8 flex flex-wrap gap-x-12 gap-y-5 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          {range(3).map((i) => (
            <div key={i}>
              <SkeletonText size={13} width={86} />
              <SkeletonLine width={52} height={22} className="mt-1.5" />
            </div>
          ))}
        </div>
        <SkeletonLine height={4} className="mt-6 rounded-full" />
        <SkeletonText size={14.5} leading={1.625} width="56%" className="mt-5" />
        <SkeletonText size={13} leading={1.625} width="84%" className="mt-2" />
      </div>
      <Section title="By subject">
        <ul className="flex flex-col">{range(5).map(row)}</ul>
      </Section>
    </div>
  )
}

/** Profile: the photo and its button, the details form, then the subjects. */
export function SkeletonForm({ rows = 6 }) {
  return (
    <div aria-hidden="true">
      <div className="mb-10 flex items-center gap-5">
        <SkeletonCircle size={80} />
        <div className="min-w-0 flex-1">
          <SkeletonButton width={128} />
          <SkeletonText size={12} leading={16 / 12} width="min(19rem, 90%)" className="mt-2" />
        </div>
      </div>
      <div className="mb-12 space-y-6 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
        <div>
          <SkeletonText size={14} width={72} className="mb-2" />
          <SkeletonLine height={40} className="rounded-[8px]" />
        </div>
        <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-3">
          {range(3).map((i) => (
            <div key={i}>
              <SkeletonText size={12.5} width={vary(i, 40, 20)} />
              <SkeletonText size={14} width={vary(i, 60, 30)} className="mt-1" />
            </div>
          ))}
        </div>
        <SkeletonButton width={120} />
      </div>
      <Section title="Subjects">
        <ul className="mb-5 flex flex-col">
          {range(rows).map((i) => (
            <li key={i} className="border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
              <SkeletonText size={14} width={vary(i, 30, 30)} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

/**
 * Each variant is the skeleton plus how much of the page it draws itself:
 * `header: false` for pages whose title sits inside their own panel (a paper,
 * a lesson, a quiz) or that set their own header (analytics); `page: false`
 * for the two that fill the screen instead of sitting in a page (Syllabi and
 * the map); `titleBar` where the title is not known until the data is, so the
 * heading is a bone rather than a word that is about to change.
 */
const LOADING_VARIANTS = {
  list: { Skeleton: ({ rows }) => <SkeletonRows rows={rows} /> },
  cards: { Skeleton: ({ rows }) => <SkeletonSubjects count={rows} /> },
  subjects: { Skeleton: ({ rows }) => <SkeletonSubjects count={rows} /> },
  plan: { Skeleton: ({ rows }) => <SkeletonPlan rows={rows} /> },
  calendar: { Skeleton: SkeletonCalendar },
  prediction: { Skeleton: SkeletonPrediction },
  form: { Skeleton: ({ rows }) => <SkeletonForm rows={rows} /> },
  dashboard: { Skeleton: SkeletonDashboard, titleBar: true },
  analytics: { Skeleton: SkeletonAnalytics, header: false },
  redemption: { Skeleton: ({ rows }) => <SkeletonRedemption rows={rows} /> },
  core: { Skeleton: SkeletonCore },
  flashcards: { Skeleton: SkeletonFlashcards },
  syllabi: { Skeleton: SkeletonSyllabi, page: false },
  map: { Skeleton: SkeletonMap, page: false },
  test: { Skeleton: ({ rows }) => <SkeletonTestBuilder rows={rows} /> },
  quiz: { Skeleton: SkeletonQuizPage, header: false },
  paper: { Skeleton: SkeletonPaper, header: false },
  lesson: { Skeleton: SkeletonLesson, header: false },
  feedback: { Skeleton: ({ rows }) => <SkeletonFeedback rows={rows} /> },
}

/** The names PageLoading knows, for the preview page. */
export const LOADING_VARIANT_NAMES = Object.keys(LOADING_VARIANTS)

/**
 * Full-page loading state.
 *
 * The real heading renders immediately so the page identity never changes
 * under you, and the skeleton mirrors the shape of whatever is coming. Pass
 * the page's own eyebrow and subtitle where they are fixed words, so those are
 * already right too; a subtitle that depends on the data is left as a bone.
 * `action` is drawn in the header's action slot, for the buttons beside a title.
 */
export function PageLoading({
  title,
  width = 'default',
  stats = false,
  rows = 4,
  variant = 'list',
  eyebrow,
  subtitle,
  action,
}) {
  const { Skeleton, header = true, page = true, titleBar = false } = LOADING_VARIANTS[variant] || LOADING_VARIANTS.list
  const status = (
    <span className="sr-only" role="status" aria-live="polite">
      Loading {title}
    </span>
  )
  if (!page) {
    return (
      <>
        <Skeleton rows={rows} title={title} subtitle={subtitle} />
        {status}
      </>
    )
  }
  return (
    <Page width={width}>
      {header && (
        <PageHeader
          eyebrow={eyebrow}
          title={
            titleBar ? (
              <>
                <span className="sr-only">{title}</span>
                <span aria-hidden="true" className="skeleton inline-block max-w-full align-middle" style={{ width: '17em', height: '0.72em', maxWidth: '80%' }} />
              </>
            ) : (
              title
            )
          }
          subtitle={
            subtitle ?? <span aria-hidden="true" className="skeleton inline-block max-w-full align-middle" style={{ width: 280, height: 9 }} />
          }
          action={action}
        />
      )}
      {stats && <SkeletonStats />}
      <Skeleton rows={rows} title={title} subtitle={subtitle} />
      {status}
    </Page>
  )
}

/** Buttons in a loading header, at the size the real ones are. */
export function SkeletonActions({ widths = [112], size = 'md' }) {
  return (
    <span className="flex flex-wrap gap-2" aria-hidden="true">
      {widths.map((w, i) => (
        <SkeletonButton key={i} width={w} size={size} />
      ))}
    </span>
  )
}

/** Inline spinner for buttons mid-action. Inherits button text color. */
export function Spinner({ size = 16 }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
      aria-hidden="true"
    />
  )
}
