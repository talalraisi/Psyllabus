/**
 * Retire calculation questions from subjects that are not quantitative.
 *
 * The first full build told every humanities and language writer that a
 * typed answer could be "a calculation from given data", so History,
 * Psychology, Digital Society, the Language A courses and the arts got
 * arithmetic dressed up in the subject (the years between two dates, the
 * share of a poem's lines in its sestet). Gemini's audit rejected them.
 * Economics, Business Management and Geography keep theirs: calculation is
 * on their papers. Language B and ab initio keep theirs: reading a number
 * out of a text in the target language is comprehension.
 *
 * Retiring is reversible: retired_at and recheck_note mark every row.
 *
 *   node scripts/retire-calculations.mjs           # count
 *   node scripts/retire-calculations.mjs --apply
 */

import { loadEnv, connect } from './db.mjs'

loadEnv()
const APPLY = process.argv.includes('--apply')
const SUBJECTS = '^(History|Psychology|Digital Society|Visual Arts|Music|Film|Theatre|Dance) |^[A-Za-z]+ A: '
const NOTE = 'retired: calculation in a non-quantitative subject'

const db = await connect({ quiet: true })
const where = `generator is not null and retired_at is null and answer_kind = 'numeric' and subject ~ $1`
const { rows } = await db.query(`select regexp_replace(subject, ' (SL|HL)$', '') s, count(*)::int n from questions where ${where} group by 1 order by 1`, [SUBJECTS])
for (const r of rows) console.log(`${r.s}: ${r.n}`)
if (APPLY) {
  const res = await db.query(`update questions set retired_at = now(), verified = false, recheck_note = $2 where ${where}`, [SUBJECTS, NOTE])
  console.log(`retired ${res.rowCount}`)
} else console.log('count only; --apply to retire')
await db.end()
