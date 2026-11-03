import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getSafeNextPath } from '@/lib/auth'
import { cookieOptionsFor } from '@/lib/cookie-domain'

/**
 * Where the links in our emails land: confirm sign-up, reset password,
 * change email, sign-in link.
 *
 * The link carries a one-time token that is checked here, on the server, so
 * it works in whatever browser opens it. The old links went through
 * /auth/callback, which needs a secret the sign-up browser kept for itself;
 * opened from a mail app (its own browser), that secret is not there and the
 * link failed with "could not be matched to this browser".
 *
 * The templates (supabase/email-templates) link here as
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…
 */

const TYPES = new Set(['signup', 'email', 'recovery', 'email_change', 'magiclink', 'invite'])

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = getSafeNextPath(requestUrl.searchParams.get('next'))

  const fail = (reason) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, requestUrl.origin))

  if (!tokenHash || !TYPES.has(type)) return fail('That link is not complete. Open it from the email again.')

  // Built up front so the Supabase client can write cookies straight onto it.
  let response = NextResponse.redirect(new URL(next, requestUrl.origin))

  const cookieOptions = cookieOptionsFor(requestUrl.hostname)

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
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, ...cookieOptions })
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) {
    // Each link works once and for a limited time. A confirmed account just
    // signs in, so say that rather than only that something failed.
    return fail(
      type === 'recovery'
        ? 'That reset link has expired or was already used. Press Forgot password for a new one.'
        : 'That link has expired or was already used. If you already confirmed your email, sign in below.'
    )
  }

  const user = data?.session?.user ?? data?.user
  let destination = next
  if (type === 'recovery') destination = '/reset-password'
  else if (user) {
    // Someone confirming a new account has no profile yet: onboarding first.
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (!profile) destination = '/onboarding'
  }

  // Redirect target changed, so rebuild it while keeping the cookies already
  // written onto the old response.
  if (destination !== next) {
    const redirected = NextResponse.redirect(new URL(destination, requestUrl.origin))
    for (const cookie of response.cookies.getAll()) redirected.cookies.set(cookie)
    response = redirected
  }
  return response
}
