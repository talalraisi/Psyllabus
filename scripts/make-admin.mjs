/**
 * Grant an account permanent admin access (premium, never expires), or take
 * it away again.
 *
 *   npm run make-admin -- you@example.com
 *   npm run make-admin -- someone@example.com --remove    back to the free plan
 *
 * Requires DATABASE_URL in .env.local.
 */

import { connect } from './db.mjs'

const email = process.argv.slice(2).find((a) => !a.startsWith('--'))
const remove = process.argv.includes('--remove')

if (!email) {
  console.error('Usage: npm run make-admin -- you@example.com [--remove]')
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

  if (remove) {
    // Back to an ordinary free account. Their subjects and progress stay;
    // only what they can open changes.
    await client.query(
      `UPDATE profiles
       SET is_admin = false, plan = 'free', access_source = NULL, access_code_id = NULL, access_expires_at = NULL
       WHERE id = $1`,
      [users[0].id]
    )
    console.log(`${email} is no longer an admin and is on the free plan.`)
  } else {
    await client.query(
      `UPDATE profiles
       SET is_admin = true, plan = 'premium', access_source = 'Developer'
       WHERE id = $1`,
      [users[0].id]
    )
    console.log(`${email} now has admin access with every feature unlocked.`)
  }
  await client.end()
}

main().catch(async (err) => {
  console.error(err.message)
  await client?.end().catch(() => {})
  process.exit(1)
})
