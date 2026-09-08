import { createBrowserClient } from '@supabase/ssr'

/**
 * The apex and www are two different origins, and a cookie set on one is not
 * sent to the other.
 *
 * psyllabus.app answers with a 308 to www.psyllabus.app, so the site is served
 * from www — but the PKCE sign-in flow only works if the verifier cookie
 * written when you press "Continue with Google" is still readable when Google
 * sends you back. Land on the other host and it is not there, and the exchange
 * fails with "PKCE code verifier not found in storage", which reads like
 * broken storage rather than a redirect that changed hosts.
 *
 * Setting the cookie on the parent domain makes it valid for both, so it no
 * longer matters which one the round trip finishes on. Locally there is no
 * parent domain to set, and localhost is a single origin anyway.
 */
function cookieDomain() {
  if (typeof window === 'undefined') return undefined
  const { hostname } = window.location
  return hostname.endsWith('psyllabus.app') ? '.psyllabus.app' : undefined
}

export function createClient() {
  const domain = cookieDomain()
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    domain ? { cookieOptions: { domain } } : undefined
  )
}
