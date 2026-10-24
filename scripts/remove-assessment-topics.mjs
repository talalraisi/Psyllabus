/**
 * Take toolkit and exam-technique sections out of every subject's map.
 *
 * Several maps carried a topic about the assessment rather than the course:
 * "Assessment technique" (Paper 1, Paper 2, the HL essay), the sciences'
 * toolkits and inquiry, the maths exploration, fieldwork and inquiry
 * projects. As subtopics they made no sense to revise from, and questions
 * written for them were questions about the exam. They go, with their
 * questions (retired) and ready-made cards (unverified).
 *
 * What stays although its name sounds like a skill: Business Management's
 * tools (SWOT, Ansoff, decision trees are examined on every paper), the maths
 * "Functions toolkit" style units (ordinary content inside a real topic), the
 * languages' grammar, vocabulary and text types, Language B's HL literature,
 * and the arts' performance skills, which are the course.
 *
 * The removed rows are saved to content-runs/removed-syllabus-rows.json, so
 * this can be undone.
 *
 *   node scripts/remove-assessment-topics.mjs           # what would go
 *   node scripts/remove-assessment-topics.mjs --apply
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'

loadEnv()
const APPLY = process.argv.includes('--apply')
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

// Whole topics.
const TOPICS = [
  'Assessment technique',
  'Assessment',
  'Assessment criteria',
  'Skills and assessment',
  'Skills and internal assessment',
  'Tools and inquiry',
  'Tools and the experimental programme',
  'Toolkit and the exploration',
  'Practical and research skills',
  'Inquiry and assessment',
  'Fieldwork and assessment',
  'Engagement project and assessment',
  'Internal assessment - Investigative study',
]
// Single units inside a topic that otherwise stays.
const UNITS = ['External assessment', 'Individual oral', 'Assessment tasks', 'Collaborative sciences project']

const db = await connect({ quiet: true })
const { rows } = await db.query(
  `select * from syllabus_content where curriculum = 'IB' and (topic = any($1) or unit = any($2)) order by subject, position`,
  [TOPICS, UNITS]
)
const by = new Map()
for (const r of rows) {
  const k = r.subject.replace(/ (SL|HL)$/, '')
  by.set(k, (by.get(k) || 0) + 1)
}
for (const [s, n] of by) console.log(`${s}: ${n} subtopic rows`)

const pairs = rows.map((r) => [r.subject, r.subtopic])
const subjects = pairs.map((p) => p[0])
const subtopics = pairs.map((p) => p[1])
const match = `(subject, subtopic) in (select * from unnest($1::text[], $2::text[]))`
const q = await db.query(`select count(*)::int n from questions where retired_at is null and ${match}`, [subjects, subtopics])
const c = await db.query(`select count(*)::int n from flashcard_presets where verified and ${match}`, [subjects, subtopics])
console.log(`\n${rows.length} subtopic rows; ${q.rows[0].n} live questions and ${c.rows[0].n} ready-made cards attached`)

if (APPLY) {
  const backup = path.join(ROOT, 'content-runs', 'removed-syllabus-rows.json')
  const earlier = fs.existsSync(backup) ? JSON.parse(fs.readFileSync(backup, 'utf8')) : []
  fs.writeFileSync(backup, JSON.stringify([...earlier, ...rows], null, 1))
  await db.query('BEGIN')
  const rq = await db.query(
    `update questions set retired_at = now(), verified = false, recheck_note = 'retired: subtopic was a toolkit or exam section, removed from the map'
     where retired_at is null and ${match}`,
    [subjects, subtopics]
  )
  const rc = await db.query(`update flashcard_presets set verified = false where verified and ${match}`, [subjects, subtopics])
  const rs = await db.query(`delete from syllabus_content where id = any($1)`, [rows.map((r) => r.id)])
  await db.query('COMMIT')
  console.log(`removed ${rs.rowCount} subtopic rows; retired ${rq.rowCount} questions; unverified ${rc.rowCount} cards; backup in ${path.relative(ROOT, backup)}`)
} else console.log('dry run; --apply to remove')
await db.end()
