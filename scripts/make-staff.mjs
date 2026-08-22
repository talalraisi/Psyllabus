/**
 * Grant a user staff access to a school, so the School dashboard opens.
 *
 *   npm run make-staff -- you@example.com
 *   npm run make-staff -- you@example.com ABA2026
 *
 * Requires DATABASE_URL in .env.local (same as setup-database.mjs).
 */

import { connect } from './db.mjs'


const email = process.argv[2]
const joinCode = process.argv[3] || 'ABA2026'

if (!email) {
  console.error('Usage: npm run make-staff -- you@example.com [JOINCODE]')
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

  const { rows: schools } = await client.query('SELECT id, name FROM schools WHERE join_code = $1', [
    joinCode,
  ])
  if (!schools.length) {
    console.error(`No school with join code ${joinCode}. Run npm run setup-db first.`)
    process.exit(1)
  }

  await client.query(
    `UPDATE profiles SET role = 'teacher', school_id = $1 WHERE id = $2`,
    [schools[0].id, users[0].id]
  )

  console.log(`${email} is now staff at ${schools[0].name}.`)
  console.log('Reload the app and the School item appears in the sidebar.')
  await client.end()
}

main().catch(async (err) => {
  console.error(err.message)
  await client?.end().catch(() => {})
  process.exit(1)
})
