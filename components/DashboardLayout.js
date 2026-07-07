'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Logo from '@/components/Logo'

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
    href: '/dashboard/progress',
    label: 'Progress',
    icon: '📈',
    match: (p) => p === '/dashboard/progress' || p === '/dashboard/Heatmap',
  },
]

export default function DashboardLayout({ children, profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-[#f8f6f1] flex">
      <aside className="w-64 shrink-0 bg-white/95 border-r border-gray-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-gray-100">
          <Link href="/dashboard">
            <Logo width={140} height={42} />
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
                  active
                    ? 'bg-[#2D6A4F] text-white shadow-sm'
                    : 'text-[#1a2e1e] hover:bg-[#E8D5B0]/40'
                }`}
              >
                <span className="text-lg" aria-hidden="true">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {profile && (
          <div className="px-4 pb-2">
            <div className="rounded-xl bg-[#f8f6f1] p-4 border border-gray-100">
              <p className="font-semibold text-[#1a2e1e] text-sm truncate">
                {profile.full_name || 'Student'}
              </p>
              <p className="text-xs text-[#6b7280] mt-0.5">
                Class of {profile.grad_year} · {profile.curriculum}
              </p>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 space-y-1">
          <Link
            href="/dashboard/profile"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#1a2e1e] hover:bg-gray-100 transition text-sm font-medium"
          >
            <span aria-hidden="true">👤</span>
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#1a2e1e] hover:bg-gray-100 transition text-sm font-medium"
          >
            <span aria-hidden="true">🚪</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
