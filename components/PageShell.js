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
    <div className={`app-enter mx-auto px-5 py-8 md:px-12 md:py-10 ${WIDTHS[width]}`}>{children}</div>
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
export function StatRow({ stats, className = '' }) {
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
            {value}
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
   Loading states. Skeletons mirror the shape of the content they replace so
   the layout does not shift when data arrives.
   -------------------------------------------------------------------------- */

export function SkeletonLine({ width = '100%', height = 16, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ width, height }} />
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b py-3.5"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0 flex-1">
            <SkeletonLine width={`${34 + ((i * 13) % 22)}%`} height={10} />
            <SkeletonLine width={`${52 + ((i * 17) % 26)}%`} height={13} className="mt-2" />
          </div>
          <SkeletonLine width={64} height={10} />
        </div>
      ))}
    </div>
  )
}

/** Numbers under a rule, the shape StatRow makes. */
export function SkeletonStats({ count = 4 }) {
  return (
    <div
      className="mb-12 flex flex-wrap gap-x-12 gap-y-6 border-t pt-6"
      style={{ borderColor: 'var(--border)' }}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <SkeletonLine width={44} height={26} />
          <SkeletonLine width={70} height={11} className="mt-3" />
        </div>
      ))}
    </div>
  )
}

/** The wheel, as a ring. */
/**
 * The dashboard: one card, three tiles, two columns.
 *
 * The old one drew a circle, because the dashboard used to open with a wheel.
 * The wheel went months ago and the skeleton kept promising it — a loading
 * state that lies about what is coming is worse than a plain box, because the
 * page appears to change its mind the moment it loads.
 */
