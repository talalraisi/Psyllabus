'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import logoMark from '@/public/logo-mark.svg'
import {
  IconDashboard,
  IconSubjects,
  IconStudyPlan,
  IconTest,
  IconProgress,
  IconReview,
  IconTarget,
  IconCalendar,
  IconCards,
  IconUser,
  IconLogout,
  IconMenu,
  IconClose,
} from '@/components/Icons'
import { planLabel, hasAllSubjects } from '@/lib/access'
import { clearCache } from '@/lib/cache'
import TimerPill from '@/components/TimerPill'
import { stopTimerForSignOut } from '@/lib/session-timer'
import FeedbackButton from '@/components/FeedbackButton'
import SyllabiMark from '@/components/SyllabiMark'
import { SyllabiProvider } from '@/components/syllabi/SyllabiDrawer'
import ThemeToggle from '@/components/ThemeToggle'
import { StreakChip } from '@/components/Streak'
import { Chevron } from '@/components/Select'

/**
 * The menu, in four groups instead of one list of eleven: the two places a
 * student starts from, then studying, planning and seeing how it is going.
 * The core page only shows for IB students, the only ones who have one.
 */
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard, match: (p) => p === '/dashboard' },
      {
        href: '/dashboard/syllabi',
        label: 'Syllabi',
        Icon: ({ width, style }) => <SyllabiMark size={width} style={{ ...style, color: 'var(--brand)' }} />,
        match: (p) => p.startsWith('/dashboard/syllabi'),
      },
    ],
  },
  {
    label: 'Study',
    items: [
      {
        href: '/dashboard/subjects',
        label: 'My Subjects',
        Icon: IconSubjects,
        match: (p) => p.startsWith('/dashboard/syllabus') || p === '/dashboard/subjects',
      },
      { href: '/dashboard/map', label: 'Subject Map', Icon: IconOrbit, match: (p) => p === '/dashboard/map' },
      { href: '/dashboard/flashcards', label: 'Flashcards', Icon: IconCards, match: (p) => p === '/dashboard/flashcards' },
      { href: '/dashboard/test', label: 'Tests', Icon: IconTest, match: (p) => p === '/dashboard/test' || p.startsWith('/dashboard/quiz') },
      { href: '/dashboard/papers', label: 'Exam Papers', Icon: IconPaper, match: (p) => p === '/dashboard/papers' || p.startsWith('/dashboard/paper/') },
      { href: '/dashboard/mistakes', label: 'Redemption', Icon: IconReview, match: (p) => p === '/dashboard/mistakes' },
    ],
  },
  {
    label: 'Plan',
    items: [
      { href: '/dashboard/study-plan', label: 'Study Plan', Icon: IconStudyPlan, match: (p) => p === '/dashboard/study-plan' },
      { href: '/dashboard/calendar', label: 'Calendar', Icon: IconCalendar, match: (p) => p === '/dashboard/calendar' },
    ],
  },
  {
    label: 'Progress',
    items: [
      { href: '/dashboard/progress', label: 'Progress', Icon: IconProgress, match: (p) => p === '/dashboard/progress' || p === '/dashboard/Heatmap' },
      { href: '/dashboard/analytics', label: 'Analytics', Icon: IconAnalytics, match: (p) => p === '/dashboard/analytics' },
      { href: '/dashboard/prediction', label: 'Predicted Grade', Icon: IconTarget, match: (p) => p === '/dashboard/prediction' },
    ],
  },
]

/** Bars and a trend line: analytics. */
function IconAnalytics({ width = 17, height = 17, style }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d="M4 20V14M10 20V10M16 20v-5M22 20H2" />
      <path d="m4 9 6-4 6 4 5-4" />
    </svg>
  )
}

/** A sheet with a clock in its corner: a timed exam paper. */
function IconPaper({ width = 17, height = 17, style }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H12" />
      <path d="M8.5 8h6M8.5 11.5h4" />
      <circle cx="17" cy="16.5" r="4" />
      <path d="M17 14.6v2l1.3 1" />
    </svg>
  )
}

