import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookieOptionsFor } from '@/lib/cookie-domain'

export async function proxy(request) {
  // The front page, for somebody already signed in, is their dashboard.
  //
  // A student who closed the tab and typed psyllabus.app again landed on the
  // marketing page, saw "Log in", and took it that they had been signed out.
  // They had not: the session was there, the page just never looked. Only the
  // cookie's presence is checked, so a visitor's front page still costs no
  // round trip; /dashboard verifies it properly. `?home` shows the front page
  // anyway.
  if (request.nextUrl.pathname === '/') {
    const signedIn = request.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name))
    if (signedIn && !request.nextUrl.searchParams.has('home')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const cookieOptions = cookieOptionsFor(request.nextUrl.hostname)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      ...(cookieOptions ? { cookieOptions } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, ...cookieOptions })
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected =
    path.startsWith('/dashboard') || path.startsWith('/onboarding')

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  // Only the routes that actually need a session. This used to match every
  // request, so opening the marketing pages cost a round trip to Supabase in
  // Singapore before anything could render.
  matcher: ['/', '/dashboard/:path*', '/onboarding/:path*'],
}
