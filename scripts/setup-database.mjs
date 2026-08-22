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
import { connect } from './db.mjs'

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


let client

async function main() {
  client = await connect()

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
