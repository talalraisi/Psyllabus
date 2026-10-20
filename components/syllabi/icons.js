/** The handful of line icons Syllabi's screens use, drawn to match Icons.js. */

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

export const ArrowUp = ({ size = 18 }) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)

export const Stop = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
    <rect x="2" y="2" width="10" height="10" rx="2.5" fill="currentColor" />
  </svg>
)

export const Paperclip = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9" />
  </svg>
)

export const Copy = ({ size = 15 }) => (
  <svg {...base(size)}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15H4.5A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V5" />
  </svg>
)

export const Check = ({ size = 15 }) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

// The same light chevron as the app's dropdowns (components/Select.js).
export const Chevron = ({ size = 10, up = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ transform: up ? 'rotate(180deg)' : undefined, transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0, opacity: 0.7 }}
  >
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
)

export const FileIcon = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
)

export const LinkIcon = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="M10 13.5a4.5 4.5 0 006.4.4l3-3a4.5 4.5 0 00-6.4-6.4l-1.2 1.2" />
    <path d="M14 10.5a4.5 4.5 0 00-6.4-.4l-3 3a4.5 4.5 0 006.4 6.4l1.2-1.2" />
  </svg>
)

export const Close = ({ size = 12 }) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const Sparkle = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="M12 3l1.6 4.8L18.5 9.5l-4.9 1.7L12 16l-1.6-4.8L5.5 9.5l4.9-1.7z" />
    <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </svg>
)

export const Download = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </svg>
)

export const Collapse = ({ size = 16, flip = false }) => (
  <svg {...base(size)} style={{ transform: flip ? 'rotate(180deg)' : undefined }}>
    <path d="M7 6l6 6-6 6M13 6l6 6-6 6" />
  </svg>
)

export const Refresh = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />
  </svg>
)
