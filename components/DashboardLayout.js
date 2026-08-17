'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import logoMark from '@/public/logo-mark.png'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', match: (p) => p === '/dashboard' },
  {
    href: '/dashboard/subjects',
    label: 'My Subjects',
    icon: '📚',
    match: (p) => p.startsWith('/dashboard/syllabus') || p === '/dashboard/subjects',
  },
  {
    href: '/dashboard/study-plan',
    label: 'Study Plan',
    icon: '📝',
    match: (p) => p === '/dashboard/study-plan',
  },
  {
    href: '/dashboard/test',
    label: 'Build a Test',
    icon: '🧪',
    match: (p) => p === '/dashboard/test' || p.startsWith('/dashboard/quiz'),
  },
  {
    href: '/dashboard/progress',
    label: 'Progress',
    icon: '📈',
    match: (p) => p === '/dashboard/progress' || p === '/dashboard/Heatmap',
  },
  {
    href: '/dashboard/mistakes',
    label: 'Mistake Bank',
    icon: '🔁',
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
        className="rounded-full object-cover border border-[#f0f0f0] shrink-0"
      />
    )
  }
  const initial = (profile?.full_name || 'S')[0].toUpperCase()
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-[#f0fdf4] border border-[#f0f0f0] flex items-center justify-center text-sm font-bold text-[#2D6A4F] shrink-0"
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

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarContent = (
    <>
      <div className="pt-5 px-4 pb-6">
        <Link href="/" className="inline-block">
          <Image src={logoMark} alt="PSyllabus" style={{ height: '28px', width: 'auto' }} />
        </Link>
      </div>

      <div className="border-t border-[#f3f4f6] mx-3" />

      <nav className="flex-1 px-3 pt-2 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium px-3 pt-2 pb-1">
          Menu
        </p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center h-9 px-3 rounded-md text-sm transition-colors border-l-[3px] ${
                  active
                    ? 'bg-[#f0fdf4] text-[#2D6A4F] font-semibold border-[#2D6A4F]'
                    : 'text-[#374151] font-medium border-transparent hover:bg-[#f9fafb]'
                }`}
              >
                <span className="text-base mr-2.5 opacity-70" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-[#f3f4f6] mx-3" />

      <div className="p-3">
        {profile && (
          <div className="rounded-lg bg-[#f9fafb] p-3 mb-2 flex items-center gap-3">
            <Avatar profile={profile} size={32} />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#1a2e1e] truncate">
                {profile.full_name || 'Student'}
              </p>
              <p className="text-xs text-[#6b7280] mt-0.5">
                {profile.curriculum} · Class of {profile.grad_year}
              </p>
            </div>
          </div>
        )}
        <Link
          href="/dashboard/profile"
          className="flex items-center h-9 px-3 rounded-md text-sm font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors"
        >
          Profile
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center h-9 px-3 rounded-md text-sm font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors"
        >
          Sign out
        </button>
        <div className="flex gap-3 px-3 pt-2">
          <Link href="/privacy" className="text-[11px] text-[#9ca3af] hover:text-[#6b7280]">
            Privacy
          </Link>
          <Link href="/terms" className="text-[11px] text-[#9ca3af] hover:text-[#6b7280]">
            Terms
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#f8f6f1] flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#f3f4f6] flex items-center justify-between px-4 h-14">
        <Link href="/" className="inline-block">
          <Image src={logoMark} alt="PSyllabus" style={{ height: '24px', width: 'auto' }} />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-[#f9fafb] transition-colors"
        >
          <span className="block w-5 h-0.5 bg-[#1a2e1e] rounded" />
          <span className="block w-5 h-0.5 bg-[#1a2e1e] rounded" />
          <span className="block w-5 h-0.5 bg-[#1a2e1e] rounded" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-white border-r border-[#f3f4f6] flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 w-8 h-8 rounded-lg text-[#6b7280] hover:bg-[#f9fafb] transition-colors text-lg leading-none"
            >
              ×
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[220px] shrink-0 bg-white border-r border-[#f3f4f6] flex-col sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
