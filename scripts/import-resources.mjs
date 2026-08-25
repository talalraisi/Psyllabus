/**
 * Import curated resources from a CSV.
 *
 *   npm run resources:template            write a CSV pre-filled with subtopics
 *   npm run resources:template -- --subject "Physics SL"
 *   npm run resources:import -- resources.csv
 *   npm run resources:import -- resources.csv --check     validate, do not write
 *
 * The template lists every subtopic five times so the file only needs URLs
 * filling in. Rows with a blank url are skipped, so a half-finished file
 * imports fine and can be re-imported later without creating duplicates.
 *
 * Every url is checked for a response before it is written, because a resource
 * that 404s is worse than no resource at all.
 */

import fs from 'node:fs'
import { loadEnv, connect } from './db.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const has = (name) => args.includes(`--${name}`)

const COLUMNS = ['subject', 'topic', 'subtopic', 'kind', 'title', 'provider', 'url', 'note']
const KINDS = ['official', 'lesson', 'video', 'notes', 'practice', 'reference']

/* -------------------------------------------------------------------------- *
 * CSV, handling quoted fields and embedded commas properly.
 * -------------------------------------------------------------------------- */

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
      continue
    }
    if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

const csvCell = (value) => {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/* -------------------------------------------------------------------------- *
 * Template
 * -------------------------------------------------------------------------- */

async function writeTemplate(client) {
  const subject = flag('subject')
  const out = flag('out', 'resources-template.csv')
  const perSubtopic = parseInt(flag('per', '5'), 10)

  const { rows } = subject
    ? await client.query(
        'SELECT subject, topic, subtopic FROM syllabus_content WHERE subject = $1 ORDER BY topic, subtopic',
        [subject]
      )
    : await client.query(
        'SELECT subject, topic, subtopic FROM syllabus_content ORDER BY subject, topic, subtopic'
      )

  if (!rows.length) {
    console.error(subject ? `No subtopics found for "${subject}".` : 'No syllabus content found.')
    console.error('Run: npm run setup-db')
    process.exit(1)
  }

  // Cycle the kinds so each subtopic gets a spread rather than five videos.
  const spread = ['video', 'lesson', 'notes', 'practice', 'reference']
  const lines = [COLUMNS.join(',')]
  for (const r of rows) {
    for (let i = 0; i < perSubtopic; i++) {
      lines.push(
        [r.subject, r.topic, r.subtopic, spread[i % spread.length], '', '', '', ''].map(csvCell).join(',')
      )
    }
  }

  fs.writeFileSync(out, lines.join('\n') + '\n')
  console.log(`Wrote ${out}`)
  console.log(`  ${rows.length} subtopics x ${perSubtopic} = ${rows.length * perSubtopic} rows`)
  console.log(`\nFill in title, provider, url and note. Leave a row blank to skip it.`)
  console.log(`Then: npm run resources:import -- ${out}`)
}

/* -------------------------------------------------------------------------- *
 * Import
 * -------------------------------------------------------------------------- */

/**
 * Is this url worth showing a student?
 *
 * A plain status check is not enough. Single-page apps (Khan Academy among
 * them) answer 200 for paths that do not exist and render a "not found" screen
 * client-side, so a typo in the CSV would sail through as healthy and only
 * surface when someone clicks it mid-revision. We also read the page title and
 * watch for a redirect back to the site root, which is the other common way a
 * dead deep link disguises itself.
 *
 * This catches the ordinary mistakes. It cannot catch a page that renders its
 * error entirely in JavaScript after load, so spot-check anything important.
 */
const NOT_FOUND = /\b(404|page not found|not found|doesn't exist|does not exist|no longer available)\b/i

// Bot filters answer every path with the same challenge page, real or fake, so
// a match here means "could not check", never "dead".
const BOT_WALL = /client challenge|just a moment|checking your browser|attention required|cf-browser-verification/i

async function checkUrl(url) {
  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    })
  } catch (err) {
    return { ok: false, status: err.name === 'TimeoutError' ? 'timeout' : 'unreachable' }
  }

  // 403 and 405 mean a bot filter answered, not that the page is missing.
  if (res.status >= 400 && res.status !== 403 && res.status !== 405) {
    return { ok: false, status: res.status }
  }

  const requested = new URL(url)
  const landed = new URL(res.url)
  const askedForPath = requested.pathname.replace(/\/$/, '') !== ''
  const landedOnRoot = landed.pathname.replace(/\/$/, '') === ''
  if (askedForPath && landedOnRoot && requested.host === landed.host) {
    return { ok: false, status: 'redirected to home (dead deep link)' }
  }

  const type = res.headers.get('content-type') || ''
  if (!type.includes('html')) return { ok: true, status: res.status }

  let head = ''
  try {
    head = (await res.text()).slice(0, 6000)
  } catch {
    return { ok: true, status: res.status }
  }

  const title = head.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] || ''
  if (BOT_WALL.test(title) || BOT_WALL.test(head)) {
    return { ok: true, unchecked: true, status: 'bot filter, could not verify' }
  }
  if (NOT_FOUND.test(title)) return { ok: false, status: `soft 404 ("${title.trim().slice(0, 50)}")` }

  return { ok: true, status: res.status }
}

