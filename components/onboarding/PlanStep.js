'use client'

import { useState } from 'react'
import { PLANS, COMPARISON } from '@/lib/plans'
import { IconCheck, IconArrowRight } from '@/components/Icons'

/**
 * Choosing a plan, during sign-up, before the free subject.
 *
 * The plans and their prices, a place for a code, and an honest answer to
 * "No thanks": what a free account does not get, and then the free account.
 *
 * Nothing takes card payments yet, so choosing a paid plan says so plainly
 * and points at the two ways in that work today: a code, or starting free
 * and upgrading from Profile once payments open. It never pretends to
 * charge anyone.
 *
 * A code goes through redeem_access_code, the same as the one in Profile:
 * the database decides what it grants (Premium for some months, or for
 * good) and checks the school email domain and seat count.
 */

const missing = [
  { label: 'All your other subjects', basic: true },
  ...COMPARISON.flatMap((g) => g.rows.filter((r) => r.free === false).map((r) => ({ ...r, group: g.group }))),
]

export default function PlanStep({ supabase, onFree, onUnlocked }) {
  const [view, setView] = useState('plans') // plans | missing
  const [yearly, setYearly] = useState(true)
  const [chosen, setChosen] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [granted, setGranted] = useState(null)

  const redeem = async (e) => {
    e?.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setCodeError('')
    const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code.trim() })
    setBusy(false)
    if (error || !data?.ok) {
      setCodeError(data?.error || 'That code could not be used just now.')
      return
    }
    setGranted(data)
  }

  const codeBox = (
    <form onSubmit={redeem} className="rounded-[16px] border p-4 sm:p-5" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-sunken)' }}>
      <p className="text-[13.5px] font-semibold">Have a code?</p>
      <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
        From your school, a teacher or a friend. It can open Premium for a while, or for good.
      </p>
      {granted ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: 'var(--status-proficient)' }}>
            <IconCheck width={15} height={15} />
            {granted.label ? `${granted.label} is on your account.` : 'Unlocked.'} {granted.note || ''}
          </p>
          <button type="button" onClick={onUnlocked} className="btn btn-solid control-md">
            Go to my dashboard
            <IconArrowRight width={15} height={15} />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            aria-label="Code"
            autoCapitalize="characters"
            className="input h-11 flex-1 font-mono text-[16px] tracking-[0.12em] sm:text-[14px]"
          />
          <button type="submit" disabled={busy || !code.trim()} className="btn btn-outline control-lg">
            {busy ? 'Checking…' : 'Apply'}
          </button>
        </div>
      )}
      {codeError && (
        <p className="mt-2 text-[12.5px]" role="alert" style={{ color: 'var(--status-weak)' }}>
          {codeError}
        </p>
      )}
    </form>
  )

  if (view === 'missing') {
    return (
      <div className="rounded-[18px] border p-6 md:p-9" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
          Before you go free
        </p>
        <h1 className="mt-3 text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em]">Here is what free leaves out</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Free is the whole app for one subject, and it stays free. These are the things it does not include.
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {missing.map((r) => (
            <li key={r.label} className="flex items-start gap-3 rounded-[14px] border px-3.5 py-3" style={{ borderColor: 'var(--border)' }}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: r.basic ? 'var(--brand-tint)' : 'var(--flame-tint)', color: r.basic ? 'var(--brand)' : 'var(--flame)' }}>
                {r.basic ? 'B' : 'P'}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">{r.label}</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
                  {r.basic ? 'Basic and Premium' : 'Premium'}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6">{codeBox}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={() => setView('plans')} className="btn btn-quiet control-md">
            Back to the plans
          </button>
          <button type="button" onClick={onFree} className="btn btn-outline control-lg flex-1">
            Continue with one subject, free
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[18px] border p-6 md:p-9" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.03em]">Choose how you want to study</h1>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Made by students, for students. Priced like it.
          </p>
        </div>
        <div className="flex rounded-full p-0.5" style={{ background: 'var(--surface-sunken)' }} role="radiogroup" aria-label="Billing">
          {[
            [false, 'Monthly'],
            [true, 'Yearly'],
          ].map(([v, l]) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={yearly === v}
              onClick={() => setYearly(v)}
              className="rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={yearly === v ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 3px rgb(0 0 0 / 0.25)' } : { color: 'var(--text-muted)' }}
            >
              {l}
              {v && <span className="ml-1.5 text-[10.5px]" style={{ color: 'var(--brand)' }}>2 months free</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = plan.price ? (yearly && plan.annual ? plan.annual.replace(' a year', '') : plan.priceLabel) : '$0'
          const cadence = plan.price ? (yearly && plan.annual ? 'a year' : plan.cadence) : 'forever'
          const on = chosen === plan.id
          return (
            <section
              key={plan.id}
              className="flex flex-col rounded-[16px] border p-5 transition-colors"
              style={{ borderColor: on || plan.featured ? 'var(--brand)' : 'var(--border-strong)', background: plan.featured ? 'var(--brand-tint)' : 'var(--surface)' }}
            >
              <div className="flex items-baseline justify-between gap-2" style={{ minHeight: 24 }}>
                <h2 className="text-[15px] font-semibold">{plan.name}</h2>
                {plan.featured && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ background: 'var(--brand)', color: '#fff' }}>
                    Most useful
                  </span>
                )}
              </div>
              <p className="mt-3">
                <span className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{price}</span>{' '}
                <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                  {cadence}
                </span>
              </p>
              <p className="mt-1.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                {plan.tagline}
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-1.5">
                {plan.includes.map((i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: 'var(--text-body)' }}>
                    <IconCheck width={13} height={13} className="mt-0.5 shrink-0" style={{ color: 'var(--brand)' }} />
                    {i}
                  </li>
                ))}
              </ul>
              {plan.id === 'free' ? (
                <button type="button" onClick={() => setView('missing')} className="btn btn-outline control-md mt-5">
                  Start free
                </button>
              ) : (
                <button type="button" onClick={() => setChosen(plan.id)} className={`btn control-md mt-5 ${plan.featured ? 'btn-solid' : 'btn-outline'}`}>
                  Choose {plan.name}
                </button>
              )}
            </section>
          )
        })}
      </div>

      {chosen && (
        <div className="pop-enter mt-4 rounded-[16px] border p-4 sm:p-5" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)' }}>
          <p className="text-[13.5px] font-semibold">Card payments open very soon.</p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            Nothing is charged today. Use a code below if you have one, or start with one subject free and upgrade to {chosen === 'premium' ? 'Premium' : 'Basic'} from your Profile the moment payments are on.
          </p>
        </div>
      )}

      <div className="mt-5">{codeBox}</div>

      <button type="button" onClick={() => setView('missing')} className="mx-auto mt-5 block text-[13px] font-medium underline-offset-2 hover:underline" style={{ color: 'var(--text-muted)' }}>
        No thanks, I&apos;ll pass for now
      </button>
    </div>
  )
}
