import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { ACTIVE_STATUSES, planForVariant } from '@/lib/billing'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Lemon Squeezy tells us about subscriptions here, signed with the secret we
 * gave it. A request whose signature does not match the raw body is turned
 * away before anything is read from it.
 *
 * Every subscription event carries the whole subscription, so each one is
 * handled the same way: record it, then set the student's plan from it.
 * The student is found by the user id we put into the checkout, or, for
 * later events, by the subscription id we stored the first time.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function signed(raw, header) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret || !header) return false
  const digest = Buffer.from(crypto.createHmac('sha256', secret).update(raw).digest('hex'), 'utf8')
  const given = Buffer.from(header, 'utf8')
  return digest.length === given.length && crypto.timingSafeEqual(digest, given)
}

export async function POST(request) {
  const raw = await request.text()
  if (!signed(raw, request.headers.get('x-signature'))) return NextResponse.json({ error: 'Bad signature.' }, { status: 401 })

  let event
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Malformed.' }, { status: 400 })
  }
  const name = event?.meta?.event_name || ''
  if (!name.startsWith('subscription_') || event?.data?.type !== 'subscriptions') return NextResponse.json({ ok: true, ignored: name })

  const sub = event.data
  const a = sub.attributes || {}
  const which = planForVariant(a.variant_id)
  if (!which) {
    console.error('billing webhook: unknown variant', a.variant_id)
    return NextResponse.json({ ok: true, ignored: 'unknown variant' })
  }

  const db = supabaseAdmin()
  let userId = event?.meta?.custom_data?.user_id || null
  if (!userId) {
    const { data } = await db.from('subscriptions').select('user_id').eq('subscription_id', String(sub.id)).maybeSingle()
    userId = data?.user_id || null
  }
  if (!userId) {
    console.error('billing webhook: no student for subscription', sub.id)
    return NextResponse.json({ ok: true, ignored: 'no student' })
  }

  const row = {
    user_id: userId,
    subscription_id: String(sub.id),
    customer_id: a.customer_id != null ? String(a.customer_id) : null,
    variant_id: String(a.variant_id),
    plan: which.plan,
    cycle: which.cycle,
    status: a.status,
    renews_at: a.renews_at || null,
    ends_at: a.ends_at || null,
    test_mode: Boolean(a.test_mode),
    updated_at: new Date().toISOString(),
  }
  const { error: subError } = await db.from('subscriptions').upsert(row, { onConflict: 'user_id' })
  if (subError) {
    console.error('billing webhook: save', subError.message)
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  }

  // Paid up (or cancelled but still inside what they paid for): the plan.
  // Expired, unpaid or paused: back to free. A school licence is separate
  // (access_expires_at) and untouched either way.
  const plan = ACTIVE_STATUSES.has(a.status) ? which.plan : 'free'
  const { error: planError } = await db.from('profiles').update({ plan }).eq('id', userId)
  if (planError) {
    console.error('billing webhook: plan', planError.message)
    return NextResponse.json({ error: 'Could not set the plan.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, plan })
}
