/**
 * Import a syllabus CSV for any curriculum.
 *
 *   npm run import-syllabus -- --curriculum AP --csv "~/Downloads/PSyllabus  - AP.csv"
 *   npm run import-syllabus -- --curriculum A-Level --csv "path.csv" --dry-run
 *
 * The sheets are wide: one column per subject, with topic rows and subtopic
 * rows interleaved down each column. Row 3 holds the subject names, row 2 holds
 * group headings that are ignored, and everything from row 4 down is content.
 *
 * Subtopic rows are written three ways across the three sheets, so all of them
 * are accepted:
 *
 *   subtopic 1.1 - Pitch and pitch notation      (IB, AP)
 *   1.1 Lexis and Semantics                      (A-Level)
 *   1.1 - Understanding the nature of business   (A-Level, some columns)
 *
 * Re-running is safe: rows conflict on the existing unique index and are
 * skipped, so a corrected sheet can be imported over the top.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'

const args = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const has = (n) => args.includes(`--${n}`)

const CURRICULUM = arg('curriculum')
const CSV = arg('csv')
const DRY = has('dry-run')

if (!CURRICULUM || !CSV) {
  console.error('Usage: npm run import-syllabus -- --curriculum AP --csv path/to.csv [--dry-run]')
  process.exit(1)
}

const csvPath = CSV.startsWith('~') ? path.join(os.homedir(), CSV.slice(1)) : CSV
if (!fs.existsSync(csvPath)) {
  console.error(`No such file: ${csvPath}`)
  process.exit(1)
}

/* -------------------------------------------------------------------------- */

function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

/** Topic row, subtopic row, or neither. */
function classify(cell) {
  const t = (cell || '').trim()
  if (!t) return null
  if (/^topic\s+\d+/i.test(t)) return { type: 'topic', title: t }
  if (/^subtopic\s+\d+\.\d+/i.test(t)) return { type: 'subtopic', title: t }
  if (/^\d+\.\d+/.test(t)) return { type: 'subtopic', title: t }
  return null
}

function cleanTopic(title) {
  return title.replace(/\s+/g, ' ').trim()
}

function cleanSubtopic(title) {
  return title
    .replace(/^subtopic\s+\d+\.\d+\s*[-–—]?\s*/i, '')
    .replace(/^\d+\.\d+\s*[-–—]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** HL and AS/A2 markers, so the same column can carry both tiers. */
function isHigherOnly(text) {
  return /\bHL only\b|\bA2 only\b|\(HL\)/i.test(text)
}

/* -------------------------------------------------------------------------- */

loadEnv()
const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'))
const header = rows[2] || []

const collected = []
const perSubject = {}

/**
 * Courses the sheet summarises rather than lists, because their real syllabus
 * is shared and seeded separately. Reading the summary rows would put a second,
 * shorter set of topics alongside the real ones.
 */
const SEEDED_ELSEWHERE = [/^AP .+ Language and Culture$/]

for (let col = 0; col < header.length; col++) {
  const subject = (header[col] || '').trim()
  if (!subject) continue
  if (SEEDED_ELSEWHERE.some((re) => re.test(subject))) {
    console.log(`  skipping ${subject} (seeded from its shared framework)`)
    continue
  }

  let currentTopic = null
  const items = []

  for (let r = 3; r < rows.length; r++) {
    const parsed = classify(rows[r]?.[col])
    if (!parsed) continue
    if (parsed.type === 'topic') {
      currentTopic = cleanTopic(parsed.title)
    } else if (currentTopic) {
      const subtopic = cleanSubtopic(parsed.title)
      if (!subtopic) continue
      items.push({
        subject,
        topic: currentTopic,
        subtopic,
        hl_only: isHigherOnly(parsed.title) || isHigherOnly(currentTopic),
      })
    }
  }

  if (items.length) {
    perSubject[subject] = items.length
    collected.push(...items)
  }
}

const names = Object.keys(perSubject).sort()
console.log(`${CURRICULUM}: ${collected.length} subtopics across ${names.length} subjects\n`)
for (const n of names) console.log(`  ${String(perSubject[n]).padStart(4)}  ${n}`)

const thin = names.filter((n) => perSubject[n] < 5)
if (thin.length) {
  console.log(`\n${thin.length} subject${thin.length === 1 ? '' : 's'} came out with fewer than 5 subtopics.`)
  console.log('That usually means the sheet formats those columns differently, not that the course is small:')
  for (const n of thin) console.log(`  ${n} (${perSubject[n]})`)
}

if (DRY) {
  console.log('\n--dry-run, nothing written.')
  process.exit(0)
}

const db = await connect()
try {
  // Batched. One statement per row meant ~1,600 round trips through the
  // pooler, which took long enough that the connection was dropped mid-import.
  const BATCH = 250
  let inserted = 0

  for (let i = 0; i < collected.length; i += BATCH) {
    const slice = collected.slice(i, i + BATCH)
    const values = []
    const params = []
    slice.forEach((row, n) => {
      const b = n * 5
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`)
      params.push(CURRICULUM, row.subject, row.topic, row.subtopic, row.hl_only)
    })
    const res = await db.query(
      `INSERT INTO syllabus_content (curriculum, subject, topic, subtopic, hl_only)
       VALUES ${values.join(',')} ON CONFLICT DO NOTHING`,
      params
    )
    inserted += res.rowCount
    process.stdout.write(`\r  ${Math.min(i + BATCH, collected.length)}/${collected.length}`)
  }

  const skipped = collected.length - inserted
  console.log(`\nInserted ${inserted}${skipped ? `, ${skipped} already present` : ''}.`)

  const { rows: totals } = await db.query(
    'SELECT curriculum, count(*)::int n, count(DISTINCT subject)::int s FROM syllabus_content GROUP BY 1 ORDER BY 1'
  )
  console.log('\nSyllabus now holds:')
  for (const t of totals) console.log(`  ${t.curriculum}: ${t.n} subtopics, ${t.s} subjects`)
} finally {
  await db.end()
}
