'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { getAuthCallbackUrl } from '@/lib/auth'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The code is carried through so onboarding can redeem it. The server
        // checks the email domain and the seat count, so nothing is self-granted.
        data: { full_name: name, school_code: schoolCode.trim().toUpperCase() },
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
    setLoading(true)
    setError('')
    
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
      <main className="page px-4 py-10 md:px-6 md:py-12">
        <div className="mx-auto max-w-md">
          <div className="mb-8 flex justify-center">
            <Link href="/">
              <Logo width={180} height={54} priority className="h-auto w-[160px]" />
            </Link>
          </div>

          <div className="card p-6 md:p-8">
            <h1 className="t-page-title mb-2">Check your email</h1>
            <p className="t-small mb-6">
              We sent a confirmation link to{' '}
              <strong className="text-[var(--text)]">{email}</strong>. Open it and you will land
              back here to finish setting up. It can take a minute to arrive, and it is worth
              checking your spam folder.
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
    <main className="page page-center">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Logo width={350} height={105} priority />
          </Link>
        </div>

        <div className="card card-pad">
          <h1 className="text-2xl font-bold text-text mb-2">Create your account</h1>
          <p className="text-text-muted text-sm mb-8">
            Already have an account?{' '}
            <Link href="/login" className="link font-medium">Sign in</Link>
          </p>

          <button
            onClick={handleGoogleSignup}
            disabled={loading}
            className="btn btn-quiet control-lg mb-4 w-full text-base"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-text-faint text-xs">or</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div>
              <label className="label">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="input"
              />
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.com"
                required
                className="input"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                className="input"
              />
            </div>

            <div>
              <label className="label">
                School code <span className="text-text-faint font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="School code"
                autoCapitalize="characters"
                className="input uppercase"
              />
              <p className="text-text-faint text-xs mt-2">
                If your school has bought Project Syllabus, put the code here and every subject
                opens. Leave it blank to start on the free plan.
              </p>
            </div>

            {error && <div className="error-box">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-solid control-lg mt-2 w-full text-base"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-text-faint text-xs text-center mt-6">
          © 2026 Project Syllabus · Built in Muscat, Oman
        </p>
      </div>
    </main>
  )
}
