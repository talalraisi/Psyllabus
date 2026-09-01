import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { getSafeNextPath } from '@/lib/auth'

/**
 * Where Google sends people back to.
 *
 * Session cookies are written onto the response rather than through
 * next/headers cookies(). A route handler that returns a redirect cannot
 * reliably set cookies that way, and middleware used to cover this path and
 * quietly do it instead. Once the matcher was narrowed to /dashboard and
 * /onboarding, nothing was persisting the session and every Google sign-in
 * failed. The response owns its cookies now, so it does not depend on
 * middleware running here at all.
 */
export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const oauthError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error')
  const next = getSafeNextPath(requestUrl.searchParams.get('next'))

  const fail = (reason) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(String(reason).slice(0, 200))}`, requestUrl.origin)
    )

  // Google itself refused, so there is no code to exchange.
  if (oauthError) return fail(oauthError)
  if (!code) return fail('No sign-in code came back. Try again.')

  // Built up front so the Supabase client can write cookies straight onto it.
  let response = NextResponse.redirect(new URL(next, requestUrl.origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return fail(error.message || 'Could not complete sign-in.')

  const user = data?.session?.user ?? data?.user
  if (!user) return fail('Signed in, but no account came back. Try again.')

  // Someone signing in for the first time has no profile yet, so send them to
  // onboarding rather than a dashboard with nothing in it.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  const destination = profile ? next : '/onboarding'

  // Redirect target changed, so rebuild it while keeping the cookies already
  // written onto the old response.
  if (destination !== next) {
    const redirected = NextResponse.redirect(new URL(destination, requestUrl.origin))
    for (const cookie of response.cookies.getAll()) redirected.cookies.set(cookie)
    response = redirected
  }

  return response
}
