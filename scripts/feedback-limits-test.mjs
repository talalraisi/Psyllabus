/**
 * The feedback button's limits, tried as a signed-in student would.
 * One transaction, always rolled back: nothing is left behind.
 *
 *   node scripts/feedback-limits-test.mjs [--with-migration]
 */
import { readFileSync } from 'node:fs'
import { loadEnv, connect } from './db.mjs'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`)
}

loadEnv()
const c = await connect({ quiet: true })
const uid = (await c.query(`select id from profiles order by updated_at desc limit 1`)).rows[0].id
await c.query('BEGIN')
try {
  if (process.argv.includes('--with-migration')) {
    await c.query(readFileSync(new URL('./066-feedback-limits.sql', import.meta.url), 'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm, ''))
  }
  await c.query(`delete from feedback where user_id = $1`, [uid])
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })])
  const send = async (message) => {
    await c.query('SAVEPOINT s')
    await c.query('SET LOCAL ROLE authenticated')
    try {
      await c.query(`insert into feedback (user_id, kind, message) values ($1, 'other', $2)`, [uid, message])
      await c.query('RESET ROLE')
      await c.query('RELEASE SAVEPOINT s')
      return null
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT s')
      await c.query('RESET ROLE')
      return e.message
    }
  }
  check('a real message goes through', (await send('The calendar page is slow on my phone.')) === null)
  check('the same message twice is refused', /already sent/.test((await send('the calendar page is slow on my phone. ')) || ''))
  check('an empty one is refused', /few words/.test((await send('  a ')) || ''))
  await send('Second one')
  await send('Third one')
  check('a fourth in ten minutes is refused', /a lot at once/.test((await send('Fourth one')) || ''))
  await c.query(`update feedback set created_at = now() - interval '1 hour' where user_id = $1`, [uid])
  for (let i = 0; i < 12; i++) {
    await c.query(`insert into feedback (user_id, kind, message, created_at) values ($1, 'other', $2, now() - interval '2 hours')`, [uid, `old ${i}`])
  }
  check('past fifteen in a day is refused', /plenty for today/.test((await send('One more')) || ''))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}
console.log(failed ? `\n${failed} failing` : '\nthe button cannot be flooded')
process.exit(failed ? 1 : 0)
