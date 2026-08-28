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
  IconUser,
  IconLogout,
  IconMenu,
  IconClose,
} from '@/components/Icons'
import { planLabel, isPremium } from '@/lib/access'
import { clearCache } from '@/lib/cache'
import TimerPill from '@/components/TimerPill'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard, match: (p) => p === '/dashboard' },
  {
    href: '/dashboard/subjects',
    label: 'My Subjects',
    Icon: IconSubjects,
    match: (p) => p.startsWith('/dashboard/syllabus') || p === '/dashboard/subjects',
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
    label: 'Mistake Bank',
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

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


  const sidebar = (
    <>
      <div className="px-4 pt-5 pb-6">
        <Link href="/" className="inline-block" aria-label="PSyllabus home">
          <Image src={logoMark} alt="Project Syllabus" sizes="68px" style={{ height: 28, width: 'auto' }} />
        </Link>
      </div>

      <div className="mx-4 border-t border-[var(--border)]" />

      <nav className="flex-1 overflow-y-auto px-3 pt-4" aria-label="Main">
        <p className="t-overline px-3 pb-2">Menu</p>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, Icon, match }) => {
            const active = match(pathname)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`control-md flex items-center gap-3 rounded-[var(--r-md)] px-3 text-sm transition-colors duration-150 ${
                    active
                      ? 'bg-[var(--brand-tint)] text-[var(--brand)] font-semibold'
                      : 'text-[var(--text-body)] font-medium hover:bg-[var(--surface-sunken)]'
                  }`}
                >
                  <Icon
                    width={18}
                    height={18}
                    className={active ? 'text-[var(--brand)]' : 'text-[var(--text-faint)]'}
                  />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mx-4 border-t border-[var(--border)]" />

      <div className="p-3">
        {profile && (
          <div className="mb-2 flex items-center gap-3 rounded-[var(--r-md)] bg-[var(--surface-sunken)] p-3">
            <Avatar profile={profile} size={32} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                {profile.full_name || 'Student'}
              </p>
              <p className="t-caption truncate">
                {profile.curriculum} · Class of {profile.grad_year}
              </p>
            </div>
          </div>
        )}

        {profile && !isPremium(profile) && (
          <Link
            href="/dashboard/profile#unlock"
            className="mb-2 block rounded-[var(--r-md)] border border-[var(--sand)] bg-[var(--sand)]/30 px-3 py-2"
          >
            <p className="text-[13px] font-semibold text-[var(--text)]">{planLabel(profile)}</p>
            <p className="t-caption">Have a school code? Unlock everything.</p>
          </Link>
        )}

        <Link
          href="/dashboard/profile"
          className="control-md flex items-center gap-3 rounded-[var(--r-md)] px-3 text-sm font-medium text-[var(--text-body)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
        >
          <IconUser width={18} height={18} className="text-[var(--text-faint)]" />
          Profile
        </Link>

        <button
          onClick={handleLogout}
          disabled={signingOut}
          className="control-md flex w-full items-center gap-3 rounded-[var(--r-md)] px-3 text-sm font-medium text-[var(--text-body)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] disabled:opacity-50"
        >
          <IconLogout width={18} height={18} className="text-[var(--text-faint)]" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>

        <div className="flex gap-4 px-3 pt-3">
          <Link href="/privacy" className="t-caption hover:text-[var(--text-muted)]">
            Privacy
          </Link>
          <Link href="/terms" className="t-caption hover:text-[var(--text-muted)]">
            Terms
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] md:flex-row">
      {/* Mobile bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 md:hidden">
        <Link href="/" className="inline-block" aria-label="PSyllabus home">
          <Image src={logoMark} alt="Project Syllabus" sizes="58px" style={{ height: 24, width: 'auto' }} />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="control-md -mr-2 flex w-10 items-center justify-center rounded-[var(--r-md)] text-[var(--text)] transition-colors duration-150 hover:bg-[var(--surface-sunken)]"
        >
          <IconMenu />
        </button>
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
            {sidebar}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
        {sidebar}
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      {/* Follows you out of the study plan so a running session stays visible. */}
      <TimerPill />
    </div>
  )
}
