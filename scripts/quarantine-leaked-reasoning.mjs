/**
 * Questions whose explanation is the model thinking out loud.
 *
 * Found by sitting one. Question one of a five-question Economics quiz asked
 * for the output at which ATC is minimised for TC = 100 + 5Q + Q², which is
 * 10. Answering 10 was marked wrong, because accepted_answers said 5 — and
 * the explanation shown to the student was the model's scratchpad working
 * that out:
 *
 *   "...Q = 10. Wait, I think I messed up. Let's do it again... But the
 *   accepted_answers is [5, 5.0]. That's not right. I need to fix this.
 *   Let's change the TC to 25 + 5Q + Q²... So let's adjust the stem."
 *
 * It never adjusted the stem. So the question is internally inconsistent, a
 * correct answer is marked wrong, and the student reads the machine admitting
 * it. Each of those on its own is worse than having no question there.
 *
 * These are unverified rather than deleted: `subtopic_coverage` and every
 * quiz query filter on verified, so unverifying takes them out of
 * circulation immediately while leaving them to be regenerated or repaired.
 *
 *   node scripts/quarantine-leaked-reasoning.mjs           # report
 *   node scripts/quarantine-leaked-reasoning.mjs --apply   # unverify them
 */

import { loadEnv, connect } from './db.mjs'

const APPLY = process.argv.includes('--apply')

/**
 * Phrases that only appear when a model is talking to itself.
 *
 * Deliberately narrow. "However" and "note that" are ordinary teaching
 * words; "wait," and "I need to fix this" are not things a written
 * explanation ever says to a student.
 */
const TELLS = [
  "wait,", "wait\\.", "i messed up", "that's not right", "let's try",
  "let's change", "let me fix", "i need to fix", "accepted_answers",
  "adjust the stem", "let's do it again", "hmm,", "actually, let", "so let's",
  "i'll change",
]
const PATTERN = `(${TELLS.join('|')})`

async function main() {
  loadEnv()
  const c = await connect({ quiet: true })

  const { rows } = await c.query(
    `select id, subject, subtopic, question_type, verified,
            left(regexp_replace(explanation, '\\s+', ' ', 'g'), 110) preview
       from questions
      where explanation ~* $1 or option_feedback::text ~* $1 or hint ~* $1
      order by subject, subtopic`,
    [PATTERN]
  )

  if (!rows.length) {
    console.log('No question leaks its own reasoning.')
    await c.end()
    return
  }

  const live = rows.filter((r) => r.verified)
  console.log(`${rows.length} question(s) leak reasoning; ${live.length} are still being served.\n`)
  for (const r of rows) {
    console.log(`  ${r.verified ? 'LIVE ' : 'held '} ${r.subject} · ${r.subtopic}`)
    console.log(`         ${r.preview}…`)
  }

  if (!live.length) {
    console.log('\nNothing live. Nothing to do.')
  } else if (APPLY) {
    const { rowCount } = await c.query(
      `update questions set verified = false, recheck_note = $2, rechecked_at = now()
        where id = any($1::uuid[])`,
      [live.map((r) => r.id), 'Explanation leaked the model reasoning; withdrawn pending regeneration.']
    )
    console.log(`\nWithdrew ${rowCount}. They are out of quizzes and out of coverage counts.`)
  } else {
    console.log('\nDry run. Pass --apply to withdraw the live ones.')
  }

  await c.end()
}

main()
