/**
 * Is the question bank actually as deep as it looks?
 *
 *   npm run audit -- --subject "Math Analysis & Approaches HL"
 *   npm run audit -- --subject "Physics SL" --subtopic "Forces and dynamics"
 *   npm run audit -- --subject "Physics SL" --recheck 40
 *
 * A row count is not depth. A model asked for 300 questions on a narrow
 * subtopic will write perhaps sixty genuinely different ones and then start
 * reskinning them with new numbers. The unique index on stem_fingerprint only
 * catches identical text, so those all insert happily and the bank looks three
 * hundred deep while a student sees the same question over and over.
 *
 * This reports what is really there:
 *
 *   shape collisions   same sentence, different numbers
 *   near duplicates    high word overlap, so barely reworded
 *   answer skew        if the right option is nearly always (b), the bank is
 *                      guessable without knowing any of the content
 *   difficulty spread  a bank of easy questions cannot reach mastery, since
 *                      easy questions are worth a quarter point each
 *
 * --recheck N additionally re-verifies a random sample against the model,
 * which gives an error rate. Use --provider claude for that if you can: a model
 * marking its own homework is worth much less than an independent one.
 */

import Anthropic from '@anthropic-ai/sdk'
import { loadEnv, connect } from './db.mjs'

const args = process.argv.slice(2)
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}

const SUBJECT = arg('subject', null)
const SUBTOPIC = arg('subtopic', null)
const RECHECK = parseInt(arg('recheck', '0'), 10)
const PROVIDER = arg('provider', 'ollama')
const OLLAMA_MODEL = arg('ollama-model', 'qwen2.5:14b')
const OLLAMA_URL = arg('ollama-url', 'http://localhost:11434')

/* -------------------------------------------------------------------------- *
 * Similarity
 * -------------------------------------------------------------------------- */

/**
 * The question with its specifics removed. "Solve 3x + 2 = 8" and
 * "Solve 7x + 4 = 11" both reduce to "solve #x # # #", so the reskinning that
 * fingerprints miss shows up as an exact collision here.
 */
function shape(stem) {
  return String(stem)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP = new Set('the a an of to in for is are and or what which find given value calculate determine'.split(' '))

function words(stem) {
  return new Set(
    shape(stem)
      .split(' ')
      .filter((w) => w && w !== '#' && !STOP.has(w))
  )
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / (a.size + b.size - shared)
}

/* -------------------------------------------------------------------------- *
 * Re-verification
 * -------------------------------------------------------------------------- */

const VERDICTS_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          sound: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['index', 'sound', 'reason'],
      },
    },
  },
  required: ['verdicts'],
}

async function judge(batch) {
  const listing = batch
    .map(
      (q, i) =>
        `${i}. ${q.stem}\n   Options: ${(q.options || [])
          .map((o) => `(${o.id}) ${o.text}`)
          .join('  ')}\n   Marked correct: (${q.correct_answer})`
    )
    .join('\n\n')

  const prompt = `You are auditing an exam question bank. Solve each question from scratch, then judge it.

sound=true when the option marked correct is genuinely the right answer and exactly one option is right.
sound=false only when your worked answer differs from the marked option, or more than one option is right, or none is, or the question cannot be answered from what it gives you.

Do not mark something unsound over wording or style. Keep each reason to one short sentence.

Questions:\n\n${listing}`

  if (PROVIDER === 'claude') {
    const anthropic = new Anthropic()
    const res = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ name: 'report', input_schema: VERDICTS_SCHEMA }],
      tool_choice: { type: 'tool', name: 'report' },
    })
    return res.content.find((c) => c.type === 'tool_use')?.input?.verdicts || []
  }

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: VERDICTS_SCHEMA,
      options: { temperature: 0 },
    }),
  })
  const data = await res.json()
  return JSON.parse(data?.message?.content || '{"verdicts":[]}').verdicts || []
}

/* -------------------------------------------------------------------------- */

loadEnv()
const db = await connect()