async function importCsv(client) {
  const file = args.find((a) => a.endsWith('.csv'))
  if (!file) {
    console.error('Give me a CSV: npm run resources:import -- resources.csv')
    process.exit(1)
  }
  if (!fs.existsSync(file)) {
    console.error(`No such file: ${file}`)
    process.exit(1)
  }

  const rows = parseCsv(fs.readFileSync(file, 'utf8'))
  const header = rows.shift().map((h) => h.trim().toLowerCase())
  const missing = COLUMNS.filter((c) => !header.includes(c) && c !== 'note' && c !== 'topic')
  if (missing.length) {
    console.error(`CSV is missing required columns: ${missing.join(', ')}`)
    console.error(`Expected header: ${COLUMNS.join(',')}`)
    process.exit(1)
  }
  const col = (r, name) => (header.includes(name) ? (r[header.indexOf(name)] ?? '').trim() : '')

  // Validate before touching the database, so a bad file changes nothing.
  const valid = []
  const problems = []
  let skipped = 0

  const known = new Set(
    (await client.query('SELECT DISTINCT subject FROM syllabus_content')).rows.map((r) => r.subject)
  )

  for (const [i, r] of rows.entries()) {
    const line = i + 2
    const rec = {
      subject: col(r, 'subject'),
      topic: col(r, 'topic') || null,
      subtopic: col(r, 'subtopic'),
      kind: (col(r, 'kind') || 'lesson').toLowerCase(),
      title: col(r, 'title'),
      provider: col(r, 'provider'),
      url: col(r, 'url'),
      note: col(r, 'note') || null,
      sort_order: i,
    }

    if (!rec.url) {
      skipped++
      continue
    }
    if (!rec.subject || !rec.subtopic) {
      problems.push(`line ${line}: subject and subtopic are required`)
      continue
    }
    if (!known.has(rec.subject)) {
      problems.push(`line ${line}: subject "${rec.subject}" is not in syllabus_content`)
      continue
    }
    if (!KINDS.includes(rec.kind)) {
      problems.push(`line ${line}: kind "${rec.kind}" must be one of ${KINDS.join(', ')}`)
      continue
    }
    if (!rec.title || !rec.provider) {
      problems.push(`line ${line}: title and provider are required when a url is given`)
      continue
    }
    if (!/^https?:\/\//i.test(rec.url)) {
      problems.push(`line ${line}: url must start with http:// or https://`)
      continue
    }
    valid.push({ rec, line })
  }

  console.log(`Parsed ${rows.length} rows: ${valid.length} to import, ${skipped} blank, ${problems.length} rejected`)
  if (problems.length) {
    console.log('\nProblems:')
    for (const p of problems.slice(0, 25)) console.log(`  ${p}`)
    if (problems.length > 25) console.log(`  ... and ${problems.length - 25} more`)
  }
  if (!valid.length) {
    console.log('\nNothing to import.')
    return
  }

  // A resource that 404s is worse than no resource, so every url is checked.
  console.log(`\nChecking ${valid.length} links...`)
  const live = []
  const dead = []
  const unchecked = []
  const BATCH = 10
  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH)
    const results = await Promise.all(slice.map(({ rec }) => checkUrl(rec.url)))
    results.forEach((res, j) => {
      if (res.ok) {
        live.push(slice[j].rec)
        if (res.unchecked) unchecked.push(`line ${slice[j].line}: ${slice[j].rec.url}`)
      } else {
        dead.push(`line ${slice[j].line}: ${res.status} ${slice[j].rec.url}`)
      }
    })
    process.stdout.write(`\r  ${Math.min(i + BATCH, valid.length)}/${valid.length}`)
  }
  console.log(`\n  ${live.length - unchecked.length} verified, ${unchecked.length} unverifiable, ${dead.length} dead`)
  if (unchecked.length) {
    console.log(`\nBehind a bot filter, so these import but were NOT confirmed. Open a few yourself:`)
    for (const u of unchecked.slice(0, 15)) console.log(`  ${u}`)
    if (unchecked.length > 15) console.log(`  ... and ${unchecked.length - 15} more`)
  }
  if (dead.length) {
    console.log('\nDead links (not imported):')
    for (const d of dead.slice(0, 25)) console.log(`  ${d}`)
    if (dead.length > 25) console.log(`  ... and ${dead.length - 25} more`)
  }

  if (has('check')) {
    console.log('\n--check given, nothing written.')
    return
  }
  if (!live.length) return

  let written = 0
  for (const rec of live) {
    await client.query(
      `INSERT INTO resources (subject, topic, subtopic, kind, title, provider, url, note, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (subject, subtopic, url) DO UPDATE SET
         topic = EXCLUDED.topic, kind = EXCLUDED.kind, title = EXCLUDED.title,
         provider = EXCLUDED.provider, note = EXCLUDED.note, sort_order = EXCLUDED.sort_order`,
      [rec.subject, rec.topic, rec.subtopic, rec.kind, rec.title, rec.provider, rec.url, rec.note, rec.sort_order]
    )
    written++
  }

  const { rows: totals } = await client.query(
    'SELECT count(*)::int total, count(DISTINCT subject || subtopic)::int subtopics FROM resources'
  )
  console.log(`\nImported ${written} resources.`)
  console.log(`Database now holds ${totals[0].total} resources across ${totals[0].subtopics} subtopics.`)
}

/* -------------------------------------------------------------------------- */

loadEnv()
const client = await connect()
try {
  if (has('template')) await writeTemplate(client)
  else await importCsv(client)
} finally {
  await client.end()
}
