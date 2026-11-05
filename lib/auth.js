/**
 * Safely resolve the signed-in user. `supabase.auth.getUser()` can resolve with
 * a null data payload (expired refresh token, network failure, partially
 * restored session), which makes `const { data: { user } } = ...` throw and
 * take the whole page down. Always returns a user object or null.
 *
 * getSession() is tried first because it reads the stored token locally, while
 * getUser() is a network call to Supabase that every dashboard page was paying
 * before it could even ask for data. Skipping it is safe here: proxy.js
 * verifies the token server-side on every /dashboard request, and row level
 * security checks auth.uid() on every query, so a tampered local token buys
 * nothing. The id is only ever used to shape a request the server re-checks.
 */
export async function getCurrentUser(supabase) {
  try {
    const session = await supabase.auth.getSession()
    const user = session?.data?.session?.user
    if (user?.id) return user
  } catch {
    // Fall through to the authoritative call.
  }

  try {
    const result = await supabase.auth.getUser()
    return result?.data?.user?.id ? result.data.user : null
  } catch {
    return null
  }
}

/**
 * Where to send someone after sign-in, if it is a page on this site.
 *
 * Checking for a leading "/" is not enough: browsers read a backslash as a
 * slash and drop tabs and newlines, so "/\evil.com" and "/\t/evil.com" both
 * go to evil.com. Resolving against a fixed origin and requiring it to come
 * back unchanged is the check the browser itself will apply.
 */
export function getSafeNextPath(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return '/dashboard'
  }
  try {
    const base = 'https://psyllabus.invalid'
    const url = new URL(next, base)
    if (url.origin !== base) return '/dashboard'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/dashboard'
  }
}

/**
 * The one host the site is actually served from.
 *
 * Sending Google back to the apex means a 308 to www mid-flow, and any host
 * that differs from the one the sign-in started on is a host where the PKCE
 * verifier cookie may not be readable. Pinning the callback to the canonical
 * host keeps the whole round trip on a single origin.
 */
function canonicalOrigin() {
  if (typeof window === 'undefined') return ''
  const { origin, hostname, protocol } = window.location
  if (hostname === 'psyllabus.app') return `${protocol}//www.psyllabus.app`
  return origin
}

export function getAuthCallbackUrl(next) {
  const origin = canonicalOrigin()
  const url = new URL('/auth/callback', origin)
  const safeNext = getSafeNextPath(next)
  if (safeNext !== '/dashboard') {
    url.searchParams.set('next', safeNext)
  }
  return url.toString()
}
