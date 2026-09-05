/**
 * Is the question bank actually as deep as it looks?
 *
 *   npm run audit -- --subject "Math Analysis & Approaches HL"
 *   npm run audit -- --subject "Physics SL" --subtopic "Forces and dynamics"
 *   npm run audit -- --subject "Physics SL" --recheck 40
 *
 * A row count is not depth, but nor is every repeat a problem. Twenty
 * differentiation questions with different functions is how procedural fluency
 * is built; a student who has done one product rule question has not learned
 * the product rule. So this counts two different things and only complains
 * about one of them:
 *
 *   types      distinct question shapes, once the numbers are stripped out.
 *              This is the real measure of coverage.
 *   variants   the same shape with different values. Good practice in maths,
 *              physics, chemistry and economics. Padding in history or TOK,
 *              where there are no numbers to vary and a variant is just the
 *              same question asked twice.
 *   twins      same shape AND same numbers, so genuinely the same question
 *              reworded. Wasted rows in every subject.
 *
 * It also reports:
 *
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

/** The numbers in a question, in order, so two variants can be told apart. */
function numbersIn(stem) {
  return (String(stem).match(/\d+(\.\d+)?/g) || []).join(',')
}

/**
 * Subjects where varying the numbers produces genuinely new practice. In
 * everything else a repeated shape is just the same question again, because
 * there is nothing to vary.
 */
const PROCEDURAL = /math|physics|chemistry|economics|computer science|business|sports/i

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
        q.question_type === 'short_answer'
          ? `${i}. ${q.stem}\n   Accepted: ${(q.accepted_answers || []).join(' | ')}`
          : `${i}. ${q.stem}\n   Options: ${(q.options || [])
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
    `SELECT id, subject, subtopic, stem, options, correct_answer, difficulty,
            question_type, accepted_answers
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

  let totalTwins = 0

  for (const [key, qs] of bySubtopic) {
    const [subject, subtopic] = key.split('|||')
    const procedural = PROCEDURAL.test(subject)

    // Group by shape. Each group is one question type; its members are
    // variants of it.
    const types = new Map()
    for (const q of qs) {
      const s = shape(q.stem)
      if (!types.has(s)) types.set(s, [])
      types.get(s).push(q)
    }

    // Within a type, identical numbers means it is not a variant at all.
    let twins = 0
    for (const group of types.values()) {
      const seen = new Set()
      for (const q of group) {
        const n = numbersIn(q.stem)
        if (seen.has(n)) twins++
        else seen.add(n)
      }
    }

    // Different words entirely, so a genuinely separate type even if the shape
    // hash did not catch it.
    const kept = []
    for (const [s, group] of types) {
      const w = words(group[0].stem)
      if (!kept.some((k) => jaccard(w, k) >= 0.85)) kept.push(w)
    }

    const typeCount = kept.length
    const perType = (qs.length / Math.max(1, typeCount)).toFixed(1)
    totalDistinct += typeCount
    totalTwins += twins

    worst.push({ subtopic, procedural, total: qs.length, types: typeCount, perType, twins })
  }

  // Sort by the thing that actually matters: how few question types there are.
  worst.sort((a, b) => a.types - b.types)

  console.log('Thinnest coverage (fewest distinct question types):')
  console.log('  types  variants each  same-question twins  subtopic')
  for (const w of worst.slice(0, 12)) {
    console.log(
      `  ${String(w.types).padStart(5)}  ${String(w.perType).padStart(13)}  ${String(w.twins).padStart(19)}  ` +
        `${w.subtopic}${w.procedural ? '' : '  (variants do not help here)'}`
    )
  }

  console.log(`\n${totalDistinct} distinct question types across ${rows.length} questions`)
  console.log(
    `${(rows.length / Math.max(1, totalDistinct)).toFixed(1)} variants per type on average`
  )
  if (totalTwins > 0) {
    console.log(
      `${totalTwins} are the same question with the same numbers, which is padding in any subject.`
    )
  }

  const thin = worst.filter((w) => w.types < 8)
  if (thin.length) {
    console.log(
      `\n${thin.length} subtopic${thin.length === 1 ? ' has' : 's have'} fewer than 8 question types.` +
        ' More questions there will mostly be more of the same few.'
    )
  }
  const nonProceduralPadding = worst.filter((w) => !w.procedural && w.total / Math.max(1, w.types) > 2)
  if (nonProceduralPadding.length) {
    console.log(
      `${nonProceduralPadding.length} non-numerical subtopic${nonProceduralPadding.length === 1 ? '' : 's'}` +
        ' repeat a shape, where there are no numbers to vary and a repeat is just a repeat.'
    )
  }

  // Answer skew: a bank where the answer is usually (b) is guessable.
  const mcq = rows.filter((q) => q.question_type !== 'short_answer')
  const short = rows.length - mcq.length
  if (short > 0) {
    console.log(`\nTypes: ${mcq.length} multiple choice, ${short} short answer`)
  }

  // Letter skew is meaningless for a typed answer, so only the MCQs count.
  const letters = {}
  for (const q of mcq) letters[q.correct_answer] = (letters[q.correct_answer] || 0) + 1
  const skew = Object.entries(letters).sort((a, b) => b[1] - a[1])
  console.log(
    '\nCorrect answer spread: ' +
      skew.map(([l, n]) => `${l} ${Math.round((n / Math.max(1, mcq.length)) * 100)}%`).join('  ')
  )
  if (mcq.length && skew[0] && skew[0][1] / mcq.length > 0.4) {
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
