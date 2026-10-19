/**
 * The limits on model spending, tried the way a determined student would.
 *
 * Runs as a signed-in student (role authenticated, their id in the JWT
 * claims), inside one transaction that is always rolled back, so nothing is
 * left behind and no model is called.
 *
 *   node scripts/ai-limits-test.mjs                    against the live functions
 *   node scripts/ai-limits-test.mjs --with-migration   loads 062 first (dry run)
 */

import { readFileSync } from 'node:fs'
import { loadEnv, connect } from './db.mjs'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`)
}

async function main() {
  loadEnv()
  const c = await connect({ quiet: true })
  const { rows } = await c.query(`select id from profiles order by updated_at desc limit 1`)
  if (!rows.length) {
    console.log('No profiles to test against.')
    return c.end()
  }
  const uid = rows[0].id

  await c.query('BEGIN')
  try {
    if (process.argv.includes('--with-migration')) {
      const sql = readFileSync(new URL('./062-ai-limits.sql', import.meta.url), 'utf8')
        .replace(/^\s*BEGIN;\s*$/m, '')
        .replace(/^\s*COMMIT;\s*$/m, '')
      await c.query(sql)
    }

    // A clean slate for this student today, and room to test against.
    await c.query(`delete from ai_usage where user_id = $1`, [uid])
    await c.query(`update ai_budget set daily_micro = 1000000000, enabled = true`)
    await c.query(`update ai_limits set per_day = 40, per_minute = 6 where task = 'tutor'`)

    const asStudent = async (fn, who = uid) => {
      await c.query('SAVEPOINT s')
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who, role: 'authenticated' })])
      await c.query('SET LOCAL ROLE authenticated')
      try {
        const out = await fn()
        await c.query('RESET ROLE')
        await c.query('RELEASE SAVEPOINT s')
        return { out }
      } catch (e) {
        await c.query('ROLLBACK TO SAVEPOINT s')
        await c.query('RESET ROLE')
        return { error: e.message }
      }
    }
    const claim = (task = 'tutor') =>
      asStudent(async () => (await c.query(`select claim_ai_request($1, 'Physics SL') as r`, [task])).rows[0].r)

    // Writing the ledger directly is refused.
    const direct = await asStudent(() => c.query(`insert into ai_usage (user_id, task) values ($1, 'tutor')`, [uid]))
    check('a student cannot insert usage rows directly', !!direct.error, direct.error)

    const del = await asStudent(() => c.query(`delete from ai_usage where user_id = $1 returning id`, [uid]))
    check('a student cannot delete usage rows', !!del.error || del.out.rowCount === 0)

    const lim = await asStudent(() => c.query(`select * from ai_limits`))
    check('a student cannot read or change the limits', !!lim.error)
    const bud = await asStudent(() => c.query(`update ai_budget set daily_micro = 999999999`))
    check('a student cannot raise the budget', !!bud.error)

    // Bursts.
    const first = await claim()
    check('the first question is allowed', first.out?.ok === true && first.out?.remaining === 39, JSON.stringify(first))
    for (let i = 0; i < 5; i++) await claim()
    const seventh = await claim()
    check('the seventh in a minute is told to slow down', seventh.out?.reason === 'slow_down', JSON.stringify(seventh.out))

    // The day.
    await c.query(`update ai_usage set created_at = now() - interval '2 minutes' where user_id = $1`, [uid])
    await c.query(`update ai_limits set per_day = 6 where task = 'tutor'`)
    const overDay = await claim()
    check('past the daily allowance is refused', overDay.out?.reason === 'daily_limit', JSON.stringify(overDay.out))
    const otherTask = await claim('study_advice')
    check('each kind has its own allowance', otherTask.out?.ok === true, JSON.stringify(otherTask.out))
    await c.query(`update ai_limits set per_day = 40 where task = 'tutor'`)

    // The budget across everyone.
    await c.query(`update ai_budget set daily_micro = (select coalesce(sum(coalesce(cost_micro, reserved_micro)), 0) from ai_usage where created_at >= date_trunc('day', now() at time zone 'Asia/Muscat') at time zone 'Asia/Muscat') + 2000`)
    const overBudget = await claim()
    check('a claim that would pass the day’s budget is refused', overBudget.out?.reason === 'paused', JSON.stringify(overBudget.out))
    await c.query(`update ai_budget set daily_micro = 1000000000, enabled = false`)
    const off = await claim()
    check('switching the budget off stops every claim', off.out?.reason === 'paused', JSON.stringify(off.out))
    await c.query(`update ai_budget set enabled = true`)

    // Settling.
    const id = first.out.id
    await asStudent(() => c.query(`select finish_ai_request($1, 1000, 500, 999999)`, [id]))
    let row = (await c.query(`select cost_micro, finished_at from ai_usage where id = $1`, [id])).rows[0]
    check('a cost can never be settled above what was reserved', row.cost_micro === 3000, JSON.stringify(row))
    await asStudent(() => c.query(`select finish_ai_request($1, 1, 1, 0)`, [id]))
    row = (await c.query(`select cost_micro from ai_usage where id = $1`, [id])).rows[0]
    check('a claim settles once', row.cost_micro === 3000, JSON.stringify(row))

    const { rows: others } = await c.query(`select id from profiles where id <> $1 limit 1`, [uid])
    if (others.length) {
      const theirs = await asStudent(async () => (await c.query(`select claim_ai_request('tutor') as r`)).rows[0].r, others[0].id)
      await asStudent(() => c.query(`select finish_ai_request($1, 0, 0, 0)`, [theirs.out.id]))
      row = (await c.query(`select finished_at from ai_usage where id = $1`, [theirs.out.id])).rows[0]
      check('a student cannot settle someone else’s claim', row.finished_at === null)
    }

    await c.query(`select set_config('request.jwt.claims', '', true)`)
    const anon = await c.query(`select claim_ai_request('tutor') as r`)
    check('no signed-in student, no claim', anon.rows[0].r?.reason === 'signed_out' || anon.rows[0].r?.ok === false)
  } finally {
    await c.query('ROLLBACK')
    await c.end()
  }

  console.log(failed ? `\n${failed} failing` : '\nevery limit holds')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
