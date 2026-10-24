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
 * Multiple choice that asks for the same arithmetic goes too.
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
// Typed numeric answers, and multiple choice that asks for the same
// arithmetic ("how many years passed between…", "by what percentage did…").
const ARITHMETIC = String.raw`(works? out the (gap|difference)|how many (years|months|days|decades|centuries)|number of years|years (passed|elapsed|between)|calculate|percentage (increase|decrease|fall|rise)|what percentage|by what percentage|average (number|of))`
const where = `generator is not null and retired_at is null and subject ~ $1 and (answer_kind = 'numeric' or stem ~* '${ARITHMETIC}')`
const { rows } = await db.query(`select regexp_replace(subject, ' (SL|HL)$', '') s, count(*)::int n from questions where ${where} group by 1 order by 1`, [SUBJECTS])
for (const r of rows) console.log(`${r.s}: ${r.n}`)
if (APPLY) {
  const res = await db.query(`update questions set retired_at = now(), verified = false, recheck_note = $2 where ${where}`, [SUBJECTS, NOTE])
  console.log(`retired ${res.rowCount}`)
} else console.log('count only; --apply to retire')
await db.end()
