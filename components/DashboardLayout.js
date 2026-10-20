'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import logoMark from '@/public/logo-mark.png'
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
  IconSchool,
  IconUser,
  IconLogout,
  IconMenu,
  IconClose,
  IconChevronRight,
} from '@/components/Icons'
import { planLabel, hasAllSubjects } from '@/lib/access'
import { clearCache } from '@/lib/cache'
import TimerPill from '@/components/TimerPill'
import { stopTimerForSignOut } from '@/lib/session-timer'
import FeedbackButton from '@/components/FeedbackButton'
import SyllabiMark from '@/components/SyllabiMark'
import { SyllabiProvider } from '@/components/syllabi/SyllabiDrawer'
import ThemeToggle from '@/components/ThemeToggle'

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
        match: (p) => p.startsWith('/dashboard/syllabus') || p === '/dashboard/subjects' || p === '/dashboard/map',
      },
      { href: '/dashboard/core', label: 'TOK & EE', Icon: IconSchool, match: (p) => p === '/dashboard/core', ibOnly: true },
      { href: '/dashboard/flashcards', label: 'Flashcards', Icon: IconCards, match: (p) => p === '/dashboard/flashcards' },
      { href: '/dashboard/test', label: 'Tests', Icon: IconTest, match: (p) => p === '/dashboard/test' || p.startsWith('/dashboard/quiz') },
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
      { href: '/dashboard/prediction', label: 'Predicted Grade', Icon: IconTarget, match: (p) => p === '/dashboard/prediction' },
    ],
  },
]

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
  const [collapsed, setCollapsed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Read after mount rather than during render: the server has no idea what
  // this browser last chose, and rendering the collapsed state straight away
  // would not match what it sends.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('psyllabus:sidebar') === 'collapsed')
    } catch {
      // Private windows and blocked site data both throw here. The sidebar
      // simply starts open, which is the state it had before this existed.
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('psyllabus:sidebar', next ? 'collapsed' : 'open')
      } catch {
        // Not being able to remember the choice is not a reason to refuse it.
      }
      return next
    })
  }

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


  // `compact` is the icons-only desktop sidebar. The mobile drawer never
  // passes it: a drawer you deliberately opened should show you its labels.
  const sidebar = (compact = false) => (
    <>
      <div
        className={`flex pb-6 pt-5 ${
          compact ? 'flex-col items-center gap-4 px-2' : 'items-center justify-between px-4'
        }`}
      >
        {/* Above the fold on every page, so it loads eagerly with its aspect
            ratio declared. next/image lazy-loads by default, and a lazy image
            with width:auto gives the browser nothing to reserve a box with
            until the bytes land — which is a visible shift and the reason
            Chrome flags it.

            Signed in, the logo goes to the dashboard. Every other app sends
            you to your own home from the mark in the corner, and a student who
            is mid-revision does not want the sales page.

            The logo is a mark plus a wordmark and there is no mark-only
            version of it, so cropping it to 64px shows a sliver of letters.
            Collapsing is a request for space; the logo comes back with the
            labels, one click away. */}
        {!compact && (
          <Link href="/dashboard" className="inline-block" aria-label="Dashboard">
            <Image src={logoMark} alt="Project Syllabus" sizes="68px" style={{ height: 26, width: 'auto', aspectRatio: '1472 / 613' }} priority />
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden h-8 w-8 items-center justify-center rounded-[8px] transition-colors duration-150 hover:bg-[var(--surface-sunken)] md:flex"
          style={{ color: 'var(--text-faint)' }}
        >
          <IconChevronRight
            width={16}
            height={16}
            style={{ transform: compact ? 'none' : 'rotate(180deg)' }}
          />
        </button>
      </div>

      <div className="mx-4 border-t border-[var(--border)]" />

      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-3" aria-label="Main">
        {NAV_GROUPS.map((group, g) => {
          const items = group.items.filter((item) => !item.ibOnly || !profile || profile.curriculum === 'IB')
          if (!items.length) return null
          return (
            <div key={group.label || g} className={g ? 'mt-5' : ''}>
              {group.label &&
                (compact ? (
                  <div aria-hidden="true" className="mx-3 mb-2 border-t" style={{ borderColor: 'var(--border)' }} />
                ) : (
                  <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
                    {group.label}
                  </p>
                ))}
              <ul className="flex flex-col gap-px">
                {items.map(({ href, label, Icon, match }) => {
                  const active = match(pathname)
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        title={compact ? label : undefined}
                        className={`relative flex items-center gap-3 rounded-[9px] py-2 text-[13px] transition-colors duration-150 hover:bg-[var(--surface-sunken)] ${
                          compact ? 'justify-center px-0' : 'px-3'
                        }`}
                        style={{
                          color: active ? 'var(--text)' : 'var(--text-muted)',
                          fontWeight: active ? 600 : 500,
                          background: active ? 'var(--surface-sunken)' : undefined,
                        }}
                      >
                        {active && !compact && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                            style={{ background: 'var(--brand)' }}
                          />
                        )}
                        <Icon width={17} height={17} style={{ color: active ? 'var(--brand)' : 'var(--text-faint)' }} />
                        {!compact && label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-[var(--border)]" />

      {/* You, and everything about your account behind one tap, so the menu
          above keeps the room. */}
      <div className={`relative ${compact ? 'p-2' : 'p-3'}`}>
        {profile && !hasAllSubjects(profile) && !compact && (
          <Link
            href="/dashboard/profile#unlock"
            className="mb-2 flex items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold transition-colors hover:brightness-110"
            style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
          >
            Unlock every subject
            <IconChevronRight width={14} height={14} />
          </Link>
        )}

        {accountOpen && (
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="pop-enter absolute bottom-full left-3 right-3 z-30 mb-1 rounded-[14px] border p-1.5 shadow-xl"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', minWidth: compact ? 200 : undefined }}
          >
            <Link
              href="/dashboard/profile"
              role="menuitem"
              className="flex items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <IconUser width={16} height={16} className="text-[var(--text-faint)]" />
              Profile
            </Link>
            <div className="flex items-center justify-between gap-3 rounded-[9px] px-3 py-1.5 text-[13px] font-medium text-[var(--text-body)]">
              Theme
              <ThemeToggle />
            </div>
            <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            <button
              role="menuitem"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
            >
              <IconLogout width={16} height={16} className="text-[var(--text-faint)]" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
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
        )}

        {profile && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setAccountOpen((v) => !v)
            }}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            title={compact ? profile.full_name || 'Account' : undefined}
            className={`flex w-full items-center gap-3 rounded-[10px] text-left transition-colors hover:bg-[var(--surface-sunken)] ${compact ? 'justify-center p-1' : 'p-2'}`}
            style={accountOpen ? { background: 'var(--surface-sunken)' } : undefined}
          >
            <Avatar profile={profile} size={32} />
            <span className={`min-w-0 flex-1 ${compact ? 'hidden' : ''}`}>
              <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{profile.full_name || 'Student'}</span>
              {/* The e-mail, not the programme: two accounts on one device can
                  carry the same name, and the address tells them apart. */}
              <span className="t-caption block truncate" title={email || undefined}>
                {email || `${profile.curriculum} · Class of ${profile.grad_year}`}
              </span>
            </span>
            {!compact && (
              <span className="shrink-0 text-[var(--text-faint)]" style={{ transform: accountOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 150ms' }}>
                <IconChevronRight width={14} height={14} />
              </span>
            )}
          </button>
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[264px] flex-col border-r border-[var(--border)] bg-[var(--surface)]">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
            >
              <IconClose width={18} height={18} />
            </button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ease-out md:flex"
        style={{ width: collapsed ? 64 : 240 }}
      >
        {sidebar(collapsed)}
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      {/* Follows you out of the study plan so a running session stays visible. */}
      <TimerPill />

      {/* On every signed-in page, because the page somebody is looking at when
          something goes wrong is the page they should be able to say so from. */}
      {/* Syllabi has its own buttons in that corner. */}
      {!pathname.startsWith('/dashboard/syllabi') && <FeedbackButton />}
    </div>
    </SyllabiProvider>
  )
}
