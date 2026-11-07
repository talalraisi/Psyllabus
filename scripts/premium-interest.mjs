/**
 * Who pressed "Tell me when Premium opens" (104-premium-interest.sql).
 *
 *   npm run premium-interest              the list: email, plan, when
 *   npm run premium-interest -- --csv     the same, written to premium-interest.csv (gitignored)
 *   npm run premium-interest -- --told    after you have emailed them all: marks everyone as told
 *
 * Emails are your students' own, for telling them Premium is open and
 * nothing else.
 */
import fs from 'node:fs'
import { loadEnv, connect } from './db.mjs'

const has = (n) => process.argv.includes(`--${n}`)
loadEnv()
const client = await connect()
try {
  if (has('told')) {
    const { rowCount } = await client.query('UPDATE premium_interest SET told_at = now() WHERE told_at IS NULL')
    console.log(`Marked ${rowCount} as told.`)
    process.exit(0)
  }
  const { rows } = await client.query(`
    SELECT u.email, i.plan, i.cycle, i.created_at, i.told_at
      FROM premium_interest i JOIN auth.users u ON u.id = i.user_id
     ORDER BY i.created_at`)
  const waiting = rows.filter((r) => !r.told_at)
  console.log(`${rows.length} want a paid plan (${waiting.length} not told yet).`)
  const by = rows.reduce((a, r) => ((a[r.plan] = (a[r.plan] || 0) + 1), a), {})
  for (const [plan, n] of Object.entries(by)) console.log(`  ${plan}: ${n}`)
  if (has('csv')) {
    fs.writeFileSync('premium-interest.csv', 'email,plan,cycle,asked,told\n' + rows.map((r) => [r.email, r.plan, r.cycle || '', r.created_at.toISOString().slice(0, 10), r.told_at ? 'yes' : ''].join(',')).join('\n') + '\n')
    console.log('Written to premium-interest.csv')
  } else {
    for (const r of rows) console.log(`  ${r.told_at ? '✓' : ' '} ${r.email.padEnd(36)} ${r.plan}${r.cycle ? ' · ' + r.cycle : ''}  ${r.created_at.toISOString().slice(0, 10)}`)
  }
} finally {
  await client.end()
}
