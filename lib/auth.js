/**
 * Safely resolve the signed-in user. `supabase.auth.getUser()` can resolve with
 * a null data payload (expired refresh token, network failure, partially
 * restored session), which makes `const { data: { user } } = ...` throw and
 * take the whole page down. Always returns a user object or null.
 *
 * getSession() is tried first because it reads the stored token locally, while
 * getUser() is a network call to Supabase that every dashboard page was paying
 * before it could even ask for data. Skipping it is safe here: middleware.js
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

export function getSafeNextPath(next) {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    return next
  }
  return '/dashboard'
}

export function getAuthCallbackUrl(next) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL('/auth/callback', origin)
  const safeNext = getSafeNextPath(next)
  if (safeNext !== '/dashboard') {
    url.searchParams.set('next', safeNext)
  }
  return url.toString()
}
