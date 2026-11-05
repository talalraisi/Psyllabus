/**
 * Apply one migration from scripts/ and record it, without touching anything else.
 *
 *   node scripts/apply-migration.mjs 101-free-subject-switch.sql
 *
 * Unlike setup-db, which runs everything, this runs the one file named. Each
 * migration is written to be safe to run twice.
 */

import fs from 'node:fs'
import path from 'node:path'
import { connect } from './db.mjs'

const file = process.argv[2]
if (!file || !/^\d{3}-[\w-]+\.sql$/.test(file)) {
  console.error('Name one migration, e.g. node scripts/apply-migration.mjs 101-free-subject-switch.sql')
  process.exit(1)
}
const sql = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), file), 'utf8')
const db = await connect({ quiet: true })
await db.query(sql)
await db.query('INSERT INTO _psyllabus_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file])
console.log(`applied ${file}`)
await db.end()
