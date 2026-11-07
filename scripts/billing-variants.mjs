/**
 * Lists the store and every product variant in your Lemon Squeezy store, with
 * the ids lib/billing.js needs, so nobody has to dig them out of the dashboard.
 *
 *   npm run billing-ids
 *
 * Reads LEMONSQUEEZY_API_KEY from .env.local (or the environment). Prints
 * ids and names only, never the key. A test-mode key lists the test store's
 * products, a live key the live ones: they have different ids.
 */
import { loadEnv } from './db.mjs'

loadEnv()
const key = process.env.LEMONSQUEEZY_API_KEY
if (!key) {
  console.error('Put LEMONSQUEEZY_API_KEY in .env.local first (Lemon Squeezy → Settings → API).')
  process.exit(1)
}

async function get(path) {
  const res = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${key}` },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.errors?.[0]?.detail || `Lemon Squeezy said ${res.status}`)
  return json
}

const stores = await get('/stores')
for (const s of stores.data) console.log(`LEMONSQUEEZY_STORE_ID=${s.id}    (${s.attributes.name}${s.attributes.test_mode ? ', test mode' : ''})`)

const products = await get('/products?page[size]=100')
const names = Object.fromEntries(products.data.map((p) => [p.id, p.attributes.name]))
const variants = await get('/variants?page[size]=100')
console.log('\nVariants (product · variant · price):')
for (const v of variants.data) {
  const a = v.attributes
  if (a.status === 'pending') continue
  const price = (a.price / 100).toFixed(2)
  const every = a.is_subscription ? ` every ${a.interval_count > 1 ? a.interval_count + ' ' : ''}${a.interval}` : ' once'
  console.log(`  ${v.id.padEnd(10)} ${names[a.product_id] || a.product_id} · ${a.name} · $${price}${every}`)
}
console.log('\nPut each id against its name in Vercel:')
console.log('  LEMONSQUEEZY_VARIANT_BASIC_MONTHLY, LEMONSQUEEZY_VARIANT_BASIC_YEARLY,')
console.log('  LEMONSQUEEZY_VARIANT_PREMIUM_MONTHLY, LEMONSQUEEZY_VARIANT_PREMIUM_YEARLY')
