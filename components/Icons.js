/**
 * Icon set, single visual language.
 *
 * Every icon: 20x20 viewBox, 1.5px stroke, round caps and joins, currentColor.
 * Drawn on the same geometric grid so weight reads identically at any size.
 * Never substitute emoji for these.
 */

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export function IconDashboard(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.75" y="2.75" width="6" height="6" rx="1.5" />
      <rect x="11.25" y="2.75" width="6" height="6" rx="1.5" />
      <rect x="2.75" y="11.25" width="6" height="6" rx="1.5" />
      <rect x="11.25" y="11.25" width="6" height="6" rx="1.5" />
    </svg>
  )
}

export function IconSubjects(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.25 4.5A1.75 1.75 0 0 1 5 2.75h9.25a1 1 0 0 1 1 1v10.5" />
      <path d="M3.25 4.5v11A1.75 1.75 0 0 0 5 17.25h10.25" />
      <path d="M5 13.75h10.25" />
    </svg>
  )
}

export function IconStudyPlan(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.75 3.75h6.5a1.5 1.5 0 0 1 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5h-6.5a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M8 2.75h4v2H8z" />
      <path d="M8.25 9.5l1.25 1.25 2.25-2.5" />
      <path d="M8.25 13.75h3.5" />
    </svg>
  )
}

export function IconTest(props) {
  return (
    <svg {...base} {...props}>
      <path d="M11.25 2.75H6.5a1.75 1.75 0 0 0-1.75 1.75v11a1.75 1.75 0 0 0 1.75 1.75h7a1.75 1.75 0 0 0 1.75-1.75V6.75Z" />
      <path d="M11.25 2.75v4h4" />
      <path d="M7.75 12.25l1.25 1.25 2.75-3" />
    </svg>
  )
}

export function IconProgress(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.25 16.75V3.25" />
      <path d="M3.25 16.75h13.5" />
      <path d="M6.25 13.25l3-3.5 2.5 2.25 3.5-4.5" />
    </svg>
  )
}

export function IconReview(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16.75 10a6.75 6.75 0 1 1-2-4.78" />
      <path d="M16.75 3.25v3.5h-3.5" />
    </svg>
  )
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.75 10.5l3.5 3.5 7-8" />
    </svg>
  )
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.25 5.25l9.5 9.5M14.75 5.25l-9.5 9.5" />
    </svg>
  )
}

export function IconChevronRight(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7.75 4.75l5.5 5.25-5.5 5.25" />
    </svg>
  )
}

export function IconArrowRight(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.75 10h12.5M11 4.75l5.25 5.25L11 15.25" />
    </svg>
  )
}

export function IconArrowLeft(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16.25 10H3.75M9 4.75L3.75 10 9 15.25" />
    </svg>
  )
}

export function IconMenu(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.25 5.75h13.5M3.25 10h13.5M3.25 14.25h13.5" />
    </svg>
  )
}

export function IconUser(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="6.75" r="3" />
      <path d="M4.25 16.25a5.75 5.75 0 0 1 11.5 0" />
    </svg>
  )
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7.75 3.25H5.5a1.75 1.75 0 0 0-1.75 1.75v10a1.75 1.75 0 0 0 1.75 1.75h2.25" />
      <path d="M12.5 13.25L15.75 10 12.5 6.75" />
      <path d="M15.75 10h-8" />
    </svg>
  )
}

export function IconSchool(props) {
  return (
    <svg {...base} {...props}>
      <path d="M10 2.75L18.25 7 10 11.25 1.75 7 10 2.75Z" />
      <path d="M5.25 9v4.25c0 1.24 2.13 2.25 4.75 2.25s4.75-1.01 4.75-2.25V9" />
    </svg>
  )
}

export function IconCalendar(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.75" y="4.25" width="14.5" height="13" rx="1.75" />
      <path d="M2.75 8.25h14.5" />
      <path d="M6.75 2.75v3M13.25 2.75v3" />
    </svg>
  )
}

export function IconTarget(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <circle cx="10" cy="10" r="3.75" />
      <circle cx="10" cy="10" r="0.75" fill="currentColor" />
    </svg>
  )
}

export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 5.75V10l2.75 1.75" />
    </svg>
  )
}

export function IconEye(props) {
  return (
    <svg {...base} {...props}>
      <path d="M1.75 10S4.75 4.75 10 4.75 18.25 10 18.25 10 15.25 15.25 10 15.25 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  )
}

export function IconEyeOff(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7.9 5.1A7.6 7.6 0 0 1 10 4.75c5.25 0 8.25 5.25 8.25 5.25a14.6 14.6 0 0 1-2.35 3.03" />
      <path d="M12.35 12.4A2.5 2.5 0 0 1 8.2 9.6" />
      <path d="M5.2 6.35A14.4 14.4 0 0 0 1.75 10S4.75 15.25 10 15.25c.86 0 1.66-.14 2.4-.38" />
      <path d="M3.25 3.25l13.5 13.5" />
    </svg>
  )
}

export function IconSun(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.75v1.5M10 16.75v1.5M18.25 10h-1.5M3.25 10h-1.5M15.84 4.16l-1.06 1.06M5.22 14.78l-1.06 1.06M15.84 15.84l-1.06-1.06M5.22 5.22L4.16 4.16" />
    </svg>
  )
}

export function IconMoon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M16.5 11.75A6.75 6.75 0 0 1 8.25 3.5a6.75 6.75 0 1 0 8.25 8.25Z" />
    </svg>
  )
}
