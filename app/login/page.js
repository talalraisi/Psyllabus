'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuthCallbackUrl } from '@/lib/auth'
import PasswordField from '@/components/PasswordField'
import AuthShell, { OrRule, GoogleButton, SubmitButton } from '@/components/marketing/AuthShell'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  // The OAuth callback redirects here with a reason when sign-in fails.
  // Without this it looked like nothing happened at all.
  useEffect(() => {
    const reason = params.get('error')
    if (reason) setError(reason === 'auth' ? 'Sign-in did not complete. Try again.' : reason)
  }, [params])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      // An unconfirmed address is the one sign-in failure the student can
      // actually fix, so offer the fix rather than just the error text.
      if (/confirm/i.test(authError.message)) setNeedsConfirmation(true)
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .single()

    router.push(profile ? '/dashboard' : '/onboarding')
  }

  const resendConfirmation = async () => {
    if (resending || !email) return
    setResending(true)
    setResent(false)
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthCallbackUrl('/onboarding') },
    })
    if (resendError) setError(resendError.message)
    else {
      setResent(true)
      setError('')
    }
    setResending(false)
  }

  const handleGoogleLogin = async () => {
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

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back."
      intro="Pick up where your last quiz left you."
      aside={[
        ['Your levels are where you left them', 'Nothing decays because you were away from the app. Only time away from the subtopic counts.'],
        ['One subject is still free', 'No trial running out in the background.'],
        ['Your notes never left this device', 'Nothing you pasted or uploaded was sent anywhere.'],
      ]}
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-medium" style={{ color: 'var(--brand)' }}>
            Create a free account
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogleLogin} disabled={loading} label="Continue with Google" />

      <OrRule />

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
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
          <div className="flex items-baseline justify-between gap-4">
            <label className="label" htmlFor="password">Password</label>
            <Link
              href="/forgot-password"
              className="mb-2 text-xs font-medium hover:underline"
              style={{ color: 'var(--brand)' }}
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="error-box">{error}</div>}

        {needsConfirmation && !resent && (
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resending}
            className="rounded-full border px-5 py-3 text-[13.5px] font-medium"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-body)' }}
          >
            {resending ? 'Sending…' : 'Resend the confirmation email'}
          </button>
        )}

        {resent && (
          <p
            className="rounded-[10px] border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--success-border)',
              background: 'var(--success-bg)',
              color: 'var(--success-text)',
            }}
          >
            Sent. Open the link in your inbox, then sign in.
          </p>
        )}

        <SubmitButton disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</SubmitButton>
      </form>
    </AuthShell>
  )
}

/**
 * useSearchParams needs a boundary, otherwise the whole page opts out of static
 * rendering and Next fails the build.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  )
}