export function SkeletonDashboard() {
  return (
    <div aria-hidden="true">
      <div
        className="rounded-[16px] border p-6"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        <SkeletonLine width={90} height={10} />
        <SkeletonLine width="55%" height={26} className="mt-4" />
        <SkeletonLine width="35%" height={13} className="mt-3" />
        <SkeletonLine width={190} height={40} className="mt-7 rounded-full" />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[14px] border p-5"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            <SkeletonLine width={46} height={26} />
            <SkeletonLine width="60%" height={12} className="mt-3" />
            <SkeletonLine width="80%" height={11} className="mt-2" />
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-x-14 gap-y-8 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col}>
            <SkeletonLine width={130} height={14} />
            <div className="mt-4 flex flex-col">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="skeleton h-1.5 w-1.5 shrink-0 rounded-full" />
                  <SkeletonLine width={`${50 + i * 8}%`} height={13} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Redemption: the waiting card, then rows that lead with their three dots. */
export function SkeletonRedemption({ rows = 5 }) {
  return (
    <div aria-hidden="true">
      <div
        className="rounded-[16px] border p-6"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        <SkeletonLine width={110} height={10} />
        <SkeletonLine width={180} height={34} className="mt-4" />
        <SkeletonLine width="60%" height={12} className="mt-3" />
        <SkeletonLine height={6} className="mt-6 rounded-full" />
      </div>

      <div className="mt-9 flex flex-col">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b py-3.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="flex shrink-0 gap-1.5">
              {[0, 1, 2].map((d) => (
                <span key={d} className="skeleton h-2 w-2 rounded-full" />
              ))}
            </span>
            <div className="min-w-0 flex-1">
              <SkeletonLine width="34%" height={10} />
              <SkeletonLine width={`${55 + (i % 3) * 10}%`} height={13} className="mt-2" />
            </div>
            <SkeletonLine width={62} height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The Diploma core: three component cards, then a checklist. */
export function SkeletonCore() {
  return (
    <div aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[12px] border p-4"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            <SkeletonLine width="70%" height={14} />
            <SkeletonLine width="90%" height={11} className="mt-2" />
            <SkeletonLine width={54} height={22} className="mt-4" />
            <SkeletonLine height={4} className="mt-3 rounded-full" />
          </div>
        ))}
      </div>
      <SkeletonLine width={200} height={15} className="mt-10" />
      <div className="mt-4 flex flex-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b py-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="skeleton h-[18px] w-[18px] shrink-0 rounded-[5px]" />
            <SkeletonLine width={`${45 + (i % 4) * 11}%`} height={13} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Grid of subject panels, each with a number and a bar. */
export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-[12px] border p-5"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <SkeletonLine width="65%" height={15} />
          <SkeletonLine width="40%" height={12} className="mt-2" />
          <SkeletonLine width={64} height={24} className="mt-5" />
          <SkeletonLine height={4} className="mt-3 rounded-full" />
          <SkeletonLine height={40} className="mt-6 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Today's session: the time control, the timer, then the checklist. */
export function SkeletonPlan({ rows = 5 }) {
  return (
    <div aria-hidden="true">
      <SkeletonLine width={220} height={34} className="mb-8 rounded-full" />
      <div
        className="rounded-[16px] border p-6"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        <SkeletonLine width={80} height={10} />
        <SkeletonLine width="55%" height={24} className="mt-3" />
        <SkeletonLine width="40%" height={12} className="mt-3" />
        <SkeletonLine height={6} className="mt-5 rounded-full" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[12px] border px-4 py-3.5"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            <SkeletonLine width={10} height={12} />
            <div className="skeleton h-5 w-5 shrink-0 rounded-[var(--r-sm)]" />
            <div className="min-w-0 flex-1">
              <SkeletonLine width="30%" height={10} />
              <SkeletonLine width="58%" height={13} className="mt-2" />
            </div>
            <SkeletonLine width={72} height={30} className="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** A month grid, so the calendar does not flash a list before showing a grid. */
export function SkeletonCalendar() {
  return (
    <div
      className="overflow-hidden rounded-[10px] border"
      style={{ borderColor: 'var(--border-strong)' }}
      aria-hidden="true"
    >
      <div className="grid grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex justify-center border-b py-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <SkeletonLine width={26} height={10} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className={`min-h-[118px] p-2 ${i % 7 === 6 ? '' : 'border-r'} ${i >= 28 ? '' : 'border-b'}`}
            style={{ borderColor: 'var(--border)' }}
          >
            <SkeletonLine width={16} height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The predicted total, then the per-subject table. */
export function SkeletonPrediction() {
  return (
    <div aria-hidden="true">
      <SkeletonLine width={140} height={10} />
      <SkeletonLine width={180} height={56} className="mt-4" />
      <div
        className="mt-8 flex flex-wrap gap-x-12 gap-y-5 border-t pt-6"
        style={{ borderColor: 'var(--border)' }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <SkeletonLine width={80} height={11} />
            <SkeletonLine width={56} height={20} className="mt-2" />
          </div>
        ))}
      </div>
      <SkeletonLine height={4} className="mt-6 rounded-full" />
      <SkeletonRows rows={4} />
    </div>
  )
}

/** Avatar and a stack of fields. */
export function SkeletonForm({ rows = 3 }) {
  return (
    <div aria-hidden="true">
      <div className="mb-8 flex items-center gap-4">
        <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <SkeletonLine width="45%" height={15} />
          <SkeletonLine width="30%" height={12} className="mt-2" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-5">
          <SkeletonLine width={86} height={11} />
          <SkeletonLine height={44} className="mt-2" />
        </div>
      ))}
    </div>
  )
}

const LOADING_VARIANTS = {
  list: ({ rows }) => <SkeletonRows rows={rows} />,
  cards: ({ rows }) => <SkeletonCards count={rows} />,
  plan: ({ rows }) => <SkeletonPlan rows={rows} />,
  calendar: () => <SkeletonCalendar />,
  prediction: () => <SkeletonPrediction />,
  form: ({ rows }) => <SkeletonForm rows={rows} />,
  dashboard: () => <SkeletonDashboard />,
  redemption: ({ rows }) => <SkeletonRedemption rows={rows} />,
  core: () => <SkeletonCore />,
}

/**
 * Full-page loading state.
 *
 * The real heading renders immediately so the page identity never changes
 * under you, and the skeleton mirrors the shape of whatever is coming. A
 * generic list standing in for a calendar or a set of cards causes a visible
 * jump the moment data lands, which reads as the page breaking rather than
 * loading.
 */
export function PageLoading({ title, width = 'default', stats = false, rows = 4, variant = 'list' }) {
  const Skeleton = LOADING_VARIANTS[variant] || LOADING_VARIANTS.list
  return (
    <Page width={width}>
      <header className="mb-10">
        <h1 className="text-[clamp(1.7rem,3.4vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
          {title}
        </h1>
        <SkeletonLine width={230} height={14} className="mt-3" />
      </header>
      {stats && <SkeletonStats />}
      <Skeleton rows={rows} />
      <span className="sr-only" role="status" aria-live="polite">
        Loading {title}
      </span>
    </Page>
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
