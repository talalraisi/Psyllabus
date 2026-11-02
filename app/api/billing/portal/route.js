import { NextResponse } from 'next/server'
import { billingConfigured, lemon } from '@/lib/billing'
import { fromOurOwnSite, supabaseFor } from '@/lib/request-supabase'

/**
 * Where a subscriber manages their plan: change it, update the card, cancel.
 * Lemon Squeezy's portal link is signed and short-lived, so it is fetched
 * fresh each time rather than stored.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  if (!fromOurOwnSite(request)) return NextResponse.json({ error: 'Not allowed from there.' }, { status: 403 })
  if (!billingConfigured()) return NextResponse.json({ error: 'Billing is not open yet.' }, { status: 503 })
  const supabase = supabaseFor(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data: sub } = await supabase.from('subscriptions').select('subscription_id').eq('user_id', user.id).maybeSingle()
  if (!sub) return NextResponse.json({ error: 'No subscription on this account.' }, { status: 404 })
  try {
    const res = await lemon(`/subscriptions/${sub.subscription_id}`)
    return NextResponse.json({ url: res.data.attributes.urls.customer_portal })
  } catch (e) {
    console.error('billing portal:', e?.message || e)
    return NextResponse.json({ error: 'Could not open billing just now.' }, { status: 502 })
  }
}
