/**
 * The whole build, in order: the pilot school's subjects first, then the
 * rest; question banks and decks, then predicted papers. Each subject is
 * published the moment its checks pass, so students see content arrive
 * subject by subject rather than all at the end.
 *
 * Several subjects run at once: most of a build is waiting for the Batch
 * API, and the waits overlap. Every child shares the spending ledger
 * (content-runs/spend.jsonl), so the caps hold across all of them.
 *
 *   node scripts/run-build.mjs --claude-cap 187 --gemini-cap 28
 *
 * Progress: content-runs/build-status.json; each job's log in content-runs/logs.
 *
 *   node scripts/run-build.mjs --grow --claude-cap 330 --gemini-cap 35
 *
 * --grow: the subjects students actually take, bank doubled from the half
 * size they were first built at. Only the new slots are written, and publish
 * adds them beside the questions already live (no --retire-old).
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i === -1 ? d : process.argv[i + 1]
}
const CLAUDE_CAP = arg('claude-cap', '187')
const GEMINI_CAP = arg('gemini-cap', '28')
// Waiting on the Batch API costs nothing, so by default everything waits at once.
const PARALLEL = Number(arg('parallel', 100))
const LOGS = path.join(ROOT, 'content-runs/logs')
const STATUS = path.join(ROOT, arg('status', 'content-runs/build-status.json'))
fs.mkdirSync(LOGS, { recursive: true })

const PILOT = [
  'English A: Language & Literature', 'English A: Literature', 'Arabic A: Language & Literature',
  'Arabic B', 'French B', 'Spanish B', 'Spanish ab initio',
  'Business Management', 'Economics', 'Geography', 'History', 'Psychology', 'Environmental Systems and Societies',
  'Biology', 'Chemistry', 'Physics', 'Computer Science',
  'Math Applications & Interpretation', 'Math Analysis & Approaches',
  'Theatre', 'Visual Arts',
]
const REST = [
  'Arabic A: Literature', 'French A: Literature', 'Spanish A: Literature', 'French A: Language & Literature', 'Spanish A: Language & Literature',
  'English B', 'Mandarin B', 'English ab initio', 'French ab initio', 'Arabic ab initio', 'Mandarin ab initio',
  'Digital Society', 'Design Technology', 'Sports, Exercise, and Health Science',
  'Dance', 'Film', 'Music',
]
// The last IB courses, held back until now (lib/catalogue.js HIDDEN_COURSES).
const LAST = [
  'Global Politics', 'Philosophy', 'Social and Cultural Anthropology', 'World Religions',
  'Classical Languages: Latin', 'Classical Languages: Classical Greek',
  'Mandarin A: Language & Literature', 'Literature and Performance',
]
// Papers: every course with written exams. History for exams from 2028.
// Literature and Performance has no guide on file to take a paper format from.
const NO_PAPERS = new Set(['Theatre', 'Visual Arts', 'Dance', 'Film', 'Music', 'Literature and Performance'])
const paperName = (c) => (c === 'History' ? 'History 2028' : c)

const caps = ['--claude-cap', CLAUDE_CAP, '--gemini-cap', GEMINI_CAP]
const content = (c) => {
  const extra = c === 'Physics' ? ['--run', 'physics-rest', '--exclude-codes', 'A.1,A.2,A.3'] : []
  return [
    ['scripts/build-content.mjs', '--course', c, '--scale', '0.5', '--audit', '20', ...extra, ...caps],
    ['scripts/build-content.mjs', '--course', c, '--stage', 'publish', '--retire-old', ...extra, ...caps],
  ]
}
const papers = (c) => [
  ['scripts/build-papers.mjs', '--course', paperName(c), '--versions', '2', '--audit-versions', '1', ...caps],
  ['scripts/build-papers.mjs', '--course', paperName(c), '--stage', 'publish', ...caps],
]

// Most-picked first, so if a cap is reached the subjects most students take are done.
const GROW = [
  'English A: Language & Literature', 'Math Analysis & Approaches', 'Physics', 'Business Management',
  'Chemistry', 'Math Applications & Interpretation', 'Environmental Systems and Societies',
  'Arabic B', 'French B', 'Computer Science', 'Spanish ab initio',
]
const grow = (c) => {
  // Physics A.1–A.3 were the pilot, already full size: only the rest grows.
  const runs = c === 'Physics' ? [['--run', 'physics-rest', '--exclude-codes', 'A.1,A.2,A.3']] : [[]]
  return runs.flatMap((extra) => [
    ['scripts/build-content.mjs', '--course', c, '--grow', '1', '--audit', '20', ...extra, ...caps],
    ['scripts/build-content.mjs', '--course', c, '--stage', 'publish', ...extra, ...caps],
  ])
}

// Subjects held back, e.g. while their subtopic lists are being updated.
const SKIP = new Set(String(arg('skip', '')).split(',').map((x) => x.trim()).filter(Boolean))

const allJobs = process.argv.includes('--grow') ? GROW.map((c) => ({ name: `grow: ${c}`, steps: grow(c) })) : [
  ...PILOT.map((c) => ({ name: `content: ${c}`, steps: content(c) })),
  ...PILOT.filter((c) => !NO_PAPERS.has(c)).map((c) => ({ name: `papers: ${c}`, steps: papers(c) })),
  ...REST.map((c) => ({ name: `content: ${c}`, steps: content(c) })),
  ...REST.filter((c) => !NO_PAPERS.has(c)).map((c) => ({ name: `papers: ${c}`, steps: papers(c) })),
  ...LAST.map((c) => ({ name: `content: ${c}`, steps: content(c) })),
  ...LAST.filter((c) => !NO_PAPERS.has(c)).map((c) => ({ name: `papers: ${c}`, steps: papers(c) })),
]
// --only "content: Music,papers: Computer Science" runs just those jobs.
// Job names are split only before "content:" or "papers:", since a course
// name can hold commas ("Sports, Exercise, and Health Science").
const ONLY = arg('only') ? new Set(String(arg('only')).split(/,(?=\s*(?:content|papers|grow):)/).map((x) => x.trim())) : null
const jobs = allJobs.filter((j) => !SKIP.has(j.name.replace(/^(content|papers|grow): /, '')) && (!ONLY || ONLY.has(j.name)))

const status = Object.fromEntries(jobs.map((j) => [j.name, 'waiting']))
const write = () => fs.writeFileSync(STATUS, JSON.stringify({ updated: new Date().toISOString(), status }, null, 1))
write()

function runStep(step, log) {
  return new Promise((resolve) => {
    const child = spawn('node', step, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d) => fs.appendFileSync(log, d))
    child.stderr.on('data', (d) => {
      const t = String(d)
      // Node's module-type warning on every child is noise.
      if (!/MODULE_TYPELESS|Reparsing as ES module|"type": "module"|trace-warnings/.test(t)) fs.appendFileSync(log, t)
    })
    child.on('close', (code) => resolve(code))
  })
}

async function runJob(job) {
  const log = path.join(LOGS, `${job.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.log`)
  status[job.name] = 'running'
  write()
  for (const step of job.steps) {
    fs.appendFileSync(log, `\n$ node ${step.join(' ')}\n`)
    const code = await runStep(step, log)
    if (code !== 0) {
      status[job.name] = `failed (exit ${code})`
      write()
      return
    }
  }
  status[job.name] = 'published'
  write()
}

const queue = [...jobs]
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) await runJob(job)
  })
)
console.log('build finished', JSON.stringify(status, null, 1))