try {
  const where = []
  const params = []
  if (SUBJECT) { params.push(SUBJECT); where.push(`subject = $${params.length}`) }
  if (SUBTOPIC) { params.push(SUBTOPIC); where.push(`subtopic = $${params.length}`) }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { rows } = await db.query(
    `SELECT id, subject, subtopic, stem, options, correct_answer, difficulty
     FROM questions ${clause} ORDER BY subject, subtopic, created_at`,
    params
  )

  if (!rows.length) {
    console.log('No questions match that filter.')
    process.exit(0)
  }

  const bySubtopic = new Map()
  for (const q of rows) {
    const key = `${q.subject}|||${q.subtopic}`
    if (!bySubtopic.has(key)) bySubtopic.set(key, [])
    bySubtopic.get(key).push(q)
  }

  console.log(`${rows.length} questions across ${bySubtopic.size} subtopics\n`)

  let totalDistinct = 0
  const worst = []

  for (const [key, qs] of bySubtopic) {
    const subtopic = key.split('|||')[1]

    // Same sentence with the numbers swapped.
    const shapes = new Map()
    for (const q of qs) {
      const s = shape(q.stem)
      shapes.set(s, (shapes.get(s) || 0) + 1)
    }
    const shapeCollisions = qs.length - shapes.size

    // Barely reworded: high word overlap with something already counted.
    const kept = []
    let nearDupes = 0
    for (const q of qs) {
      const w = words(q.stem)
      if (kept.some((k) => jaccard(w, k) >= 0.75)) nearDupes++
      else kept.push(w)
    }

    const distinct = kept.length
    totalDistinct += distinct
    const realDepth = Math.round((distinct / qs.length) * 100)

    worst.push({ subtopic, total: qs.length, distinct, realDepth, shapeCollisions, nearDupes })
  }

  worst.sort((a, b) => a.realDepth - b.realDepth)

  console.log('Least varied subtopics:')
  console.log('  distinct/total   shape collisions   near dupes   subtopic')
  for (const w of worst.slice(0, 12)) {
    console.log(
      `  ${String(w.distinct).padStart(4)}/${String(w.total).padEnd(5)} ${String(w.realDepth + '%').padStart(5)}` +
        `   ${String(w.shapeCollisions).padStart(6)}            ${String(w.nearDupes).padStart(5)}       ${w.subtopic}`
    )
  }

  const pct = Math.round((totalDistinct / rows.length) * 100)
  console.log(`\nGenuinely distinct: ${totalDistinct} of ${rows.length} (${pct}%)`)
  if (pct < 70) {
    console.log('A large share of this bank is the same question reworded. Generating more of')
    console.log('the same will not add depth; the prompt needs to change first.')
  }

  // Answer skew: a bank where the answer is usually (b) is guessable.
  const letters = {}
  for (const q of rows) letters[q.correct_answer] = (letters[q.correct_answer] || 0) + 1
  const skew = Object.entries(letters).sort((a, b) => b[1] - a[1])
  console.log(
    '\nCorrect answer spread: ' +
      skew.map(([l, n]) => `${l} ${Math.round((n / rows.length) * 100)}%`).join('  ')
  )
  if (skew[0] && skew[0][1] / rows.length > 0.4) {
    console.log(`  Skewed towards (${skew[0][0]}). A student could beat this bank by always picking it.`)
  }

  // Difficulty. Easy questions are worth a quarter point, so a bank of them
  // cannot get anyone to mastery however many they answer.
  const bands = { easy: 0, medium: 0, hard: 0 }
  for (const q of rows) {
    const d = Number(q.difficulty) || 0.5
    bands[d <= 0.35 ? 'easy' : d <= 0.65 ? 'medium' : 'hard']++
  }
  const maxPoints = bands.easy * 0.25 + bands.medium * 0.5 + bands.hard * 1
  console.log(
    `\nDifficulty: easy ${bands.easy}  medium ${bands.medium}  hard ${bands.hard}` +
      `  (${(maxPoints / bySubtopic.size).toFixed(1)} points available per subtopic, 20 needed for mastery)`
  )
  if (maxPoints / bySubtopic.size < 20) {
    console.log('  Not enough points in the bank for a student to reach Mastered.')
  }

  if (RECHECK > 0) {
    const sample = [...rows].sort(() => Math.random() - 0.5).slice(0, RECHECK)
    console.log(
      `\nRe-checking ${sample.length} at random with ${PROVIDER === 'claude' ? 'Claude' : OLLAMA_MODEL}...`
    )
    let bad = 0
    const failures = []
    for (let i = 0; i < sample.length; i += 8) {
      const batch = sample.slice(i, i + 8)
      try {
        const verdicts = await judge(batch)
        for (const v of verdicts) {
          if (!v.sound && batch[v.index]) {
            bad++
            failures.push(`  ${batch[v.index].stem.slice(0, 70)}... — ${v.reason}`)
          }
        }
      } catch (err) {
        console.error(`  batch failed: ${err.message}`)
      }
      process.stdout.write(`\r  ${Math.min(i + 8, sample.length)}/${sample.length}`)
    }
    const rate = Math.round((bad / sample.length) * 100)
    console.log(`\n  ${bad} of ${sample.length} failed re-check (${rate}%)`)
    if (failures.length) {
      console.log('\n  Examples:')
      failures.slice(0, 8).forEach((f) => console.log(f))
    }
    if (PROVIDER !== 'claude') {
      console.log('\n  This used the same model that wrote them, so treat it as a floor,')
      console.log('  not an error rate. Re-run with --provider claude for a real number.')
    }
  }
} finally {
  await db.end()
}
