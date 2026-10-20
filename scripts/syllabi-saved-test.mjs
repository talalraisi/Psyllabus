/**
 * Saved chats, markings and ideas: each student's own, and nobody else's.
 * Runs as signed-in students inside one transaction that is rolled back.
 *
 *   node scripts/syllabi-saved-test.mjs [--with-migration]
 */
import { readFileSync } from 'node:fs'
import { loadEnv, connect } from './db.mjs'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.error(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`)
}

loadEnv()
const c = await connect({ quiet: true })
await c.query('set statement_timeout = 15000')
const ids = (await c.query(`select id from profiles order by updated_at desc limit 2`)).rows.map((r) => r.id)
const [me, other] = ids

await c.query('BEGIN')
try {
  if (process.argv.includes('--with-migration')) {
    await c.query(readFileSync(new URL('./069-syllabi-saved.sql', import.meta.url), 'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm, ''))
  }
  const as = async (who, sql, params = []) => {
    await c.query('SAVEPOINT s')
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(who ? { sub: who, role: 'authenticated' } : { role: 'anon' })])
    await c.query(who ? 'SET LOCAL ROLE authenticated' : 'SET LOCAL ROLE anon')
    try {
      const r = await c.query(sql, params)
      await c.query('RESET ROLE')
      await c.query('RELEASE SAVEPOINT s')
      return { rows: r.rows, count: r.rowCount }
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT s')
      await c.query('RESET ROLE')
      return { error: e.message }
    }
  }

  const chat = await as(me, `insert into syllabi_chats (subject, title, messages) values ('Physics SL', 'Binary search', '[{"role":"user","content":"hi"}]') returning id`)
  check('a student saves a chat', !!chat.rows?.[0]?.id, chat.error)
  const chatId = chat.rows[0].id
  check('and can update it as the chat goes on', (await as(me, `update syllabi_chats set messages = '[]' where id = $1`, [chatId])).count === 1)

  const mark = await as(me, `insert into syllabi_marks (draft_id, subject, kind, title, text, review, total, out_of, grade) values (gen_random_uuid(), 'Physics SL', 'ia', 'Pendulum', 'text', '{"a":1}', 13, 24, '5') returning id`)
  check('a student saves a marking', !!mark.rows?.[0]?.id, mark.error)
  const markId = mark.rows[0].id
  const edit = await as(me, `update syllabi_marks set total = 24 where id = $1`, [markId])
  check('a past marking cannot be edited', !!edit.error || edit.count === 0, JSON.stringify(edit))

  const idea = await as(me, `insert into syllabi_ideas (mode, subject, prompt, result) values ('research', 'Physics SL', 'pendulums', '{"ideas":[]}') returning id`)
  check('a student saves ideas', !!idea.rows?.[0]?.id, idea.error)

  if (other) {
    for (const [table, id] of [['syllabi_chats', chatId], ['syllabi_marks', markId], ['syllabi_ideas', idea.rows[0].id]]) {
      const read = await as(other, `select id from ${table} where id = $1`, [id])
      check(`another student cannot read them (${table})`, (read.rows || []).length === 0)
      const del = await as(other, `delete from ${table} where id = $1`, [id])
      check(`another student cannot delete them (${table})`, !!del.error || del.count === 0)
    }
    const forge = await as(other, `insert into syllabi_chats (user_id, title) values ($1, 'forged')`, [me])
    check('nobody can save into someone else’s history', !!forge.error)
  }

  const anon = await as(null, `select id from syllabi_chats limit 1`)
  check('signed out sees nothing', !!anon.error || (anon.rows || []).length === 0)

  const big = await as(me, `insert into syllabi_chats (title, messages) values ('big', jsonb_build_array(repeat('x', 500000)))`)
  check('an oversized chat is refused', !!big.error)
  const long = await as(me, `insert into syllabi_marks (draft_id, kind, text, review) values (gen_random_uuid(), 'ia', repeat('x', 60001), '{}')`)
  check('an over-long draft is refused', !!long.error)

  const exp = await as(me, `select export_my_data() as d`)
  const d = exp.rows?.[0]?.d || {}
  check('the export includes all three', Array.isArray(d.syllabi_chats) && d.syllabi_chats.length >= 1 && Array.isArray(d.syllabi_marks) && Array.isArray(d.syllabi_ideas), exp.error || Object.keys(d).join(','))

  check('a student can delete their own', (await as(me, `delete from syllabi_marks where id = $1`, [markId])).count === 1)
} finally {
  await c.query('ROLLBACK')
  await c.end()
}
console.error(failed ? `\n${failed} failing` : '\nsaved work is private and bounded')
process.exit(failed ? 1 : 0)
