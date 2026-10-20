/**
 * One person, one free subject, tried the way someone would try to get round
 * it. Makes throwaway accounts inside one transaction that is always rolled
 * back, so nothing is left behind.
 *
 *   node scripts/free-plan-test.mjs [--with-migration]
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { loadEnv, connect } from './db.mjs'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.error(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`)
}

loadEnv()
const c = await connect({ quiet: true })
await c.query('set statement_timeout = 20000')
await c.query('BEGIN')
try {
  if (process.argv.includes('--with-migration')) {
    for (const f of ['071-retire-cas.sql', '072-free-plan-guard.sql', '073-subjects-changeable.sql']) {
      await c.query(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm, ''))
    }
  }

  const make = async (email, { plan = 'free', confirmed = true } = {}) => {
    const id = randomUUID()
    await c.query(`insert into auth.users (id, email, email_confirmed_at, aud, role) values ($1, $2, $3, 'authenticated', 'authenticated')`, [id, email, confirmed ? new Date() : null])
    await c.query(`insert into profiles (id, full_name, curriculum, subjects, plan) values ($1, 'Test', 'IB', '["Physics SL","Economics HL"]', $2) on conflict (id) do update set subjects = excluded.subjects, plan = excluded.plan`, [id, plan])
    return id
  }
  const as = async (id, sql, params = [], ip = '203.0.113.7') => {
    await c.query('SAVEPOINT s')
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: id, role: 'authenticated' })])
    await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-forwarded-for': `${ip}, 10.0.0.1` })])
    await c.query('SET LOCAL ROLE authenticated')
    try {
      const r = await c.query(sql, params)
      await c.query('RESET ROLE')
      await c.query('RELEASE SAVEPOINT s')
      return r.rows[0]
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT s')
      await c.query('RESET ROLE')
      return { error: e.message }
    }
  }
  const claim = (id, subject = 'Physics SL', device = null, ip) => as(id, `select claim_free_subject($1, $2) as r`, [subject, device], ip).then((x) => x.r || x)
  const freeOf = async (id) => (await c.query(`select free_subject from profiles where id = $1`, [id])).rows[0].free_subject

  const a = await make('jane.doe@gmail.com')
  check('a first free account can claim its subject', (await claim(a)).ok === true)
  check('and it is recorded', (await freeOf(a)) === 'Physics SL')

  const direct = await as(a, `update profiles set free_subject = 'Economics HL' where id = $1 returning free_subject`, [a])
  check('changing it directly is put back', (await freeOf(a)) === 'Physics SL', JSON.stringify(direct))
  check('claiming again is refused', (await claim(a, 'Economics HL')).reason === 'already')

  const b = await make('Jane.Doe+second@gmail.com')
  check('a Gmail alias of the same inbox is refused', (await claim(b, 'Economics HL', null, '198.51.100.1')).reason === 'duplicate_email')
  const b2 = await make('janedoe@googlemail.com')
  check('dots and googlemail.com are the same inbox too', (await claim(b2, 'Economics HL', null, '198.51.100.2')).reason === 'duplicate_email')

  const d = await make('someone@mailinator.com')
  check('a throwaway address is refused', (await claim(d, 'Physics SL', null, '198.51.100.3')).reason === 'disposable')

  const u = await make('unconfirmed@school.edu', { confirmed: false })
  check('an unconfirmed email is asked to confirm', (await claim(u, 'Physics SL', null, '198.51.100.4')).reason === 'confirm_email')

  const device = 'device-' + randomUUID()
  const d1 = await make('sib1@example.com')
  const d2 = await make('sib2@example.com')
  const d3 = await make('sib3@example.com')
  check('two accounts on one device are fine (siblings)', (await claim(d1, 'Physics SL', device, '198.51.100.10')).ok && (await claim(d2, 'Physics SL', device, '198.51.100.11')).ok)
  check('a third on the same device is refused', (await claim(d3, 'Physics SL', device, '198.51.100.12')).reason === 'duplicate_device')

  const net = '192.0.2.50'
  let ok = 0
  for (let i = 0; i < 8; i++) {
    const id = await make(`net${i}@example.org`)
    if ((await claim(id, 'Physics SL', `dev-${randomUUID()}`, net)).ok) ok++
  }
  const ninth = await make('net9@example.org')
  check('eight new free accounts on one network in a day are fine', ok === 8, String(ok))
  check('a ninth that day is refused', (await claim(ninth, 'Physics SL', `dev-${randomUUID()}`, net)).reason === 'busy_network')

  const paid = await make('paid@gmail.com')
  const paidAlias = await make('p.aid@gmail.com')
  // The privilege guard rightly refuses to let anyone set a plan, so the
  // test pauses it inside this rolled-back transaction to make two paid accounts.
  await c.query(`alter table profiles disable trigger profiles_protect_privileges`)
  await c.query(`update profiles set plan = 'premium' where id in ($1, $2)`, [paid, paidAlias])
  await c.query(`alter table profiles enable trigger profiles_protect_privileges`)
  const r1 = await claim(paid)
  const r2 = await claim(paidAlias)
  const plans = (await c.query(`select plan from profiles where id in ($1, $2)`, [paid, paidAlias])).rows.map((r) => r.plan)
  check('accounts with every subject skip the checks', r1.ok && r2.ok, JSON.stringify({ r1, r2, plans }))

  // Subjects can change, but a free account keeps its free subject.
  const swap = await as(a, `update profiles set subjects = '["Physics SL","History HL"]' where id = $1 returning subjects`, [a])
  check('a student with work can still change their subjects', !swap.error && JSON.stringify(swap.subjects || '').includes('History'), JSON.stringify(swap))
  const drop = await as(a, `update profiles set subjects = '["History HL","Economics HL"]' where id = $1 returning subjects`, [a])
  check('but a free account cannot remove its free subject', !!drop.error && /free subject/.test(drop.error), JSON.stringify(drop))
  const junk = await as(a, `update profiles set subjects = $2::jsonb where id = $1`, [a, JSON.stringify(Array.from({ length: 20 }, (_, i) => `S${i}`))])
  check('and the list stays a sensible size', !!junk.error)
  const paidDrop = await as(paid, `update profiles set subjects = '["History HL"]' where id = $1 returning subjects`, [paid])
  check('an account with every subject can change freely', !paidDrop.error, JSON.stringify(paidDrop))

  const stranger = await make('stranger@example.net')
  const read = await as(stranger, `select count(*)::int as n from free_claims`)
  check('nobody can read the fingerprints', !!read.error, JSON.stringify(read))

  const casLeft = (await c.query(`select count(*)::int n from profiles where subjects::text ilike '%Creativity%'`)).rows[0].n
  check('CAS is gone from every profile', casLeft === 0, String(casLeft))
  const casSyllabus = (await c.query(`select count(*)::int n from syllabus_content where subject ilike 'Creativity%'`)).rows[0].n
  check('and from the syllabus', casSyllabus === 0, String(casSyllabus))
} finally {
  await c.query('ROLLBACK')
  await c.end()
}
console.error(failed ? `\n${failed} failing` : '\none person, one free subject')
process.exit(failed ? 1 : 0)
