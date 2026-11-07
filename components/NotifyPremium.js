'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

/**
 * "Tell me when Premium opens", while paid plans are not on sale yet.
 *
 * Signed in: one press puts them on the list (104-premium-interest.sql), and
 * the button says so from then on. Signed out: the way onto the list is a
 * free account, since that is where their email lives.
 */
export default function NotifyPremium({ plan = 'premium', cycle = null, className = '' }) {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState(undefined)
  const [state, setState] = useState('idle') // idle | busy | on | error

  useEffect(() => {
    let live = true
    getCurrentUser(supabase).then(async (u) => {
      if (!live) return
      setUser(u || null)
      if (!u) return
      const { data } = await supabase.from('premium_interest').select('user_id').eq('user_id', u.id).maybeSingle()
      if (live && data) setState('on')
    })
    return () => {
      live = false
    }
  }, [supabase])

  const join = async () => {
    setState('busy')
    const { error } = await supabase
      .from('premium_interest')
      .upsert({ user_id: user?.id, plan, cycle: cycle || null }, { onConflict: 'user_id' })
    setState(error ? 'error' : 'on')
  }

  if (user === undefined) return <div className={className} style={{ minHeight: 44 }} />

  if (user === null) {
    return (
      <div className={className}>
        <Link href="/signup" className="btn btn-solid control-md w-full justify-center">
          Sign up free, and hear first when Premium opens
        </Link>
      </div>
    )
  }

  return (
    <div className={className}>
      {state === 'on' ? (
        <p className="rounded-[12px] border px-4 py-3 text-[13.5px]" style={{ borderColor: 'color-mix(in oklab, var(--brand) 45%, transparent)', background: 'color-mix(in oklab, var(--brand) 8%, transparent)' }}>
          <span className="font-semibold" style={{ color: 'var(--brand)' }}>
            You are on the list.
          </span>{' '}
          We will email you the day Premium opens.
        </p>
      ) : (
        <button type="button" onClick={join} disabled={state === 'busy'} className="btn btn-solid control-md w-full justify-center">
          {state === 'busy' ? 'Adding you…' : 'Tell me when Premium opens'}
        </button>
      )}
      {state === 'error' && (
        <p className="mt-2 text-[12.5px]" role="alert" style={{ color: 'var(--danger)' }}>
          That did not go through. Try again in a moment.
        </p>
      )}
    </div>
  )
}
