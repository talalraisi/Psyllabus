/**
 * Grant an account permanent admin access (premium, never expires).
 *
 *   npm run make-admin -- you@example.com
 *
 * Requires DATABASE_URL in .env.local.
 */

import { connect } from './db.mjs'

const email = process.argv[2]

if (!email) {
  console.error('Usage: npm run make-admin -- you@example.com')
  process.exit(1)
}

let client

async function main() {
  client = await connect()

  const { rows: users } = await client.query(
    'SELECT id FROM auth.users WHERE lower(email) = lower($1)',
    [email]
  )
  if (!users.length) {
    console.error(`No account found for ${email}. Sign up in the app first, then re-run this.`)
    process.exit(1)
  }

  await client.query(
    `UPDATE profiles
     SET is_admin = true, plan = 'premium', access_source = 'Developer'
     WHERE id = $1`,
    [users[0].id]
  )

  console.log(`${email} now has admin access with every feature unlocked.`)
  await client.end()
}

main().catch(async (err) => {
  console.error(err.message)
  await client?.end().catch(() => {})
  process.exit(1)
})
