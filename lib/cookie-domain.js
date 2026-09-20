/**
 * One cookie scope for every Supabase client.
 *
 * The apex and www are different origins and a host-only cookie set on one is
 * not sent to the other, so the browser client was already setting auth
 * cookies on the parent domain. The proxy and the OAuth callback were
 * not: they wrote the same cookie names host-only on whichever host served the
 * request.
 *
 * Two cookies with one name at two scopes is the worst of both. The browser
 * sends both, the server reads whichever it happens to get first, and a
 * sign-in can fail with the verifier "missing" while a stale copy of the same
 * cookie is sitting right next to it.
 *
 * Everything that reads or writes a Supabase cookie now derives its domain
 * from here, so there is only ever one of each.
 *
 * Locally there is no parent domain to set and localhost is a single origin,
 * so it returns undefined and the cookie stays host-only, which is correct.
 */
export function cookieDomainFor(hostname) {
  if (!hostname) return undefined
  const host = String(hostname).split(':')[0].toLowerCase()
  return host === 'psyllabus.app' || host.endsWith('.psyllabus.app')
    ? '.psyllabus.app'
    : undefined
}

/** The options object to hand to createBrowserClient / createServerClient. */
export function cookieOptionsFor(hostname) {
  const domain = cookieDomainFor(hostname)
  return domain ? { domain } : undefined
}
