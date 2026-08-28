/**
 * Layout primitives. Every dashboard page composes these rather than
 * hand-rolling padding and headings, which is what keeps the vertical rhythm
 * and container widths identical across the app.
 *
 * Vertical rhythm: header 32px below, sections 40px apart, cards 12px apart.
 */

const WIDTHS = {
  narrow: 'max-w-2xl',  // forms, single-column reading
  default: 'max-w-4xl', // lists, syllabus
  wide: 'max-w-6xl',    // dashboards, grids
}

export function Page({ children, width = 'default' }) {
  return (
    <div className={`mx-auto px-5 py-8 md:px-12 md:py-10 ${WIDTHS[width]}`}>{children}</div>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="t-page-title">{title}</h1>
        {subtitle && <p className="t-small mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`mb-10 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-4">
          {title && <h2 className="t-overline">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Bordered white panel. `flush` removes padding for full-bleed lists. */
export function Card({ children, className = '', interactive = false, flush = false }) {
  return (
    <div
      className={`surface ${interactive ? 'surface-interactive' : ''} ${flush ? '' : 'p-5'} ${className}`}
    >
      {children}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="surface px-6 py-10 text-center">
      <p className="t-card-title">{title}</p>
      {description && <p className="t-small mx-auto mt-2 max-w-md">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
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
    <div className="surface" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
        >
          <SkeletonLine width={200} height={14} />
          <div className="flex-1">
            <SkeletonLine height={8} />
          </div>
          <SkeletonLine width={40} height={14} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface p-5">
          <SkeletonLine width={48} height={28} />
          <SkeletonLine width={72} height={12} className="mt-3" />
        </div>
      ))}
    </div>
  )
}

/**
 * Full-page loading state. Renders the real header text immediately so the
 * page identity is stable, with skeletons standing in for the data.
 */
/** Grid of subject cards, each with a progress ring and an action. */
export function SkeletonCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface flex flex-col p-5">
          <div className="mb-5 flex items-start gap-4">
            <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <SkeletonLine width="70%" height={16} />
              <SkeletonLine width="45%" height={12} className="mt-2" />
            </div>
          </div>
          <SkeletonLine height={40} className="mt-auto" />
        </div>
      ))}
    </div>
  )
}

/** Today's session: the time control, the timer, then the checklist. */
export function SkeletonPlan({ rows = 5 }) {
  return (
    <div className="surface p-5" aria-hidden="true">
      <SkeletonLine width={160} height={16} />
      <SkeletonLine width={220} height={12} className="mt-2" />
      <SkeletonLine height={72} className="mt-4" />
      <SkeletonLine height={84} className="mt-3" />
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--border-strong)] p-3"
          >
            <div className="skeleton h-5 w-5 shrink-0 rounded-[var(--r-sm)]" />
            <div className="min-w-0 flex-1">
              <SkeletonLine width="35%" height={10} />
              <SkeletonLine width="65%" height={13} className="mt-2" />
            </div>
            <SkeletonLine width={72} height={32} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** A month grid, so the calendar does not flash a list before showing a grid. */
export function SkeletonCalendar() {
  return (
    <div className="surface overflow-hidden" aria-hidden="true">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-sunken)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex justify-center px-2 py-2">
            <SkeletonLine width={24} height={10} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className={`min-h-[72px] p-2 ${i % 7 === 6 ? '' : 'border-r border-[var(--border)]'} ${
              i >= 28 ? '' : 'border-b border-[var(--border)]'
            }`}
          >
            <div className="skeleton h-6 w-6 rounded-full" />
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
      <div className="surface mb-3 p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SkeletonLine width={90} height={11} />
            <SkeletonLine width={120} height={44} className="mt-2" />
          </div>
          <div>
            <SkeletonLine width={70} height={11} />
            <SkeletonLine width={80} height={28} className="mt-2" />
          </div>
        </div>
        <SkeletonLine height={8} className="mt-6 rounded-full" />
        <SkeletonLine width="80%" height={13} className="mt-3" />
      </div>
      <SkeletonRows rows={4} />
    </div>
  )
}

/** Avatar and a stack of fields. */
export function SkeletonForm({ rows = 3 }) {
  return (
    <div className="surface p-5" aria-hidden="true">
      <div className="mb-6 flex items-center gap-4">
        <div className="skeleton h-16 w-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <SkeletonLine width="50%" height={16} />
          <SkeletonLine width="35%" height={12} className="mt-2" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-4">
          <SkeletonLine width={90} height={11} />
          <SkeletonLine height={48} className="mt-2" />
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
      <header className="mb-8">
        <h1 className="t-page-title">{title}</h1>
        <SkeletonLine width={220} height={14} className="mt-2" />
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
