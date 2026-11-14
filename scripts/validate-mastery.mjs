/**
 * Do the mastery levels mean anything? Read-only.
 *
 *   npm run validate-mastery
 *   npm run validate-mastery -- --subject "Physics HL"
 *
 * Replays every student's answers in the order they were given, with the
 * same rules the app uses (lib/progress.js). Each time a student meets a
 * question they have never answered before, it notes the level they held in
 * that subtopic just before, then whether they got the question right.
 *
 * If the levels are honest, a Mastered student should get about 80% of new
 * questions right, each level should beat the one below it, and high
 * confidence should sit closer to that than low. The same table is printed
 * for the old rule (points only) so the two can be compared.
 *
 * Not modelled: decay (Fading), and the bank as it was at the time (the
 * Mastered line uses today's bank). The predicted grade cannot be checked
 * until there are real exam results to compare it with.
 */
import { loadEnv, connect } from './db.mjs'
import {
  statusFromPoints,
  masteryTarget,
  pointsForQuestion,
  evidenceConfidence,
  STATUS_LABELS,
  RECENT_WINDOW,
} from '../lib/progress.js'

const args = process.argv.slice(2)
const arg = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : null
}
const subjectWanted = arg('subject')
const MIN_SAMPLE = 30

loadEnv()
const client = await connect()
let responses, bankRows
try {
  ;({ rows: responses } = await client.query(
    `SELECT a.user_id, a.quiz_type, q.id AS question_id, q.subject, q.subtopic, q.difficulty, r.is_correct
       FROM question_responses r
       JOIN quiz_attempts a ON a.id = r.attempt_id
       JOIN questions q ON q.id = r.question_id
      WHERE ($1::text IS NULL OR q.subject = $1)
      ORDER BY r.created_at, r.id`,
    [subjectWanted]
  ))
  ;({ rows: bankRows } = await client.query(
    `SELECT subject, subtopic, difficulty FROM questions WHERE verified AND ($1::text IS NULL OR subject = $1)`,
    [subjectWanted]
  ))
} finally {
  await client.end()
}

const key = (s, t) => `${s}::${t}`
const available = new Map()
const bankSize = new Map()
for (const q of bankRows) {
  const k = key(q.subject, q.subtopic)
  available.set(k, (available.get(k) || 0) + pointsForQuestion(q.difficulty == null ? 0.5 : Number(q.difficulty)))
  bankSize.set(k, (bankSize.get(k) || 0) + 1)
}

// user::subject::subtopic → running state
const state = new Map()
const tallyNew = new Map() // level → { n, right }
const tallyOld = new Map()
const tallyConf = new Map()
const add = (map, label, right) => {
  const t = map.get(label) || { n: 0, right: 0 }
  t.n++
  if (right) t.right++
  map.set(label, t)
}
const users = new Set()

for (const r of responses) {
  users.add(r.user_id)
  const sk = key(r.subject, r.subtopic)
  const k = `${r.user_id}::${sk}`
  let s = state.get(k)
  if (!s) state.set(k, (s = { seen: new Set(), credited: new Set(), points: 0, answered: 0, recent: [] }))

  if (!s.seen.has(r.question_id)) {
    const target = masteryTarget(available.get(sk))
    const recentCorrect = s.recent.filter(Boolean).length
    const evidence = { answered: s.answered, recentCorrect, recentTotal: s.recent.length }
    add(tallyNew, statusFromPoints(s.points, target, evidence), r.is_correct)
    add(tallyOld, statusFromPoints(s.points, target), r.is_correct)
    add(tallyConf, evidenceConfidence(s.answered, bankSize.get(sk) ?? 0).level, r.is_correct)
  }

  s.seen.add(r.question_id)
  s.answered++
  s.recent.unshift(r.is_correct)
  if (s.recent.length > RECENT_WINDOW) s.recent.pop()
  if (r.is_correct && r.quiz_type !== 'mistakes' && !s.credited.has(r.question_id)) {
    s.credited.add(r.question_id)
    s.points += pointsForQuestion(r.difficulty == null ? 0.5 : Number(r.difficulty))
  }
}

const ORDER = ['not_started', 'in_progress', 'confident', 'proficient', 'mastered']
const pct = (t) => (t?.n ? `${Math.round((t.right / t.n) * 100)}%` : '-')
const flag = (t) => (t && t.n < MIN_SAMPLE ? '  (too few to trust)' : '')

console.log(`\n${responses.length} answers from ${users.size} student${users.size === 1 ? '' : 's'}${subjectWanted ? ` in ${subjectWanted}` : ''}.`)
console.log('Accuracy on a question the student had never seen, by the level they held just before it.\n')
console.log(`${'Level'.padEnd(12)} ${'now: n'.padStart(8)} ${'right'.padStart(6)}   ${'points only: n'.padStart(15)} ${'right'.padStart(6)}`)
for (const st of ORDER) {
  const a = tallyNew.get(st)
  const b = tallyOld.get(st)
  console.log(`${STATUS_LABELS[st].padEnd(12)} ${String(a?.n || 0).padStart(8)} ${pct(a).padStart(6)}   ${String(b?.n || 0).padStart(15)} ${pct(b).padStart(6)}${flag(a)}`)
}

console.log('\nBy confidence:')
for (const c of ['none', 'low', 'medium', 'high']) {
  const t = tallyConf.get(c)
  console.log(`  ${c.padEnd(8)} ${String(t?.n || 0).padStart(6)} ${pct(t).padStart(6)}${flag(t)}`)
}

// The check itself: each level should beat the one below it.
const ladder = ORDER.slice(1).map((st) => ({ st, t: tallyNew.get(st) })).filter((x) => x.t?.n >= MIN_SAMPLE)
const inversions = ladder.slice(1).filter((x, i) => x.t.right / x.t.n < ladder[i].t.right / ladder[i].t.n)
console.log(
  ladder.length < 2
    ? `\nNot enough answers yet to judge the ladder (need ${MIN_SAMPLE}+ per level).`
    : inversions.length
      ? `\nOut of order: ${inversions.map((x) => STATUS_LABELS[x.st]).join(', ')} scored below the level beneath. The thresholds in lib/progress.js need a look.`
      : '\nEach level with enough answers beats the one below it.'
)
const m = tallyNew.get('mastered')
if (m?.n >= MIN_SAMPLE) console.log(`Mastered answers ${pct(m)} of new questions right (aim: about 80%).`)
console.log('\nThe predicted grade is not checked here: that needs real exam results, after May.\n')