/** Two rings and a node: the subject map. */
function IconOrbit({ width = 17, height = 17, style }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="18" cy="6" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * The sidebar's state for this tab. Every page renders its own layout, so
 * without this a pinned sidebar would start as a rail and open again on each
 * page, and one you were pointing at would fold shut under the pointer.
 * Null until the first page has read storage.
 */
const remembered = { pinned: null, hovered: false, groups: null }

function Avatar({ profile, size = 32 }) {
  if (profile?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-[var(--border)] shrink-0"
      />
    )
  }
  const initial = String(profile?.full_name || 'S').charAt(0).toUpperCase()
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-[var(--brand-tint)] border border-[var(--border)] flex items-center justify-center text-[13px] font-semibold text-[var(--brand)] shrink-0"
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

export default function DashboardLayout({ children, profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  // Which account this actually is. It lives on the auth user rather than the
  // profile row, and it is the only thing that distinguishes two accounts with
  // the same name on the same device.
  const [email, setEmail] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data?.user?.email || '')
    })
    return () => {
      cancelled = true
    }
  }, [supabase])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  // The account menu closes on any click outside it.
  useEffect(() => {
    if (!accountOpen) return
    const close = () => setAccountOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [accountOpen])
  // Lazy, from what this tab last knew (see `remembered`), so moving between
  // pages does not replay the sidebar opening on every one.
  const [pinned, setPinned] = useState(() => remembered.pinned ?? false)
  const [hovered, setHovered] = useState(() => remembered.hovered)
  // Groups folded away by the student, by label.
  const [closedGroups, setClosedGroups] = useState(() => remembered.groups ?? [])
  const [signingOut, setSigningOut] = useState(false)
  const hoverTimer = useRef(null)

  // The first page of a visit reads storage after mount rather than during
  // render: the server has no idea what this browser last chose, and
  // rendering it straight away would not match what it sends.
  useEffect(() => {
    if (remembered.pinned !== null) return
    let pin = false
    let folded = []
    try {
      pin = localStorage.getItem('psyllabus:sidebar') === 'pinned'
      const saved = JSON.parse(localStorage.getItem('psyllabus:sidebar-groups') || '[]')
      if (Array.isArray(saved)) folded = saved.filter((g) => typeof g === 'string')
    } catch {
      // Private windows and blocked site data both throw here. The sidebar
      // simply starts as a rail with every group open.
    }
    remembered.pinned = pin
    remembered.groups = folded
    if (pin) setPinned(true)
    if (folded.length) setClosedGroups(folded)
  }, [])

  const togglePinned = () => {
    setPinned((prev) => {
      const next = !prev
      remembered.pinned = next
      try {
        localStorage.setItem('psyllabus:sidebar', next ? 'pinned' : 'rail')
      } catch {
        // Not being able to remember the choice is not a reason to refuse it.
      }
      return next
    })
  }

  const toggleGroup = (label) => {
    setClosedGroups((prev) => {
      const next = prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
      remembered.groups = next
      try {
        localStorage.setItem('psyllabus:sidebar-groups', JSON.stringify(next))
      } catch {
        // As above.
      }
      return next
    })
  }

  /**
   * The rail opens when the pointer rests on it, not when it passes over on
   * its way to something else, and closes a moment after it leaves so a
   * wobble at the edge does not snap it shut.
   */
  const hoverTo = (open) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      remembered.hovered = open
      setHovered(open)
    }, open ? 90 : 160)
  }
  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  // Open as wide as it needs to be: pinned, pointed at, or with its account
  // menu showing (which would otherwise close under the pointer).
  const expanded = pinned || hovered || accountOpen

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const handleLogout = async () => {
    if (signingOut) return
    setSigningOut(true)
    clearCache()
    // Save the running session while it can still be saved as this student's,
    // and stop the clock so it does not carry on into someone else's account.
    await stopTimerForSignOut()
    await supabase.auth.signOut()
    router.push('/login')
  }


  /**
   * The menu. On a desktop it is a rail of icons that opens over the page
   * when you rest on it (or stays open, pinned); the labels fade in as it
   * widens rather than the layout being rebuilt. Every icon sits at the
   * same spot in both states, so nothing jumps under the pointer.
   *
   * `open` is whether the labels show; the mobile drawer always shows them.
   */
  const sidebar = (open, mobile = false) => (
    <>
      <div className="relative flex h-[68px] shrink-0 items-center pl-[17px] pr-3">
        {/* The short mark in the rail and the full logo when open, by
            clipping one image: the cap and "Ps" (the first third, cut just
            before the Y), then the rest of the word as it widens.
            Above the fold on every page, so it loads eagerly with its aspect
            ratio declared. */}
        <Link href="/dashboard" className="inline-block shrink-0" aria-label="Dashboard">
          <Image
            src={logoMark}
            alt="Project Syllabus"
            sizes="90px"
            priority
            style={{
              height: 36,
              width: 86,
              maxWidth: 'none',
              clipPath: open
                ? 'polygon(0 0, 100% 0, 100% 100%, 100% 100%, 100% 100%, 0 100%)'
                : 'polygon(0 0, 33.6% 0, 33.6% 100%, 33.6% 100%, 33.6% 100%, 0 100%)',
              transition: 'clip-path 220ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </Link>
        {!mobile && (
          <button
            onClick={togglePinned}
            aria-label={pinned ? 'Let the sidebar fold away' : 'Keep the sidebar open'}
            aria-pressed={pinned}
            title={pinned ? 'Unpin' : 'Keep open'}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-[8px] transition-[opacity,background-color] duration-150 hover:bg-[var(--surface-sunken)]"
            style={{ color: pinned ? 'var(--brand)' : 'var(--text-faint)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z" />
              <path d="M12 13v8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* The streak, on every page: a reason to come back, in the corner of
          the eye rather than in a pop-up. */}
      {profile && (
        <div className="shrink-0 px-3 pb-2">
          <StreakChip profile={profile} expanded={open} />
        </div>
      )}

      <div className="mx-4 border-t border-[var(--border)]" />

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-2" aria-label="Main">
        {NAV_GROUPS.map((group, g) => {
          const items = group.items.filter((item) => !item.ibOnly || !profile || profile.curriculum === 'IB')
          if (!items.length) return null
          // Folding is for the open menu. The rail always shows every icon:
          // folded away there, a group left nothing but a rule.
          const folded = open && group.label && closedGroups.includes(group.label)
          const holdsActive = items.some((item) => item.match(pathname))
          return (
            <div key={group.label || g} className={g ? 'mt-1' : ''}>
              {group.label && (
                <div className="relative h-8">
                  {/* In the rail a group is a short rule; open, it is a
                      heading you can fold. Both sit in the same 32px, so
                      opening the rail moves nothing up or down. */}
                  <span
                    aria-hidden="true"
                    className="absolute left-3 right-3 top-1/2 border-t transition-opacity duration-150"
                    style={{ borderColor: 'var(--border)', opacity: open ? 0 : 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={!folded}
                    tabIndex={open ? 0 : -1}
                    className="absolute inset-0 flex items-center justify-between rounded-[8px] px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-[opacity,background-color] duration-150 hover:bg-[var(--surface-sunken)]"
                    style={{ color: 'var(--text-faint)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                  >
                    <span className="flex items-center gap-2">
                      {group.label}
                      {folded && holdsActive && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--brand)' }} />}
                    </span>
                    <Chevron open={!folded} style={{ transform: folded ? 'rotate(-90deg)' : 'none' }} />
                  </button>
                </div>
              )}
              {/* Folding animates the row height from its content: a grid
                  row going from 1fr to 0fr, which needs no measuring. */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: folded ? '0fr' : '1fr' }}
              >
                <ul className="flex min-h-0 flex-col gap-px overflow-hidden" inert={folded || undefined}>
                  {items.map(({ href, label, Icon, match }) => {
                    const active = match(pathname)
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          aria-current={active ? 'page' : undefined}
                          aria-label={open ? undefined : label}
                          title={open ? undefined : label}
                          className="relative flex h-9 items-center gap-3 overflow-hidden rounded-[9px] pl-[11.5px] pr-3 text-[13px] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
                          style={{
                            color: active ? 'var(--text)' : 'var(--text-muted)',
                            fontWeight: active ? 600 : 500,
                            background: active ? 'var(--surface-sunken)' : undefined,
                          }}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                              style={{ background: 'var(--brand)' }}
                            />
                          )}
                          <Icon width={17} height={17} style={{ color: active ? 'var(--brand)' : 'var(--text-faint)', flexShrink: 0 }} />
                          <span
                            className="whitespace-nowrap transition-[opacity,transform] duration-150"
                            style={{ opacity: open ? 1 : 0, transform: open ? 'none' : 'translateX(-4px)' }}
                          >
                            {label}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-[var(--border)]" />

      {/* You, and everything about your account behind one tap, so the menu
          above keeps the room. */}
      <div className="relative shrink-0 p-2">
        {profile && !hasAllSubjects(profile) && (
          <Link
            href="/dashboard/profile#unlock"
            title={open ? undefined : 'Unlock every subject'}
            className="mb-1.5 flex h-9 items-center gap-3 overflow-hidden rounded-[10px] pl-[14px] pr-3 text-[12.5px] font-semibold transition-colors hover:brightness-110"
            style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="shrink-0">
              <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
              <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
            </svg>
            <span className="whitespace-nowrap transition-opacity duration-150" style={{ opacity: open ? 1 : 0 }}>
              Unlock every subject
            </span>
          </Link>
        )}

        {/* You, and everything about your account, in one panel. Opening it
            does not pop a menu over the page: the whole panel grows upward
            into the space above, your name riding up on top and the options
            unfolding underneath it. The menu above gives up the room. */}
        {profile && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              aria-expanded={accountOpen}
              aria-controls="account-panel"
              title={open ? undefined : profile.full_name || 'Account'}
              className="flex w-full items-center gap-3 overflow-hidden rounded-[13px] p-2 text-left transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <Avatar profile={profile} size={32} />
              <span className="min-w-0 flex-1 transition-opacity duration-150" style={{ opacity: open ? 1 : 0 }}>
                <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{profile.full_name || 'Student'}</span>
                {/* The e-mail, not the programme: two accounts on one device can
                    carry the same name, and the address tells them apart. */}
                <span className="t-caption block truncate" title={email || undefined}>
                  {email || `${profile.curriculum} · Class of ${profile.grad_year}`}
                </span>
              </span>
              <span className="mr-1 text-[var(--text-faint)] transition-opacity duration-150" style={{ opacity: open ? 1 : 0 }}>
                <Chevron open={!accountOpen} />
              </span>
            </button>

            <div
              id="account-panel"
              className="grid transition-[grid-template-rows] duration-300"
              style={{ gridTemplateRows: accountOpen ? '1fr' : '0fr', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <div className="min-h-0 overflow-hidden" inert={!accountOpen || undefined}>
                <div
                  className="px-1.5 pb-1.5 transition-[opacity,transform] duration-300"
                  style={{ opacity: accountOpen ? 1 : 0, transform: accountOpen ? 'none' : 'translateY(-6px)' }}
                >
                  <div className="mx-1.5 mb-1.5 border-t" style={{ borderColor: 'var(--border)' }} />
                  <Link href="/dashboard/profile" className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]">
                    <IconUser width={16} height={16} className="text-[var(--text-faint)]" />
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={signingOut}
                    className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                  >
                    <IconLogout width={16} height={16} className="text-[var(--text-faint)]" />
                    {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                  <div className="mx-1.5 my-1.5 border-t" style={{ borderColor: 'var(--border)' }} />
                  <div className="flex items-center justify-between gap-3 px-3 py-1 text-[12.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    Theme
                    <ThemeToggle />
                  </div>
                  <div className="flex gap-3 px-3 pb-1 pt-2">
                    <Link href="/privacy?from=dashboard" className="t-caption hover:text-[var(--text-muted)]">
                      Privacy
                    </Link>
                    <Link href="/terms?from=dashboard" className="t-caption hover:text-[var(--text-muted)]">
                      Terms
                    </Link>
                    <Link href="/cookies?from=dashboard" className="t-caption hover:text-[var(--text-muted)]">
                      Cookies
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    // Syllabi can be opened from any page, about whatever is on it.
    <SyllabiProvider profile={profile}>
    <div className="flex min-h-screen flex-col bg-[var(--bg)] md:flex-row">
      {/* Mobile bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
        {/* The drawer slides in from the left, so the button that opens it
            belongs on the left. It sat on the right, which meant reaching
            across the screen to open a panel that appeared under your thumb. */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="control-md -ml-2 flex w-10 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[var(--text)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
        >
          <IconMenu />
        </button>
        <Link href="/dashboard" className="inline-block" aria-label="Dashboard">
          <Image src={logoMark} alt="Project Syllabus" sizes="70px" style={{ height: 28, width: 'auto', aspectRatio: '1472 / 613' }} priority />
        </Link>
      </header>

      {/* Mobile drawer. Always mounted so it can slide in and out rather
          than appear; inert while it is away. */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen || undefined}
      >
        <div
          className="absolute inset-0 bg-black/30 transition-opacity duration-200"
          style={{ opacity: mobileOpen ? 1 : 0 }}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className="absolute left-0 top-0 flex h-full w-[272px] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-300"
          style={{ transform: mobileOpen ? 'translateX(0)' : 'translateX(-105%)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="absolute right-3 top-[18px] z-10 flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
          >
            <IconClose width={18} height={18} />
          </button>
          {sidebar(true, true)}
        </aside>
      </div>

      {/* Desktop sidebar. The rail keeps 64px of the page; opened by
          hovering it widens over the page instead of pushing it, and pinned
          it takes its full width. */}
      <div
        className="hidden shrink-0 transition-[width] duration-200 ease-out md:block"
        style={{ width: pinned ? 248 : 64 }}
        aria-hidden="true"
      />
      <aside
        onMouseEnter={() => hoverTo(true)}
        onMouseLeave={() => hoverTo(false)}
        onFocus={() => hoverTo(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) hoverTo(false)
        }}
        className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width,box-shadow] duration-200 md:flex"
        style={{
          width: expanded ? 248 : 64,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: expanded && !pinned ? '8px 0 32px -12px rgb(0 0 0 / 0.25)' : 'none',
        }}
      >
        {sidebar(expanded)}
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      {/* Follows you out of the study plan so a running session stays visible. */}
      <TimerPill />

      {/* On every signed-in page, because the page somebody is looking at when
          something goes wrong is the page they should be able to say so from. */}
      {/* Syllabi has its own buttons in that corner. */}
      {/* The map has its own controls in that corner too. */}
      {!pathname.startsWith('/dashboard/syllabi') && pathname !== '/dashboard/map' && <FeedbackButton />}
    </div>
    </SyllabiProvider>
  )
}
