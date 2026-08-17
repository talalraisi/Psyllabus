/**
 * Safely resolve the signed-in user. `supabase.auth.getUser()` can resolve with
 * a null data payload (expired refresh token, network failure, partially
 * restored session), which makes `const { data: { user } } = ...` throw and
 * take the whole page down. Always returns a user object or null.
 */
export async function getCurrentUser(supabase) {
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
