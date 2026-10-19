/**
 * For route handlers that act as the signed-in student: a Supabase client
 * built from the request's own cookies, so every query runs under the
 * student's row-level security — never with more access than they have —
 * and a check that the request came from our own pages.
 *
 * Same approach as app/api/syllabi/route.js, with one difference in the
 * origin check: that one accepts any *.vercel.app origin, and anyone can put
 * a page on vercel.app. Here only this deployment, the configured site and
 * the production domain count.
 */

import { createServerClient } from '@supabase/ssr'
import { cookieOptionsFor } from '@/lib/cookie-domain'

export function supabaseFor(request) {
  const cookieOptions = cookieOptionsFor(request.nextUrl.hostname)
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    ...(cookieOptions ? { cookieOptions } : {}),
    cookies: {
      getAll: () => request.cookies.getAll(),
      // Nothing here changes the session, so there is nothing to write back.
      setAll: () => {},
    },
  })
}

/**
 * The request has to have come from our own pages. The session rides on a
 * cookie, and a cookie goes along with a request any other site makes from
 * the student's browser. A missing Origin is allowed — some same-origin
 * requests omit it — and a different one is not.
 */
export function fromOurOwnSite(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  if (origin === request.nextUrl.origin) return true
  const allowed = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'https://psyllabus.app',
    'https://www.psyllabus.app',
  ].filter(Boolean)
  return allowed.includes(origin)
}
