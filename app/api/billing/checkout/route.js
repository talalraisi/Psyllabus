import { NextResponse } from 'next/server'
import { billingConfigured, lemon, variantFor } from '@/lib/billing'
import { fromOurOwnSite, supabaseFor } from '@/lib/request-supabase'

/**
 * A Lemon Squeezy checkout for the signed-in student: the plan and cycle
 * they chose, their email filled in, and their user id carried through so
 * the webhook knows whose plan to change.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  if (!fromOurOwnSite(request)) return NextResponse.json({ error: 'Not allowed from there.' }, { status: 403 })
  if (!billingConfigured()) return NextResponse.json({ error: 'Paid plans are not open yet.' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const plan = body?.plan === 'basic' ? 'basic' : body?.plan === 'premium' ? 'premium' : null
  const cycle = body?.cycle === 'yearly' ? 'yearly' : 'monthly'
  const variant = plan && variantFor(plan, cycle)
  if (!variant) return NextResponse.json({ error: 'That plan is not on sale.' }, { status: 400 })

  const supabase = supabaseFor(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.', code: 'signed_out' }, { status: 401 })

  const site = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  try {
    const res = await lemon('/checkouts', {
      method: 'POST',
      body: {
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: { email: user.email || undefined, custom: { user_id: user.id } },
            product_options: { redirect_url: `${site}/dashboard/profile?upgraded=1#unlock` },
          },
          relationships: {
            store: { data: { type: 'stores', id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
            variant: { data: { type: 'variants', id: String(variant) } },
          },
        },
      },
    })
    return NextResponse.json({ url: res.data.attributes.url })
  } catch (e) {
    console.error('billing checkout:', e?.message || e)
    return NextResponse.json({ error: 'Could not open the checkout. Try again in a moment.' }, { status: 502 })
  }
}
