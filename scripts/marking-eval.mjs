/**
 * How close Syllabi's marking is to the real marks.
 *
 * Marked examples go in a folder outside the repository (they are other
 * people's work, used only to measure): by default ~/Desktop/marking-samples.
 *
 *   1.pdf, 2.pdf, …          the work; or 3-1.png, 3-2.png … page images
 *   marks.json               the real marks, one entry per example:
 *     [{ "n": 1, "subject": "Biology HL", "kind": "ia",
 *        "marks": { "A": 5, "B": 4, "C": 5, "D": 3 }, "grade": "6", "url": "…" }]
 *
 * Each example is marked exactly as a student's draft is (lib/draft-marking.js:
 * the guide's criteria, three readings, grade from the boundaries), then
 * compared criterion by criterion.
 *
 *   node scripts/marking-eval.mjs              # every example
 *   node scripts/marking-eval.mjs --only 1,4   # some
 *   node scripts/marking-eval.mjs --readings 0 # the review alone, no extra readings
 *
 * Costs roughly $0.15–0.30 an example. Results are saved beside the
 * examples as eval-<date>.json, so runs can be compared.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { loadEnv, connect } from './db.mjs'
import { rubricFor } from '../lib/criteria.js'
import { componentGrade } from '../lib/component-grade.js'
import { markDraft, settleMarks } from '../lib/draft-marking.js'
import { cleanReview } from '../lib/draft-review.js'

loadEnv()
const DIR = process.env.MARKING_SAMPLES || path.join(process.env.HOME, 'Desktop/marking-samples')
const arg = (name, d = null) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const only = arg('only') ? new Set(arg('only').split(',').map(Number)) : null
const readings = Number(arg('readings', '2'))
const MODEL = process.env.SYLLABI_MODEL || 'claude-sonnet-5-5'

const require = createRequire(path.resolve('package.json'))
const { default: Anthropic } = await import(pathToFileURL(require.resolve('@anthropic-ai/sdk')).href)
const anthropic = new Anthropic()

const examples = JSON.parse(fs.readFileSync(path.join(DIR, 'marks.json'), 'utf8')).filter((e) => !only || only.has(e.n))
const files = fs.readdirSync(DIR)
const db = await connect({ quiet: true })

/** The example as message content: a PDF, or its pages as images. */
function contentFor(n) {
  const pdf = files.find((f) => f === `${n}.pdf`)
  if (pdf) {
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fs.readFileSync(path.join(DIR, pdf)).toString('base64') } },
      { type: 'text', text: 'Mark this work.' },
    ]
  }
  const pages = files.filter((f) => new RegExp(`^${n}-(\\d+)\\.(png|jpe?g)$`, 'i').test(f)).sort((a, b) => Number(a.split('-')[1].split('.')[0]) - Number(b.split('-')[1].split('.')[0]))
  if (!pages.length) return null
  return [
    ...pages.map((f) => ({ type: 'image', source: { type: 'base64', media_type: /png$/i.test(f) ? 'image/png' : 'image/jpeg', data: fs.readFileSync(path.join(DIR, f)).toString('base64') } })),
    { type: 'text', text: 'These are the pages of the work, in order. Mark it.' },
  ]
}

const results = []
let cost = 0
for (const ex of examples) {
  const content = contentFor(ex.n)
  const rubric = rubricFor(ex.kind, ex.subject)
  if (!content || !rubric) {
    console.log(`#${ex.n} skipped: ${!content ? 'no file' : 'no rubric for ' + ex.subject}`)
    continue
  }
  const { rows } = await db.query('select body from marking_rubrics where key = $1', [rubric.key || ''])
  const t0 = Date.now()
  const marked = await markDraft({ anthropic, model: MODEL, kind: ex.kind, subject: ex.subject, rubric, guide: rows[0]?.body || null, content, maxTokens: 16000, readings })
  const review = cleanReview(marked.answer, '', rubric)
  if (!review) {
    console.log(`#${ex.n} the review did not parse (${marked.stop_reason})`)
    continue
  }
  const criteria = settleMarks(review.criteria, marked.extra)
  const total = criteria.reduce((a, c) => a + c.score, 0)
  const realTotal = Object.values(ex.marks).reduce((a, m) => a + m, 0)
  const grade = componentGrade({ kind: ex.kind, subject: ex.subject, rubric, total })?.grade
  const u = marked.usage
  cost += ((u.input_tokens || 0) * 2 + (u.cache_creation_input_tokens || 0) * 2.5 + (u.cache_read_input_tokens || 0) * 0.2 + (u.output_tokens || 0) * 10) / 1e6
  const rows2 = criteria.map((c) => ({ id: c.id, real: ex.marks[c.id], ours: c.score, readings: c.readings.join('/'), diff: c.score - (ex.marks[c.id] ?? NaN) }))
  results.push({ n: ex.n, subject: ex.subject, kind: ex.kind, real: { total: realTotal, grade: String(ex.grade ?? '') }, ours: { total, grade }, criteria: rows2 })
  console.log(
    `#${String(ex.n).padEnd(3)} ${ex.subject.padEnd(36).slice(0, 36)} ${ex.kind.padEnd(4)} real ${String(realTotal).padStart(2)} (${ex.grade ?? '?'})  ours ${String(total).padStart(2)} (${grade ?? '?'})  ` +
      rows2.map((r) => `${r.id} ${r.real ?? '?'}→${r.ours}`).join('  ') +
      `  ${Math.round((Date.now() - t0) / 1000)}s`
  )
}

const diffs = results.flatMap((r) => r.criteria.map((c) => c.diff).filter(Number.isFinite))
const mae = diffs.reduce((a, d) => a + Math.abs(d), 0) / Math.max(1, diffs.length)
const bias = diffs.reduce((a, d) => a + d, 0) / Math.max(1, diffs.length)
const within1 = diffs.filter((d) => Math.abs(d) <= 1).length / Math.max(1, diffs.length)
const graded = results.filter((r) => r.real.grade && r.ours.grade)
const exact = graded.filter((r) => r.real.grade === r.ours.grade).length
const near = graded.filter((r) => /^\d$/.test(r.real.grade) ? Math.abs(Number(r.real.grade) - Number(r.ours.grade)) <= 1 : 'ABCDE'.indexOf(r.real.grade) >= 0 && Math.abs('ABCDE'.indexOf(r.real.grade) - 'ABCDE'.indexOf(r.ours.grade)) <= 1).length

console.log(`\n${results.length} examples, ${diffs.length} criterion marks`)
console.log(`average error per criterion: ${mae.toFixed(2)} marks (${bias >= 0 ? '+' : ''}${bias.toFixed(2)} on average: ${bias > 0.15 ? 'marking high' : bias < -0.15 ? 'marking low' : 'no lean'})`)
console.log(`criterion marks within 1 of the real one: ${Math.round(within1 * 100)}%`)
console.log(`grade exactly right: ${exact}/${graded.length}, within one grade: ${near}/${graded.length}`)
console.log(`cost: about $${cost.toFixed(2)}`)

fs.writeFileSync(path.join(DIR, `eval-${new Date().toISOString().slice(0, 16).replace(/:/g, '')}.json`), JSON.stringify({ model: MODEL, readings, mae, bias, within1, exact, near, results }, null, 1))
await db.end()
