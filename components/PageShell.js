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
export function PageLoading({ title, width = 'default', stats = false, rows = 4 }) {
  return (
    <Page width={width}>
      <header className="mb-8">
        <h1 className="t-page-title">{title}</h1>
        <SkeletonLine width={220} height={14} className="mt-2" />
      </header>
      {stats && <SkeletonStats />}
      <SkeletonRows rows={rows} />
      <span className="sr-only" role="status">
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
