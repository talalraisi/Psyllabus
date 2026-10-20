/**
 * One small drawing per kind of subject, for the landing page's moving
 * graphics. Drawn here rather than pulled from an icon pack: the site has no
 * icon library, and these only need to be read as "a science", "a language",
 * not as anyone's logo.
 */

const P = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const svg = (children) =>
  function SubjectIcon({ size = 30, className, style }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...P} className={className} style={style} aria-hidden="true">
        {children}
      </svg>
    )
  }

export const SUBJECT_ICONS = {
  physics: {
    label: 'Physics',
    color: 'oklch(0.62 0.13 255)',
    Icon: svg(
      <>
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)" />
      </>
    ),
  },
  chemistry: {
    label: 'Chemistry',
    color: 'oklch(0.62 0.14 300)',
    Icon: svg(
      <>
        <path d="M9 3h6M10 3v6l-5.4 9.3A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.7L14 9V3" />
        <path d="M7.2 15h9.6" />
      </>
    ),
  },
  biology: {
    label: 'Biology',
    color: 'oklch(0.6 0.13 150)',
    Icon: svg(
      <>
        <path d="M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9" />
        <path d="M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9" />
        <path d="M9.2 6h5.6M9.2 18h5.6M10.5 9.2h3M10.5 14.8h3" />
      </>
    ),
  },
  maths: {
    label: 'Maths',
    color: 'oklch(0.6 0.15 30)',
    Icon: svg(<path d="M18 5H6l6.5 7L6 19h12" />),
  },
  geography: {
    label: 'Geography',
    color: 'oklch(0.62 0.12 200)',
    Icon: svg(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
      </>
    ),
  },
  english: {
    label: 'English',
    color: 'oklch(0.6 0.12 20)',
    Icon: svg(
      <>
        <path d="M4 19.5V5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5Zm0 0A2.5 2.5 0 0 0 6.5 22H20" />
        <path d="M8 7.5h8M8 11h5" />
      </>
    ),
  },
  economics: {
    label: 'Economics',
    color: 'oklch(0.62 0.13 160)',
    Icon: svg(
      <>
        <path d="M3 3v18h18" />
        <path d="m7 15 4-4 3 3 5.5-6.5" />
        <path d="M15.5 8h4v4" />
      </>
    ),
  },
  history: {
    label: 'History',
    color: 'oklch(0.64 0.1 70)',
    Icon: svg(
      <>
        <path d="M2.5 9.5 12 4l9.5 5.5Z" />
        <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18" />
      </>
    ),
  },
  arts: {
    label: 'Visual Arts',
    color: 'oklch(0.64 0.15 350)',
    Icon: svg(
      <>
        <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.5 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.5-9-7.5Z" />
        <circle cx="7.5" cy="11" r="1" fill="currentColor" />
        <circle cx="10" cy="7.3" r="1" fill="currentColor" />
        <circle cx="14.6" cy="7.3" r="1" fill="currentColor" />
      </>
    ),
  },
  computing: {
    label: 'Computer Science',
    color: 'oklch(0.58 0.12 240)',
    Icon: svg(<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />),
  },
  languages: {
    label: 'Languages',
    color: 'oklch(0.62 0.13 280)',
    Icon: svg(
      <>
        <path d="M4 5h8M8 3v2M10.5 5C9.5 9 7.5 12 4 14M6 9c1 2 3 4 5 5" />
        <path d="m13 21 4-10 4 10M14.5 17.5h5" />
      </>
    ),
  },
  psychology: {
    label: 'Psychology',
    color: 'oklch(0.63 0.13 330)',
    Icon: svg(
      <>
        <path d="M12 5.5A3 3 0 0 0 6.2 6.6 3 3 0 0 0 4.5 12a3 3 0 0 0 1.8 4.9A3 3 0 0 0 12 18.5Z" />
        <path d="M12 5.5a3 3 0 0 1 5.8 1.1 3 3 0 0 1 1.7 5.4 3 3 0 0 1-1.8 4.9 3 3 0 0 1-5.7 1.6" />
        <path d="M12 5.5v13" />
      </>
    ),
  },
  music: {
    label: 'Music',
    color: 'oklch(0.6 0.14 15)',
    Icon: svg(
      <>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="17.5" cy="16" r="2.5" />
      </>
    ),
  },
  tok: {
    label: 'Theory of Knowledge',
    color: 'oklch(0.7 0.13 85)',
    Icon: svg(
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.8 10.6c.6.6.8 1.4.8 2.4h6c0-1 .2-1.8.8-2.4A6 6 0 0 0 12 3Z" />
      </>
    ),
  },
}

/** A subject's drawing on a rounded tile, tinted in its colour. */
export function SubjectTile({ name, size = 68, icon = 30, radius = Math.round(size * 0.32), className = '', style }) {
  const s = SUBJECT_ICONS[name]
  if (!s) return null
  return (
    <span
      title={s.label}
      className={`flex items-center justify-center border shadow-lg backdrop-blur-md ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        color: s.color,
        borderColor: 'var(--border-strong)',
        background: `color-mix(in oklab, ${s.color} 9%, color-mix(in oklab, var(--surface) 86%, transparent))`,
        ...style,
      }}
    >
      <s.Icon size={icon} />
    </span>
  )
}
