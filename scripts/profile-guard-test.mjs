/**
 * What a student may and may not write to their own profile row.
 *
 * The guard reverts rather than raising: a client that asks for premium gets
 * a successful UPDATE and the old value back. That is the right behaviour —
 * there is nothing to tell an attacker — but it means the assertion has to be
 * the stored value, not a thrown error. Checking for an exception here passes
 * for the wrong reason and would keep passing if the trigger were dropped.
 *
 * Runs inside a transaction and rolls back, so it leaves nothing behind.
 *
 *   node scripts/profile-guard-test.mjs
 */

import { loadEnv, connect } from './db.mjs'

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

async function main() {
  loadEnv()
  const c = await connect({ quiet: true })

  const { rows } = await c.query(
    `select id, plan, is_admin, avatar_url, subjects from profiles order by updated_at desc limit 1`
  )
  if (!rows.length) {
    console.log('No profiles to test against.')
    await c.end()
    return
  }
  const before = rows[0]

  await c.query('BEGIN')
  try {
    // Exactly what the browser looks like to the database.
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: before.id, role: 'authenticated' }),
    ])

    const av = await c.query(
      `update profiles set avatar_url = $2 where id = $1 returning avatar_url`,
      [before.id, 'https://example.test/probe.jpg']
    )
    check('a student can set their own avatar_url', !!av.rows[0]?.avatar_url?.includes('probe'))

    const name = await c.query(
      `update profiles set full_name = $2 where id = $1 returning full_name`,
      [before.id, 'Probe Name']
    )
    check('a student can set their own name', name.rows[0]?.full_name === 'Probe Name')

    const priv = await c.query(
      `update profiles
          set plan = 'premium', is_admin = true, access_source = 'self granted'
        where id = $1
      returning plan, is_admin, access_source`,
      [before.id]
    )
    check(`plan is still ${before.plan}`, priv.rows[0].plan === before.plan)
    check('is_admin is still false', priv.rows[0].is_admin === false)
    check('access_source was not self-granted', priv.rows[0].access_source !== 'self granted')

    /**
     * Subjects are write-once, and they refuse out loud.
     *
     * Note the difference: the privilege guard reverts silently, because a
     * client asking for premium is either confused or hostile and neither
     * deserves a reply. Rewriting your subject list is something an honest
     * client might attempt, and the answer is a sentence a person can read,
     * so it raises instead. Both are deliberate; the test has to know which
     * is which or it passes for the wrong reason.
     */
    if (before.subjects) {
      let raised = null
      try {
        await c.query(`update profiles set subjects = $2::jsonb where id = $1`, [
          before.id,
          JSON.stringify(['Something Else HL']),
        ])
      } catch (e) {
        raised = e.message
      }
      check('subjects cannot be rewritten once set', !!raised)
      check(
        'and the refusal explains itself rather than just failing',
        !!raised && /filed under the subjects you picked/.test(raised)
      )
    }
  } finally {
    // A RAISE aborts the transaction, so this is the only statement the
    // connection will still accept.
    await c.query('ROLLBACK').catch(() => {})
  }

  console.log(failed ? `\n${failed} failing` : '\nthe profile lets a student change what is theirs, and nothing else')
  await c.end()
  process.exitCode = failed ? 1 : 0
}

main()
