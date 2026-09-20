/**
 * Progress rows pointing at subtopics that no longer exist.
 *
 * Remapping a syllabus renames and splits subtopics, and any progress filed
 * under the old name stops matching anything. The row is then invisible: it
 * is not on the heatmap, not in the plan, not in the map, and it still counts
 * in a total somewhere. `apply-outline.mjs` moves work across a rename, but
 * anything it could not match lands here.
 *
 * Empty rows — never started, no points — are deleted, because they are
 * placeholders and nobody lost anything. Rows that hold real work are
 * printed and left alone: what they should become is a judgement about a
 * syllabus, not something a script should guess at.
 *
 *   node scripts/prune-orphan-progress.mjs           # report
 *   node scripts/prune-orphan-progress.mjs --apply   # delete the empty ones
 */

import { loadEnv, connect } from './db.mjs'

const APPLY = process.argv.includes('--apply')

async function main() {
  loadEnv()
  const c = await connect({ quiet: true })

  const { rows } = await c.query(`
    select p.id, p.user_id, p.subject, p.topic, p.subtopic, p.status,
           coalesce(p.mastery_points, 0) points
      from progress p
     where not exists (
       select 1 from syllabus_content sc
        where sc.subject = p.subject and sc.subtopic = p.subtopic)
     order by p.subject, p.subtopic`)

  if (!rows.length) {
    console.log('No orphan progress. Every row points at a subtopic that exists.')
    await c.end()
    return
  }

  const empty = rows.filter((r) => r.status === 'not_started' && Number(r.points) === 0)
  const withWork = rows.filter((r) => !empty.includes(r))

  console.log(`${rows.length} orphan row(s): ${empty.length} empty, ${withWork.length} holding work\n`)

  for (const r of empty) console.log(`  empty   ${r.subject} · ${r.subtopic}`)
  for (const r of withWork) {
    console.log(`  WORK    ${r.subject} · ${r.subtopic} — ${r.status}, ${r.points} points (left alone)`)
  }

  if (withWork.length) {
    console.log(
      '\nThe rows marked WORK are somebody\'s results filed under a name the\n' +
        'syllabus no longer has. Decide what each one became and move it with\n' +
        'apply-outline.mjs rather than deleting it here.'
    )
  }

  if (empty.length && APPLY) {
    const { rowCount } = await c.query(`delete from progress where id = any($1::uuid[])`, [
      empty.map((r) => r.id),
    ])
    console.log(`\nDeleted ${rowCount} empty orphan row(s).`)
  } else if (empty.length) {
    console.log('\nDry run. Pass --apply to delete the empty ones.')
  }

  await c.end()
}

main()
