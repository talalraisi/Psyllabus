'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Logo from '@/components/Logo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    // Always report success. Saying "no account with that email" would let
    // anyone check which addresses are registered here.
    setSent(true)
  }

  return (
    <main className="page px-4 py-10 md:px-6 md:py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo width={180} height={54} priority className="h-auto w-[160px]" />
          </Link>
        </div>

        <div className="card p-6 md:p-8">
          {sent ? (
            <>
              <h1 className="t-page-title mb-2">Check your email</h1>
              <p className="t-small mb-6">
                If there is an account for{' '}
                <strong className="text-[var(--text)]">{email}</strong>, a reset link is on its way.
                It expires in an hour, and it is worth checking your spam folder.
              </p>
              <Link href="/login" className="btn btn-quiet control-lg w-full text-base">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="t-page-title mb-2">Reset your password</h1>
              <p className="t-small mb-6">
                Put in the email you signed up with and we will send you a link to set a new
                password.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && <div className="error-box">{error}</div>}

                <div>
                  <label className="label" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.com"
                    autoComplete="email"
                    required
                    className="input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="btn btn-solid control-lg w-full text-base"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="t-caption mt-6 text-center">
                Remembered it?{' '}
                <Link href="/login" className="text-[var(--brand)] hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
