/**
 * Does every subject a student can pick actually have a syllabus?
 *
 *   npm run check-subjects
 *
 * Onboarding holds its subject lists in code and the syllabus lives in the
 * database, so the two drift silently. When A-Level and AP were imported, 29
 * subjects could be chosen at signup that led to an empty course, and nothing
 * anywhere said so: the student just saw a subject with no topics in it.
 *
 * Exits non-zero when they disagree, so it can gate a deploy.
 */

import fs from 'node:fs'
import { loadEnv, connect } from './db.mjs'

const PATH = new URL('../app/onboarding/page.js', import.meta.url).pathname

/** Pull the subject arrays out of the CURRICULUMS object, per curriculum. */
function offeredSubjects(src) {
  const out = { IB: [], AP: [], 'A-Level': [] }
  const lines = src.split('\n')
  let current = null
  let inSubjects = false

  for (const line of lines) {
    const header = line.match(/^ {2}'?(IB|AP|A-Level)'?:\s*\{/)
    if (header) { current = header[1]; continue }
    if (line.startsWith('const ') && !line.includes('CURRICULUMS')) current = null
    if (!current) continue

    if (/subjects:\s*\[/.test(line)) inSubjects = true
    if (inSubjects) {
      for (const m of line.matchAll(/'([^']+)'/g)) out[current].push(m[1])
      if (/\]/.test(line)) inSubjects = false
    }
  }
  return out
}

loadEnv()
const src = fs.readFileSync(PATH, 'utf8')
const offered = offeredSubjects(src)
const db = await connect()

let problems = 0
try {
  for (const cur of ['IB', 'AP', 'A-Level']) {
    const { rows } = await db.query(
      'SELECT DISTINCT subject FROM syllabus_content WHERE curriculum = $1',
      [cur]
    )
    const have = new Set(rows.map((r) => r.subject))
    const list = [...new Set(offered[cur])]

    // Compared directly for every curriculum. SUBJECT_MAP looks like it should
    // be involved, but syllabus_content actually stores the onboarding names,
    // so the map points at names that are not in the table.
    const missing = list.filter((s) => !have.has(s))
    const unused = [...have].filter((s) => !list.includes(s))

    console.log(`${cur}: ${list.length} offered, ${have.size} in the syllabus`)
    if (missing.length) {
      problems += missing.length
      console.log(`  ${missing.length} can be chosen but have NO syllabus:`)
      missing.forEach((s) => console.log(`    ${s}`))
    }
    if (unused.length) {
      console.log(`  ${unused.length} in the syllabus but not offered at signup:`)
      unused.slice(0, 6).forEach((s) => console.log(`    ${s}`))
      if (unused.length > 6) console.log(`    ... and ${unused.length - 6} more`)
    }
  }
} finally {
  await db.end()
}

if (problems > 0) {
  console.log(`\n${problems} subject${problems === 1 ? '' : 's'} would open an empty course.`)
  process.exit(1)
}
console.log('\nEvery subject a student can pick has a syllabus behind it.')
