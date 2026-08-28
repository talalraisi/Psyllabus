/**
 * Issue access codes for a school.
 *
 *   npm run codes -- --school "ABA Oman" --domain abaoman.org --seats 250
 *       One shared code, but useless without a school email address.
 *       Best when the school issues student emails.
 *
 *   npm run codes -- --school "ABA Oman" --single 250
 *       250 single-use codes, one per student, each dies after one account.
 *       Best when students use personal email.
 *
 *   npm run codes -- --list
 *   npm run codes -- --revoke ABA2026
 *
 * Codes avoid characters people misread when copying off a slide: no O/0,
 * no I/1/l, no 5/S.
 */

import fs from 'node:fs'
import crypto from 'node:crypto'
import { loadEnv, connect } from './db.mjs'

const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const has = (n) => args.includes(`--${n}`)

const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789'

function randomCode(prefix) {
  const body = Array.from(crypto.randomBytes(8))
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('')
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4, 8)}`
}

const slug = (s) =>
  s.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'SCHOOL'

loadEnv()
const client = await connect()

try {
  if (has('list')) {
    const { rows } = await client.query(`
      SELECT code, label, active, single_use, redemptions, max_redemptions,
             allowed_email_domains, batch, expires_at
      FROM access_codes ORDER BY created_at DESC LIMIT 40`)
    if (!rows.length) console.log('No codes yet.')
    for (const r of rows) {
      const seats = r.single_use ? 'single use' : `${r.redemptions}/${r.max_redemptions ?? '∞'}`
      const domain = r.allowed_email_domains?.length ? r.allowed_email_domains.join(', ') : 'any email'
      console.log(
        `${r.active ? ' ' : 'x'} ${r.code.padEnd(20)} ${String(seats).padEnd(12)} ${domain.padEnd(28)} ${r.label}`
      )
    }
    const { rows: batches } = await client.query(`
      SELECT batch, count(*)::int total, count(*) FILTER (WHERE redemptions > 0)::int used
      FROM access_codes WHERE batch IS NOT NULL GROUP BY batch ORDER BY batch`)
    if (batches.length) {
      console.log('\nBatches:')
      for (const b of batches) console.log(`  ${b.batch}: ${b.used}/${b.total} used`)
    }
    process.exit(0)
  }

  if (has('revoke')) {
    const code = flag('revoke')
    if (!code) {
      console.error('Which code? npm run codes -- --revoke ABA2026')
      process.exit(1)
    }
    const { rows } = await client.query(
      'UPDATE access_codes SET active = false WHERE upper(code) = upper($1) RETURNING id, label',
      [code]
    )
    if (!rows.length) {
      console.error(`No code "${code}".`)
      process.exit(1)
    }
    const { rowCount } = await client.query(
      `UPDATE profiles SET plan = 'free', access_source = NULL, access_code_id = NULL
       WHERE access_code_id = $1 AND NOT is_admin`,
      [rows[0].id]
    )
    console.log(`Revoked ${code} (${rows[0].label}).`)
    console.log(`${rowCount} account${rowCount === 1 ? '' : 's'} moved back to the free plan.`)
    process.exit(0)
  }

  const school = flag('school')
  if (!school) {
    console.error('Name the school: npm run codes -- --school "ABA Oman" --domain abaoman.org --seats 250')
    process.exit(1)
  }

  const months = parseInt(flag('months', '12'), 10)
  const singleCount = parseInt(flag('single', '0'), 10)
  const prefix = slug(school)

  if (singleCount > 0) {
    // One code per student. A leaked code costs the school exactly one seat.
    const batch = `${prefix}-${new Date().getFullYear()}`
    const codes = []
    while (codes.length < singleCount) {
      const c = randomCode(prefix)
      if (!codes.includes(c)) codes.push(c)
    }

    for (const code of codes) {
      await client.query(
        `INSERT INTO access_codes (code, label, kind, single_use, max_redemptions, grants_months, batch)
         VALUES ($1, $2, 'school', true, 1, $3, $4) ON CONFLICT (code) DO NOTHING`,
        [code, school, months, batch]
      )
    }

    const out = `codes-${batch}.csv`
    fs.writeFileSync(out, 'code\n' + codes.join('\n') + '\n')
    console.log(`Created ${codes.length} single-use codes for ${school}.`)
    console.log(`Written to ${out} - send that to the school to hand out.`)
    console.log(`Each code works once, for ${months} months. A leaked one costs a single seat.`)
  } else {
    const domain = flag('domain')
    const seats = parseInt(flag('seats', '250'), 10)
    if (!domain) {
      console.error('A shared code needs an email domain, otherwise it can be passed to anyone.')
      console.error('  npm run codes -- --school "ABA Oman" --domain abaoman.org --seats 250')
      console.error('If the school has no email domain, issue single-use codes instead:')
      console.error('  npm run codes -- --school "ABA Oman" --single 250')
      process.exit(1)
    }

    const code = flag('code', `${prefix}${new Date().getFullYear()}`)
    const domains = domain.split(',').map((d) => d.trim().replace(/^@/, '').toLowerCase())

    await client.query(
      `INSERT INTO access_codes (code, label, kind, allowed_email_domains, max_redemptions, grants_months)
       VALUES ($1, $2, 'school', $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET
         label = EXCLUDED.label, allowed_email_domains = EXCLUDED.allowed_email_domains,
         max_redemptions = EXCLUDED.max_redemptions, grants_months = EXCLUDED.grants_months,
         active = true`,
      [code, school, domains, seats, months]
    )

    console.log(`Code ${code} is ready for ${school}.`)
    console.log(`  Only works with: ${domains.map((d) => '@' + d).join(' or ')}`)
    console.log(`  Seats: ${seats}   Lasts: ${months} months`)
    console.log(`\nIf it leaks, it is useless to anyone without a school address.`)
    console.log(`To kill it anyway: npm run codes -- --revoke ${code}`)
  }
} finally {
  await client.end()
}
