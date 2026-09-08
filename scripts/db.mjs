/**
 * Shared database connection for the CLI scripts.
 *
 * One credential (DATABASE_URL in .env.local) drives every script. Supabase's
 * direct host is IPv6-only on most projects, so if that fails we derive the
 * IPv4 pooler URL from the project ref and probe regions until one connects.
 */

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

export function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

const REGIONS = [
  'ap-southeast-1', 'ap-south-1', 'eu-central-1', 'eu-west-1', 'eu-west-2',
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
  const ref = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1]
  if (!ref) return []

  const password = encodeURIComponent(decodeURIComponent(parsed.password))
  const out = []
  for (const prefix of ['aws-1', 'aws-0']) {
    for (const region of REGIONS) {
      out.push({
        label: `${prefix}-${region}`,
        url: `postgresql://postgres.${ref}:${password}@${prefix}-${region}.pooler.supabase.com:5432/postgres`,
      })
    }
  }
  return out
}

async function attempt(connectionString) {
  const c = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    // Generation leaves the connection idle for minutes at a time while the
    // model works. Supabase's pooler drops an idle connection, and without
    // keepalives the client only finds out when it next tries to query.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  })
  try {
    await c.connect()
    return c
  } catch (err) {
    await c.end().catch(() => {})
    throw err
  }
}

/**
 * A connection that survives being dropped.
 *
 * pg's Client emits 'error' when the far end goes away. Nothing was listening,
 * and an unhandled 'error' event takes the whole process down: a night's run
 * ended at 00:23 with "Connection terminated unexpectedly" and a stack trace,
 * having generated thirty-seven questions.
 *
 * So the error is caught rather than thrown, the dead client is marked, and
 * the next query reconnects before running. Retried once, because the failure
 * is almost always the connection rather than the query, and a second failure
 * means something real is wrong.
 */
function makeResilient(client, connectionString) {
  let live = client
  let dead = false

  const watch = (c) => {
    c.on('error', (err) => {
      dead = true
      console.log(`\n  database connection lost (${err.message}); will reconnect on the next query`)
    })
    return c
  }
  watch(live)

  return {
    async query(text, params) {
      for (let attemptNo = 0; attemptNo < 2; attemptNo++) {
        if (dead) {
          await live.end().catch(() => {})
          live = watch(await attempt(connectionString))
          dead = false
        }
        try {
          return await live.query(text, params)
        } catch (err) {
          const droppedConnection =
            /Connection terminated|ECONNRESET|EPIPE|Client has encountered|not queryable/i.test(
              err.message
            )
          if (!droppedConnection || attemptNo === 1) throw err
          dead = true
        }
      }
    },
    end: () => live.end(),
  }
}

export const MISSING_URL_HELP = `
Missing DATABASE_URL in .env.local

  1. Supabase dashboard -> Project Settings -> Database
  2. Connection string -> URI tab -> copy
  3. Replace [YOUR-PASSWORD] with your database password
  4. Add to .env.local:

     DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-1-region.pooler.supabase.com:5432/postgres
`

/** Connect, falling back to the IPv4 pooler when the direct host is unreachable. */
export async function connect({ quiet = false } = {}) {
  loadEnv()
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(MISSING_URL_HELP)
    process.exit(1)
  }

  try {
    return makeResilient(await attempt(url), url)
  } catch (err) {
    const networkIssue = /ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ETIMEDOUT/.test(err.message)
    const candidates = poolerCandidates(url)
    if (!networkIssue || candidates.length === 0) throw err

    if (!quiet) {
      console.log(`  direct host unreachable (${err.code || 'network error'})`)
      console.log('  that host is IPv6-only; trying the IPv4 pooler...')
    }

    for (const { label, url: candidate } of candidates) {
      try {
        const c = await attempt(candidate)
        if (!quiet) {
          console.log(`  connected via ${label}`)
          console.log(`  tip: put this host in .env.local to skip the probe next time\n`)
        }
        return makeResilient(c, candidate)
      } catch {
        continue
      }
    }

    throw new Error(
      'Could not reach the database on any pooler region.\n' +
        'Copy the "Session pooler" string from Supabase -> Project Settings ->\n' +
        'Database -> Connection string, and set it as DATABASE_URL in .env.local.'
    )
  }
}
