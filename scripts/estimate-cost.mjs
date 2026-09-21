/**
 * What the bank costs to build, and what Syllabi costs to run.
 *
 * Two different kinds of money. Questions and flashcards are generated once
 * and then owned. Syllabi is charged every time a student presses the button,
 * for as long as they are a subscriber — so it is not a bill, it is a margin.
 *
 * The subtopic counts and payload sizes are measured from the database. The
 * per-token rates are quoted with the date they were read. Everything else is
 * an assumption, marked as one.
 *
 *   node scripts/estimate-cost.mjs
 */

import { loadEnv, connect } from './db.mjs'
import { markschemeProfile } from '../lib/markscheme.js'

/* Rates, read September 2026. ai.google.dev/gemini-api/docs/pricing and
   claude.com/pricing. Dollars per million tokens. */
const GEMINI_FLASH = { input: 0.3, output: 2.5 }
const SONNET_5 = { input: 2, output: 10 }

/* Pipeline defaults. */
const BATCH = 20
const VERIFY_PASSES = 2

/* Measured from the rows that exist; see the comment in the previous version
   for why a new question is bigger than the 848 characters of an old one. */
const OUT_PER_QUESTION = 350
const OUT_PER_CARD = 70
const PROMPT_TOKENS = 3000
const VERIFY_IN_PER_Q = 250
const VERIFY_OUT_PER_Q = 30

/**
 * How many objective questions a subtopic is worth, by how the subject is
 * marked. A hundred multiple-choice questions on a Visual Arts subtopic is a
 * hundred questions about something that is assessed by exhibition, and no
 * amount of generation makes that the right tool. The essay subjects get
 * enough for recall and understanding; the marking that matters there is
 * Syllabi reading actual writing.
 */
const PER_SUBTOPIC = { points: 100, criteria: 30, none: 20, core: 0 }
const CARDS = { points: 50, criteria: 50, none: 30, core: 20 }

const money = (n) => (n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString()}`)
const big = (n) => Math.round(n).toLocaleString()

function genCost(questions, cards) {
  const qCalls = Math.ceil(questions / BATCH)
  const qIn = qCalls * PROMPT_TOKENS + VERIFY_PASSES * (qCalls * PROMPT_TOKENS + questions * VERIFY_IN_PER_Q)
  const qOut = questions * OUT_PER_QUESTION + VERIFY_PASSES * questions * VERIFY_OUT_PER_Q

  const cCalls = Math.ceil(cards / 25) * 2
  const cIn = cCalls * 2000 + cards * 60
  const cOut = cards * OUT_PER_CARD + cards * 25

  const dollars = ((qIn + cIn) / 1e6) * GEMINI_FLASH.input + ((qOut + cOut) / 1e6) * GEMINI_FLASH.output
  return { dollars, calls: qCalls * (1 + VERIFY_PASSES) + cCalls }
}

async function main() {
  loadEnv()
  const c = await connect({ quiet: true })
  const { rows } = await c.query(
    `select subject, count(*) n from syllabus_content where curriculum='IB' group by 1`
  )
  await c.end()

  const core = /Theory of Knowledge|Extended Essay|Creativity/i
  const group = {}
  for (const r of rows) {
    const key = core.test(r.subject) ? 'core' : markschemeProfile(r.subject).style
    group[key] ??= { subjects: 0, subtopics: 0 }
    group[key].subjects++
    group[key].subtopics += Number(r.n)
  }

  console.log('BUILDING THE BANK — Gemini 2.5 Flash, one-off\n')
  console.log('  marking    subjects  subtopics  questions   cards      cost')
  let totalQ = 0
  let totalC = 0
  let totalD = 0
  for (const key of ['points', 'criteria', 'none', 'core']) {
    const g = group[key]
    if (!g) continue
    const q = g.subtopics * PER_SUBTOPIC[key]
    const cards = g.subtopics * CARDS[key]
    const { dollars } = genCost(q, cards)
    totalQ += q
    totalC += cards
    totalD += dollars
    console.log(
      `  ${key.padEnd(10)} ${String(g.subjects).padStart(6)} ${String(g.subtopics).padStart(10)} ` +
        `${big(q).padStart(10)} ${big(cards).padStart(8)} ${money(dollars).padStart(9)}`
    )
  }
  console.log(
    `  ${'TOTAL'.padEnd(10)} ${''.padStart(6)} ${''.padStart(10)} ${big(totalQ).padStart(10)} ` +
      `${big(totalC).padStart(8)} ${money(totalD).padStart(9)}`
  )
  console.log(`\n  With 25% thrown away by the verifier: ${money(totalD * 1.25)}`)

  /* ----------------------------------------------------------- Syllabi --- */
  console.log('\n\nRUNNING SYLLABI — Claude Sonnet 5, every month, per student\n')
  const perRequest = (inTok, outTok) =>
    (inTok / 1e6) * SONNET_5.input + (outTok / 1e6) * SONNET_5.output

  const cases = [
    ['a 1,500-word IA section', 2200, 1200],
    ['a 4,000-word IA', 5800, 1500],
    ['a 4,000-word EE draft', 5800, 1800],
    ['the longest it accepts (60k chars)', 15000, 2000],
  ]
  for (const [label, i, o] of cases) {
    console.log(`  ${label.padEnd(36)} ${money(perRequest(i, o))}`)
  }

  const typical = perRequest(5800, 1500)
  const DAILY_LIMIT = 12
  console.log(`\n  A student who uses all ${DAILY_LIMIT} a day, every day:`)
  console.log(`    ${money(typical * DAILY_LIMIT)} a day · ${money(typical * DAILY_LIMIT * 30)} a month`)
  console.log(`  Premium is $20 a month.`)
  console.log(`\n  Realistic use — a few drafts a month rather than twelve a day:`)
  for (const n of [5, 20, 60]) {
    console.log(`    ${String(n).padStart(3)} requests a month: ${money(typical * n)}`)
  }
}

main()
