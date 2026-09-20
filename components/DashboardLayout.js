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
import { planLabel, isPremium } from '@/lib/access'
import { clearCache } from '@/lib/cache'
import TimerPill from '@/components/TimerPill'
import FeedbackButton from '@/components/FeedbackButton'
import SyllabiLauncher from '@/components/SyllabiLauncher'
import { accessibleSubjects } from '@/lib/access'
import ThemeToggle from '@/components/ThemeToggle'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard, match: (p) => p === '/dashboard' },
  {
    href: '/dashboard/subjects',
    label: 'My Subjects',
    Icon: IconSubjects,
    match: (p) => p.startsWith('/dashboard/syllabus') || p === '/dashboard/subjects',
  },
  {
    href: '/dashboard/core',
    label: 'Diploma Core',
    Icon: IconSchool,
    match: (p) => p === '/dashboard/core',
  },
  {
    href: '/dashboard/flashcards',
    label: 'Flashcards',
    Icon: IconCards,
    match: (p) => p === '/dashboard/flashcards',
  },
  {
    href: '/dashboard/study-plan',
    label: 'Study Plan',
    Icon: IconStudyPlan,
    match: (p) => p === '/dashboard/study-plan',
  },
  {
    href: '/dashboard/test',
    label: 'Build a Test',
    Icon: IconTest,
    match: (p) => p === '/dashboard/test' || p.startsWith('/dashboard/quiz'),
  },
  {
    href: '/dashboard/calendar',
    label: 'Calendar',
    Icon: IconCalendar,
    match: (p) => p === '/dashboard/calendar',
  },
  {
    href: '/dashboard/prediction',
    label: 'Predicted Grade',
    Icon: IconTarget,
    match: (p) => p === '/dashboard/prediction',
  },
  {
    href: '/dashboard/progress',
    label: 'Progress',
    Icon: IconProgress,
    match: (p) => p === '/dashboard/progress' || p === '/dashboard/Heatmap',
  },
  {
    href: '/dashboard/mistakes',
    label: 'Redemption',
    Icon: IconReview,
    match: (p) => p === '/dashboard/mistakes',
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
        {/* The logo is a mark plus a wordmark and there is no mark-only
            version of it, so cropping it to 64px shows a sliver of letters.
            Collapsing is a request for space; the logo comes back with the
            labels, one click away. */}
        {!compact && (
          <Link href="/" className="inline-block" aria-label="Project Syllabus home">
            <Image src={logoMark} alt="Project Syllabus" sizes="68px" style={{ height: 26, width: 'auto' }} />
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

      <nav className="flex-1 overflow-y-auto px-3 pt-4" aria-label="Main">
        {!compact && (
          <p
            className="px-3 pb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'var(--text-faint)' }}
          >
            Menu
          </p>
        )}
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, Icon, match }) => {
            const active = match(pathname)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  title={compact ? label : undefined}
                  className={`relative flex items-center gap-3 rounded-[8px] py-2.5 text-[12.5px] transition-colors duration-150 ${
                    compact ? 'justify-center px-0' : 'px-3'
                  }`}
                  style={{
                    color: active ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: active ? 600 : 500,
                    background: active ? 'var(--surface-sunken)' : 'transparent',
                  }}
                >
                  {active && !compact && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                      style={{ background: 'var(--brand)' }}
                    />
                  )}
                  <Icon
                    width={17}
                    height={17}
                    style={{ color: active ? 'var(--brand)' : 'var(--text-faint)' }}
                  />
                  {!compact && label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mx-4 border-t border-[var(--border)]" />

      <div className={compact ? 'p-2' : 'p-3'}>
        {profile && (
          <div className={`mb-2 flex items-center gap-3 rounded-[10px] ${compact ? 'justify-center p-1' : 'p-3'}`}>
            <Avatar profile={profile} size={32} />
            <div className={`min-w-0 ${compact ? 'hidden' : ''}`}>
              <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                {profile.full_name || 'Student'}
              </p>
              {/* The e-mail, not the programme.
                  Two accounts on one device can easily carry the same name —
                  they did here — and "IB · Class of 2028" is true of both. The
                  address is the only line that tells them apart, which is the
                  whole question you are asking when you look at this block. */}
              <p className="t-caption truncate" title={email || undefined}>
                {email || `${profile.curriculum} · Class of ${profile.grad_year}`}
              </p>
            </div>
          </div>
        )}

        {profile && !isPremium(profile) && !compact && (
          <Link
            href="/dashboard/profile#unlock"
            className="mb-3 ml-3 block border-l-2 py-1 pl-3"
            style={{ borderColor: 'var(--brand)' }}
          >
            <p className="text-[13px] font-semibold text-[var(--text)]">{planLabel(profile)}</p>
            <p className="t-caption">Have a school code? Unlock everything.</p>
          </Link>
        )}

        <Link
          href="/dashboard/profile"
          title={compact ? 'Profile' : undefined}
          className={`control-md flex items-center gap-3 rounded-[8px] text-[12.5px] font-medium text-[var(--text-body)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] ${
            compact ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <IconUser width={17} height={17} className="text-[var(--text-faint)]" />
          {!compact && 'Profile'}
        </Link>

        <button
          onClick={handleLogout}
          disabled={signingOut}
          title={compact ? 'Sign out' : undefined}
          className={`control-md flex w-full items-center gap-3 rounded-[8px] text-[12.5px] font-medium text-[var(--text-body)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] disabled:opacity-50 ${
            compact ? 'justify-center px-0' : 'px-3'
          }`}
        >
          <IconLogout width={17} height={17} className="text-[var(--text-faint)]" />
          {!compact && (signingOut ? 'Signing out…' : 'Sign out')}
        </button>

        <div className={`flex items-center gap-4 pt-3 ${compact ? 'hidden' : 'px-3'}`}>
          <Link href="/privacy?from=dashboard" className="t-caption hover:text-[var(--text-muted)]">
            Privacy
          </Link>
          <Link href="/terms?from=dashboard" className="t-caption hover:text-[var(--text-muted)]">
            Terms
          </Link>
          <ThemeToggle className="ml-auto" />
        </div>
      </div>
    </>
  )

  return (
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
        <Link href="/" className="inline-block" aria-label="Project Syllabus home">
          <Image src={logoMark} alt="Project Syllabus" sizes="70px" style={{ height: 28, width: 'auto' }} />
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
      <FeedbackButton />
      {/* Syllabi follows the student around rather than living on a page of
          its own: asking for help should not mean leaving the thing you
          wanted help with. */}
      <SyllabiLauncher subjects={accessibleSubjects(profile)} />
    </div>
  )
}
