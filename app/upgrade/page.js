'use client'

/**
 * Between the pricing page and the checkout: the plan chosen, monthly or
 * yearly, and one button. Signed out, it says to make an account first,
 * because a payment has to land on an account.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageShell from '@/components/marketing/PageShell'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { PLANS } from '@/lib/plans'
import { billingLive } from '@/lib/billing'
import { IconArrowRight, IconCheck } from '@/components/Icons'

function Upgrade() {
  const params = useSearchParams()
  const plan = PLANS.find((p) => p.id === params.get('plan') && p.id !== 'free') || PLANS.find((p) => p.id === 'premium')
  const [cycle, setCycle] = useState(params.get('cycle') === 'yearly' ? 'yearly' : 'monthly')
  const [user, setUser] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCurrentUser(createClient()).then((u) => setUser(u || null))
  }, [])

  const go = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: plan.id, cycle }) })
      const json = await res.json()
      if (json.url) {
        window.location.assign(json.url)
        return
      }
      setError(json.error || 'Could not open the checkout.')
    } catch {
      setError('Could not reach the checkout. Check your connection and try again.')
    }
    setBusy(false)
  }

  const yearly = plan.annual
  return (
    <div className="ground mx-auto max-w-lg px-5 py-12 md:py-16">
      <Link href="/pricing" className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>
        ← All plans
      </Link>
      <div className="mt-6 rounded-[20px] border p-6 sm:p-8" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
          {plan.name}
        </p>
        <h1 className="mt-2 text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.03em]">{plan.tagline}</h1>
        <ul className="mt-5 flex flex-col gap-2">
          {plan.includes.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14px]" style={{ color: 'var(--text-body)' }}>
              <IconCheck width={15} height={15} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How often to pay">
          {[
            ['monthly', plan.priceLabel, 'a month'],
            ['yearly', yearly?.split(' ')[0], 'a year, two months free'],
          ].map(([key, price, line]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={cycle === key}
              onClick={() => setCycle(key)}
              className="rounded-[14px] border p-3.5 text-left transition-colors"
              style={{ borderColor: cycle === key ? 'var(--brand)' : 'var(--border-strong)', background: cycle === key ? 'var(--surface)' : 'transparent' }}
            >
              <span className="block text-[20px] font-semibold tracking-[-0.02em]">{price}</span>
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {line}
              </span>
            </button>
          ))}
        </div>

        {!billingLive ? (
          <p className="mt-6 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
            Paid plans open soon. Make a free account now and you can upgrade from your profile the day they do.
          </p>
        ) : user === null ? (
          <div className="mt-6">
            <p className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              Make your account first, so the plan has somewhere to go. Then come back here.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/signup" className="btn btn-solid control-md flex-1 justify-center">
                Sign up
              </Link>
              <Link href="/login" className="btn btn-outline control-md flex-1 justify-center">
                Log in
              </Link>
            </div>
          </div>
        ) : (
          <button type="button" onClick={go} disabled={busy || user === undefined} className="btn btn-solid control-lg mt-6 w-full">
            {busy ? 'Opening the checkout…' : `Continue to payment`}
            {!busy && <IconArrowRight width={16} height={16} />}
          </button>
        )}
        {error && (
          <p className="mt-3 text-[13px]" role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
        <p className="mt-4 text-[12px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
          Payment is handled by Lemon Squeezy. Cancel any time from your profile; you keep the plan until the end of what you paid for.
        </p>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <PageShell>
      <Suspense fallback={null}>
        <Upgrade />
      </Suspense>
    </PageShell>
  )
}
