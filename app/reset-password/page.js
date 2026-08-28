'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Logo from '@/components/Logo'
import PasswordField from '@/components/PasswordField'

/**
 * Where the reset email lands.
 *
 * Supabase puts a recovery token in the URL fragment and its client picks it
 * up, signing the browser in just long enough to change the password. Until
 * that has happened there is no session, so the form waits rather than letting
 * someone type a new password into a request that would fail.
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let settled = false

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        settled = true
        setReady(true)
      }
    })

    // The event may already have fired before this mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        settled = true
        setReady(true)
      }
    })

    // An expired or reused link never produces a session.
    const timer = setTimeout(() => {
      if (!settled) setInvalid(true)
    }, 3000)

    return () => {
      sub?.subscription?.unsubscribe()
      clearTimeout(timer)
    }
  }, [supabase])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    if (password !== confirm) {
      setError('Those two passwords are not the same.')
      return
    }
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1500)
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
          {done ? (
            <>
              <h1 className="t-page-title mb-2">Password changed</h1>
              <p className="t-small">Signing you in…</p>
            </>
          ) : invalid ? (
            <>
              <h1 className="t-page-title mb-2">That link has expired</h1>
              <p className="t-small mb-6">
                Reset links last an hour and only work once. Ask for a fresh one and it will arrive
                in a moment.
              </p>
              <Link href="/forgot-password" className="btn btn-solid control-lg w-full text-base">
                Send a new link
              </Link>
            </>
          ) : !ready ? (
            <>
              <h1 className="t-page-title mb-2">Checking your link</h1>
              <p className="t-small">One moment.</p>
            </>
          ) : (
            <>
              <h1 className="t-page-title mb-2">Set a new password</h1>
              <p className="t-small mb-6">Pick something you have not used here before.</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && <div className="error-box">{error}</div>}

                <div>
                  <label className="label" htmlFor="new-password">
                    New password
                  </label>
                  <PasswordField
                    id="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="confirm-password">
                    Type it again
                  </label>
                  <PasswordField
                    id="confirm-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="The same password"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || password.length < 8 || !confirm}
                  className="btn btn-solid control-lg w-full text-base"
                >
                  {saving ? 'Saving…' : 'Save new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
