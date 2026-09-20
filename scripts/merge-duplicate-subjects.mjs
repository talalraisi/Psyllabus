/**
 * Two spellings of the same course, merged into one.
 *
 * The onboarding picker listed "Environmental Systems & Societies SL" and
 * "Environmental Systems and Societies SL" in the same group — the second
 * set was appended when the syllabus was remapped and the first was never
 * taken out. So the list showed the same course twice, and which one a
 * student happened to click decided which of two identical syllabuses their
 * work was filed under. Two of the five accounts are on opposite spellings.
 *
 * The retired rows are byte-identical to the kept ones — same topics, units
 * and subtopics — which is checked again here before anything is written,
 * because merging on the assumption of sameness is how work disappears.
 *
 * Everything attached to the retired name moves to the kept one; the
 * duplicate syllabus rows are then deleted rather than renamed, since the
 * kept subject already has every one of them.
 *
 *   node scripts/merge-duplicate-subjects.mjs           # say what it would do
 *   node scripts/merge-duplicate-subjects.mjs --apply   # do it
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'

const APPLY = process.argv.includes('--apply')

/** retired name -> the spelling that survives. */
const MERGES = [
  ['Environmental Systems & Societies SL', 'Environmental Systems and Societies SL'],
  ['Sports Exercise & Health Science HL', 'Sports, Exercise, and Health Science HL'],
  ['Sports Exercise & Health Science SL', 'Sports, Exercise, and Health Science SL'],
]

/** Everything that files a row under a subject name. */
const TABLES = [
  'ai_usage', 'calendar_events', 'core_progress', 'flashcard_presets', 'flashcards',
  'mastery_credits', 'mistakes', 'notes', 'progress', 'questions', 'quiz_attempts',
  'resources', 'todos',
]

async function main() {
  loadEnv()
  const c = await connect({ quiet: true })
  console.log(APPLY ? 'Applying.\n' : 'Dry run. Nothing is written. Pass --apply to do it.\n')

  // Written before anything is deleted. The rows are duplicates of rows we
  // keep, so nothing should be lost — but "should" is not a backup.
  if (APPLY) {
    const backup = {}
    for (const [retire] of MERGES) {
      const { rows } = await c.query(`select * from syllabus_content where subject = $1`, [retire])
      backup[retire] = rows
    }
    const file = path.join(process.cwd(), `merge-backup-${Date.now()}.json`)
    fs.writeFileSync(file, JSON.stringify(backup, null, 2))
    console.log(`Backup of every row about to be deleted: ${file}\n`)
  }

  if (APPLY) await c.query('BEGIN')
  try {
    for (const [retire, keep] of MERGES) {
      console.log(`${retire}\n  -> ${keep}`)

      // Never merge on the assumption that they are the same.
      const same = await c.query(
        `select
           (select count(*) from syllabus_content where subject = $1) a,
           (select count(*) from syllabus_content where subject = $2) b,
           (select count(*) from (
              select topic, unit, subtopic from syllabus_content where subject = $1
              except
              select topic, unit, subtopic from syllabus_content where subject = $2) d) only_in_retired`,
        [retire, keep]
      )
      const { a, b, only_in_retired } = same.rows[0]
      if (Number(a) === 0) {
        console.log('   nothing under that name any more, skipping\n')
        continue
      }
      if (Number(only_in_retired) > 0) {
        throw new Error(
          `${retire} has ${only_in_retired} subtopic(s) the kept subject does not. ` +
            'Merging would lose them. Remap the outline first.'
        )
      }
      console.log(`   syllabus ${a} rows -> ${b} rows, nothing unique to the retired name`)

      for (const t of TABLES) {
        const { rows } = await c.query(`select count(*) n from ${t} where subject = $1`, [retire])
        const n = Number(rows[0].n)
        if (!n) continue
        console.log(`   ${t}: ${n}`)
        if (APPLY) await c.query(`update ${t} set subject = $2 where subject = $1`, [retire, keep])
      }

      // The kept subject already has every one of these, so they go rather
      // than move — a rename here would collide with its twin.
      console.log(`   syllabus_content: delete ${a} duplicate rows`)
      if (APPLY) await c.query(`delete from syllabus_content where subject = $1`, [retire])

      // The chosen subjects live in a jsonb array on the profile, and the
      // free subject names one of them.
      const prof = await c.query(
        `select count(*) n from profiles where subjects @> to_jsonb($1::text)`, [retire]
      )
      if (Number(prof.rows[0].n)) {
        console.log(`   profiles.subjects: ${prof.rows[0].n}`)
        if (APPLY) {
          await c.query(
            `update profiles
                set subjects = (
                  select jsonb_agg(case when v = $1 then $2::text else v end)
                  from jsonb_array_elements_text(subjects) v)
              where subjects @> to_jsonb($1::text)`,
            [retire, keep]
          )
        }
      }
      const free = await c.query(`select count(*) n from profiles where free_subject = $1`, [retire])
      if (Number(free.rows[0].n)) {
        console.log(`   profiles.free_subject: ${free.rows[0].n}`)
        if (APPLY) {
          await c.query(`update profiles set free_subject = $2 where free_subject = $1`, [retire, keep])
        }
      }
      console.log('')
    }

    if (APPLY) {
      await c.query('COMMIT')
      console.log('Done.')
    } else {
      console.log('Dry run finished. Nothing was written.')
    }
  } catch (e) {
    if (APPLY) await c.query('ROLLBACK')
    console.error('\nRolled back:', e.message)
    process.exitCode = 1
  }
  await c.end()
}

main()
