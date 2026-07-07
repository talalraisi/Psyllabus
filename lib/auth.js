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
