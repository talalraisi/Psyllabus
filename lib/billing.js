/**
 * Paid plans, sold through Lemon Squeezy (it is the merchant of record:
 * it charges, handles VAT and pays out to an Omani bank).
 *
 * Four products in the store, one per plan and billing cycle. Their variant
 * ids live in the environment, so a test store and the live store swap
 * without a code change:
 *
 *   LEMONSQUEEZY_API_KEY             API key (Settings → API)
 *   LEMONSQUEEZY_STORE_ID            the store's id
 *   LEMONSQUEEZY_WEBHOOK_SECRET      the signing secret given to the webhook
 *   LEMONSQUEEZY_VARIANT_BASIC_MONTHLY / _BASIC_YEARLY
 *   LEMONSQUEEZY_VARIANT_PREMIUM_MONTHLY / _PREMIUM_YEARLY
 *   SUPABASE_SERVICE_ROLE_KEY        lets the webhook set a student's plan
 *   NEXT_PUBLIC_BILLING_LIVE=1       shows the buy buttons
 *
 * Server only, apart from billingLive.
 */

export const billingLive = process.env.NEXT_PUBLIC_BILLING_LIVE === '1'

const VARIANT_ENV = {
  'basic:monthly': 'LEMONSQUEEZY_VARIANT_BASIC_MONTHLY',
  'basic:yearly': 'LEMONSQUEEZY_VARIANT_BASIC_YEARLY',
  'premium:monthly': 'LEMONSQUEEZY_VARIANT_PREMIUM_MONTHLY',
  'premium:yearly': 'LEMONSQUEEZY_VARIANT_PREMIUM_YEARLY',
}

export function variantFor(plan, cycle) {
  const name = VARIANT_ENV[`${plan}:${cycle}`]
  return name ? process.env[name] || null : null
}

/** The plan and cycle a variant id stands for, or null for one we do not sell. */
export function planForVariant(variantId) {
  const id = String(variantId ?? '')
  for (const [key, name] of Object.entries(VARIANT_ENV)) {
    if (id && process.env[name] === id) {
      const [plan, cycle] = key.split(':')
      return { plan, cycle }
    }
  }
  return null
}

/** Statuses during which the student has what they paid for. A cancelled
 *  subscription runs to the end of its period; expired is the end. */
export const ACTIVE_STATUSES = new Set(['on_trial', 'active', 'past_due', 'cancelled'])

export async function lemon(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.errors?.[0]?.detail || `Lemon Squeezy ${res.status}`)
  return json
}

export const billingConfigured = () =>
  Boolean(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID && process.env.LEMONSQUEEZY_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY)
