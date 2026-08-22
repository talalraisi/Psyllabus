/**
 * One-command database setup.
 *
 * Applies every numbered migration in scripts/ in order, tracks what has
 * already run, and is safe to re-run at any time.
 *
 *   npm run setup-db
 *
 * Requires DATABASE_URL in .env.local. Get it from:
 *   Supabase dashboard -> Project Settings -> Database -> Connection string
 *   -> "URI" tab -> copy, then replace [YOUR-PASSWORD] with your DB password.
 *
 * Note 002 is skipped: it targets an older UUID schema that was never deployed
 * and is superseded by 004.
 */

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const SKIP = new Set(['002-quiz-schema.sql'])

// Load .env.local without adding a dependency.
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error(`
Missing DATABASE_URL in .env.local

  1. Open your Supabase dashboard
  2. Project Settings -> Database -> Connection string -> URI
  3. Copy it and replace [YOUR-PASSWORD] with your database password
  4. Add this line to .env.local:

     DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres

  5. Run: npm run setup-db
`)
  process.exit(1)
}

/**
 * Supabase's direct host (db.<ref>.supabase.co) is IPv6-only on most projects,
 * so it fails with ENOTFOUND on IPv4 networks. The pooler is reachable over
 * IPv4 but lives at a region-specific hostname and uses a different username.
 * Build the candidate pooler URLs so we can fall back automatically.
 */
const REGIONS = [
  'ap-south-1', 'eu-central-1', 'ap-southeast-1', 'eu-west-1', 'eu-west-2',
  'us-east-1', 'us-west-1', 'us-east-2', 'us-west-2', 'ap-southeast-2',
  'ap-northeast-1', 'ap-northeast-2', 'sa-east-1', 'ca-central-1', 'eu-north-1',
]

function poolerCandidates(originalUrl) {
  let parsed
  try {
    parsed = new URL(originalUrl)
  } catch {
    return []
  }
  const refMatch = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
  if (!refMatch) return []

  const ref = refMatch[1]
  const password = decodeURIComponent(parsed.password)
  const out = []
  for (const prefix of ['aws-0', 'aws-1']) {
    for (const region of REGIONS) {
      // Session mode (5432) supports transactions and DDL, which migrations need.
      out.push({
        label: `${prefix}-${region}`,
        url: `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${prefix}-${region}.pooler.supabase.com:5432/postgres`,
      })
    }
  }
  return out
}

async function tryConnect(connectionString) {
  const c = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await c.connect()
    return c
  } catch (err) {
    await c.end().catch(() => {})
    throw err
  }
}

let client

async function connectWithFallback() {
  console.log('Connecting to database...')
  try {
    return await tryConnect(url)
  } catch (err) {
    const networkIssue = /ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT/.test(err.message)
    const candidates = poolerCandidates(url)
    if (!networkIssue || candidates.length === 0) throw err

    console.log(`  direct host unreachable (${err.code || 'network error'})`)
    console.log('  this host is IPv6-only; trying the IPv4 pooler...')

    for (const { label, url: candidate } of candidates) {
      try {
        const c = await tryConnect(candidate)
        console.log(`  connected via ${label}\n`)
        console.log('Update .env.local so future runs connect directly:')
        console.log(
          `  DATABASE_URL=postgresql://postgres.${new URL(url).hostname.split('.')[1]}:YOUR_PASSWORD@${label}.pooler.supabase.com:5432/postgres\n`
        )
        return c
      } catch (e) {
        // Wrong region resolves but refuses auth/connection; keep looking.
        if (/password|authentication|Tenant or user not found/i.test(e.message)) continue
        continue
      }
    }
    throw new Error(
      'Could not reach the database on any pooler region.\n' +
        'Copy the "Session pooler" connection string from:\n' +
        '  Supabase -> Project Settings -> Database -> Connection string -> Session pooler\n' +
        'and put it in .env.local as DATABASE_URL.'
    )
  }
}

async function main() {
  client = await connectWithFallback()

  await client.query(`
    CREATE TABLE IF NOT EXISTS _psyllabus_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    )
  `)

  const { rows: done } = await client.query('SELECT filename FROM _psyllabus_migrations')
  const applied = new Set(done.map((r) => r.filename))

  const files = fs
    .readdirSync(path.join(process.cwd(), 'scripts'))
    .filter((f) => /^\d{3}-.*\.sql$/.test(f))
    .filter((f) => !SKIP.has(f))
    .sort()

  let ran = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip  ${file} (already applied)`)
      continue
    }

    const sql = fs.readFileSync(path.join(process.cwd(), 'scripts', file), 'utf8')
    process.stdout.write(`  run   ${file} ... `)
    try {
      await client.query(sql)
      await client.query('INSERT INTO _psyllabus_migrations (filename) VALUES ($1)', [file])
      console.log('ok')
      ran++
    } catch (err) {
      console.log('FAILED')
      console.error(`\n${file} failed:\n  ${err.message}\n`)
      console.error('Nothing after this point was applied. Fix the error and re-run.')
      await client.end()
      process.exit(1)
    }
  }

  // Report the resulting content so you know the app has data to show.
  const counts = {}
  for (const [label, sql] of [
    ['syllabus subtopics', 'SELECT count(*)::int AS n FROM syllabus_content'],
    ['questions', 'SELECT count(*)::int AS n FROM questions WHERE verified'],
    ['schools', 'SELECT count(*)::int AS n FROM schools'],
  ]) {
    try {
      const { rows } = await client.query(sql)
      counts[label] = rows[0].n
    } catch {
      counts[label] = 'n/a'
    }
  }

  console.log(`\nApplied ${ran} new migration${ran === 1 ? '' : 's'}.`)
  console.log('\nDatabase contents:')
  for (const [k, v] of Object.entries(counts)) console.log(`  ${v}  ${k}`)

  const { rows: schools } = await client
    .query('SELECT name, join_code FROM schools ORDER BY created_at')
    .catch(() => ({ rows: [] }))
  if (schools.length) {
    console.log('\nSchool join codes:')
    for (const s of schools) console.log(`  ${s.join_code}  ${s.name}`)
  }

  console.log('\nNext: make yourself staff so the School dashboard opens.')
  console.log('  npm run make-staff -- your@email.com\n')

  await client.end()
}

main().catch(async (err) => {
  console.error(`\n${err.message}\n`)
  await client?.end().catch(() => {})
  process.exit(1)
})
