'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAuthCallbackUrl, getCurrentUser } from '@/lib/auth'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'
import PasswordField from '@/components/PasswordField'
import AuthShell, { OrRule, GoogleButton, SubmitButton } from '@/components/marketing/AuthShell'
import { CONSENT_TEXT } from '@/lib/consent'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Two separate consents: permission from a guardian, and agreement to the
  // terms. Only the first is a PDPL consent record, and only the first is
  // stored with its wording.
  const [guardianOk, setGuardianOk] = useState(false)
  const [termsOk, setTermsOk] = useState(false)
  const consented = guardianOk && termsOk
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  /**
   * Whoever is already signed in on this device.
   *
   * Signing up replaces the session without saying so, and the page that
   * follows looks identical whichever account you are in — so somebody who
   * makes a second account while logged in carries on believing they are on
   * their first one. Then the dashboard finds no profile for the new account,
   * sends them to onboarding, and they fill in their subjects again on an
   * account they did not mean to be using. That is exactly what happened
   * here: an account created at 09:11 had a full set of subjects by 09:17.
   *
   * Nothing is blocked. It just has to be said out loud first.
   */
  const [signedInAs, setSignedInAs] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    getCurrentUser(createClient()).then((user) => {
      if (!cancelled && user?.email) setSignedInAs(user.email)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Whoever is signed in on this device is signed out first.
    //
    // signUp does not replace an existing session. With email confirmation on
    // it returns a user and no session at all, so the browser stays logged in
    // as the previous person — and the new account's onboarding then writes
    // its answers onto that person's profile. That is not a theoretical race:
    // it happened, and it replaced a real student's subjects with a friend's.
    await supabase.auth.signOut()

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The code is carried through so onboarding can redeem it. The server
        // checks the email domain and the seat count, so nothing is self-granted.
        data: {
          full_name: name,
          school_code: schoolCode.trim().toUpperCase(),
          guardian_consent_text: CONSENT_TEXT.en,
          guardian_consent_at: new Date().toISOString(),
        },
        // Where the confirmation link lands. Without this, Supabase sends
        // people to its own domain instead of back here.
        emailRedirectTo: getAuthCallbackUrl('/onboarding'),
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // With email confirmation switched on, signUp returns a user but no
    // session. Pushing to /onboarding then bounces straight back to /login,
    // which reads as the sign-up having silently failed.
    if (data.user && !data.session) {
      setAwaitingConfirmation(true)
      setLoading(false)
      return
    }

    if (data.session) {
      router.push('/onboarding')
    }
  }

  const resendConfirmation = async () => {
    if (resending) return
    setResending(true)
    setResent(false)
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthCallbackUrl('/onboarding') },
    })
    if (resendError) setError(resendError.message)
    else setResent(true)
    setResending(false)
  }

  const handleGoogleSignup = async () => {
    // Google does not ask for the boxes first.
    //
    // Making somebody read and tick two consents before they can press a
    // one-press sign-in is friction in front of the cheapest path in, and it
    // put the legal text in the worst possible place: ahead of any reason to
    // care. It is asked for in onboarding instead, before the account can be
    // used for anything, and recorded there with its wording. Nothing is
    // skipped — it moves.
    setLoading(true)
    setError('')

    // Whoever is signed in on this device is signed out first. See the note on
    // the email path: a stale session is how one account's answers end up on
    // another's profile.
    await supabase.auth.signOut()
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthCallbackUrl('/dashboard')
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <main className="ground min-h-screen px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-md">
          <div className="mb-10 flex justify-center">
            <Link href="/" aria-label="Project Syllabus home">
              <Image src={logoMark} alt="Project Syllabus" sizes="120px" style={{ height: 38, width: 'auto' }} priority />
            </Link>
          </div>

          <div
            className="rounded-[12px] border p-6 md:p-7"
            style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
          >
            <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
              Almost there
            </p>
            <h1 className="mb-3 text-[26px] font-semibold leading-tight tracking-[-0.028em]">
              Check your email
            </h1>
            <p className="mb-6 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
              We sent a confirmation link to{' '}
              <strong className="text-[var(--text)]">{email}</strong>. Open it to finish setting up. It can take a minute, so check spam.
            </p>

            {resent && (
              <p className="mb-4 rounded-[var(--r-md)] border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
                Sent again. If it still does not arrive, the address may have a typo in it.
              </p>
            )}
            {error && <div className="error-box mb-4">{error}</div>}

            <div className="flex flex-col gap-3">
              <button
                onClick={resendConfirmation}
                disabled={resending}
                className="btn btn-quiet control-lg w-full text-base"
              >
                {resending ? 'Sending…' : 'Send it again'}
              </button>
              <button
                onClick={() => {
                  setAwaitingConfirmation(false)
                  setError('')
                }}
                className="btn btn-quiet control-md w-full"
              >
                Use a different email
              </button>
            </div>
          </div>

          <p className="t-caption mt-6 text-center">
            Already confirmed?{' '}
            <Link href="/login" className="text-[var(--brand)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <AuthShell
      eyebrow="Create an account"
      title="One subject, free, for as long as you want."
      intro="No card, no trial running out. Add a school code and every subject opens."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: 'var(--brand)' }}>
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogleSignup} disabled={loading} label="Continue with Google" />

      <OrRule />

          {/* Said before the form, not after the damage. */}
          {signedInAs && (
            <div
              className="elev mb-5 rounded-[12px] border p-4"
              style={{ borderColor: 'var(--status-developing)', background: 'var(--surface)' }}
            >
              <p className="text-[13.5px] font-medium">
                You are already signed in as {signedInAs}.
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
                Making another account will sign you out of that one on this device. Your work
                stays on it, but the next screens will be the new account, not that one.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/dashboard" className="btn btn-solid control-sm">
                  Back to my account
                </Link>
                <button
                  onClick={() => setSignedInAs(null)}
                  className="btn btn-outline control-sm"
                  type="button"
                >
                  Make a new one anyway
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div>
              <label className="label" htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                autoComplete="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="signup-password">Password</label>
              <PasswordField
                id="signup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div>
              <label className="label" htmlFor="signup-code">
                School code <span className="text-text-faint font-normal">(optional)</span>
              </label>
              <input
                id="signup-code"
                type="text"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="ABC123"
                autoCapitalize="characters"
                className="input uppercase"
              />
              <p className="text-text-faint text-xs mt-2">
                If your school has bought Project Syllabus, put the code here and every subject
                opens. Leave it blank to start on the free plan.
              </p>
            </div>

            {/* Both unticked by default and both required. Pre-ticked consent
                is not consent, and the PDPL wants it explicit for a minor. */}
            <div
              className="flex flex-col rounded-[10px] border px-4"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              <label className="flex cursor-pointer items-start gap-2.5 py-3">
                <input
                  type="checkbox"
                  checked={guardianOk}
                  onChange={(e) => setGuardianOk(e.target.checked)}
                  required
                  className="mt-[1px] h-[15px] w-[15px] shrink-0 accent-[var(--brand)]"
                />
                <span className="text-[12px] leading-[1.55]" style={{ color: 'var(--text-muted)' }}>
                  I have my parent or guardian&rsquo;s permission to use Project Syllabus.
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 py-2.5">
                <input
                  type="checkbox"
                  checked={termsOk}
                  onChange={(e) => setTermsOk(e.target.checked)}
                  required
                  className="mt-[1px] h-[15px] w-[15px] shrink-0 accent-[var(--brand)]"
                />
                <span className="text-[12px] leading-[1.55]" style={{ color: 'var(--text-muted)' }}>
                  I agree to the{' '}
                  <Link href="/terms" className="underline" style={{ color: 'var(--brand)' }}>
                    Terms
                  </Link>
                  ,{' '}
                  <Link href="/privacy" className="underline" style={{ color: 'var(--brand)' }}>
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link href="/cookies" className="underline" style={{ color: 'var(--brand)' }}>
                    Cookie Policy
                  </Link>
                  .
                </span>
              </label>
            </div>

            {error && <div className="error-box">{error}</div>}

            <SubmitButton disabled={loading || !consented}>
              {loading ? 'Creating account…' : 'Create account'}
            </SubmitButton>
          </form>
    </AuthShell>
  )
}
