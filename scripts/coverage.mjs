/**
 * How many questions sit behind each subtopic. Read-only.
 *
 *   npm run coverage                          every subject that has questions
 *   npm run coverage -- --subject "Physics HL"  one subject, every subtopic
 *   npm run coverage -- --all                 subjects with no questions too
 *   npm run coverage -- --csv                 every subtopic to coverage.csv (gitignored)
 *
 * Full is 10 or more verified questions (one full quiz without repeats), thin
 * is 1 to 9, empty is none. The thinnest list is the to-do list for
 * generate-questions.mjs.
 */
import fs from 'node:fs'
import { loadEnv, connect } from './db.mjs'

const args = process.argv.slice(2)
const has = (n) => args.includes(`--${n}`)
const arg = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : null
}
const FULL = 10
const subjectWanted = arg('subject')

loadEnv()
const client = await connect()
try {
  const { rows } = await client.query(
    `SELECT s.subject, s.topic, s.subtopic, s.code, count(q.id)::int AS questions
       FROM syllabus_content s
       LEFT JOIN questions q
         ON q.subject = s.subject AND q.subtopic = s.subtopic AND q.verified
      WHERE ($1::text IS NULL OR s.subject = $1)
      GROUP BY s.subject, s.topic, s.subtopic, s.code, s.position
      ORDER BY s.subject, s.position NULLS LAST, s.subtopic`,
    [subjectWanted]
  )
  if (!rows.length) {
    console.log(subjectWanted ? `No syllabus rows for "${subjectWanted}".` : 'No syllabus rows.')
    process.exit(0)
  }

  const bySubject = new Map()
  for (const r of rows) {
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, [])
    bySubject.get(r.subject).push(r)
  }

  const stats = [...bySubject].map(([subject, list]) => ({
    subject,
    total: list.length,
    full: list.filter((r) => r.questions >= FULL).length,
    thin: list.filter((r) => r.questions > 0 && r.questions < FULL).length,
    empty: list.filter((r) => r.questions === 0).length,
    questions: list.reduce((n, r) => n + r.questions, 0),
  }))
  const shown = has('all') || subjectWanted ? stats : stats.filter((s) => s.questions > 0)
  const hidden = stats.length - shown.length

  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-')
  console.log(`\n${'Subject'.padEnd(44)} ${'subtopics'.padStart(9)} ${'full'.padStart(6)} ${'thin'.padStart(6)} ${'empty'.padStart(6)} ${'questions'.padStart(9)}`)
  for (const s of shown.sort((a, b) => b.questions - a.questions)) {
    console.log(
      `${s.subject.slice(0, 44).padEnd(44)} ${String(s.total).padStart(9)} ${pct(s.full, s.total).padStart(6)} ${String(s.thin).padStart(6)} ${String(s.empty).padStart(6)} ${String(s.questions).padStart(9)}`
    )
  }
  if (hidden) console.log(`\n${hidden} more subject${hidden === 1 ? '' : 's'} with no questions at all (--all to list them).`)

  const t = shown.reduce((a, s) => ({ total: a.total + s.total, full: a.full + s.full, thin: a.thin + s.thin, empty: a.empty + s.empty }), { total: 0, full: 0, thin: 0, empty: 0 })
  console.log(`\nAcross these: ${t.total} subtopics, ${t.full} full (${pct(t.full, t.total)}), ${t.thin} thin, ${t.empty} empty.`)

  // The thinnest subtopics in subjects that have started: where one more
  // generation run helps most.
  const started = new Set(shown.filter((s) => s.questions > 0).map((s) => s.subject))
  const thinnest = rows
    .filter((r) => started.has(r.subject) && r.questions < FULL)
    .sort((a, b) => a.questions - b.questions)
  const limit = subjectWanted ? thinnest.length : 20
  if (thinnest.length) {
    console.log(`\nThinnest${subjectWanted ? '' : ` ${Math.min(limit, thinnest.length)} of ${thinnest.length}`} (under ${FULL} questions):`)
    for (const r of thinnest.slice(0, limit)) {
      console.log(`  ${String(r.questions).padStart(3)}  ${r.subject} · ${r.code ? r.code + ' ' : ''}${r.subtopic}`)
    }
  }

  if (has('csv')) {
    const esc = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''))
    fs.writeFileSync(
      'coverage.csv',
      'subject,topic,code,subtopic,questions,state\n' +
        rows
          .map((r) => [r.subject, r.topic, r.code, r.subtopic, r.questions, r.questions >= FULL ? 'full' : r.questions ? 'thin' : 'empty'].map(esc).join(','))
          .join('\n') +
        '\n'
    )
    console.log('\nWritten to coverage.csv')
  }
} finally {
  await client.end()
}
