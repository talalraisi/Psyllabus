/**
 * What generating the bank would cost, before you spend anything.
 *
 * Built from the pipeline's own settings and from the size of questions that
 * already exist, not from a guess at "a question is about this big". What is
 * measured and what is assumed is marked, because the assumptions are where
 * this can be wrong and you should be able to push on them.
 *
 * Rates are Gemini 2.5 Flash paid tier, read from ai.google.dev in September
 * 2026: $0.30 per million input tokens, $2.50 per million output. They change.
 *
 *   node scripts/estimate-cost.mjs
 *   node scripts/estimate-cost.mjs --subtopics 6317 --per-subtopic 10
 */

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d
}

const RATE = { input: 0.3 / 1e6, output: 2.5 / 1e6 } // dollars per token

const SUBTOPICS = parseInt(arg('subtopics', '6317'), 10) // measured: IB rows in syllabus_content
const BATCH = 20 // pipeline default
const VERIFY_PASSES = 2 // pipeline default
const CARDS_PER_SUBTOPIC = 8 // pipeline default

/**
 * Assumed, and the numbers most worth arguing with.
 *
 * The 622 questions already in the bank average 848 characters of stored
 * payload, but they carry no markscheme and many carry no hint or option
 * feedback — all three are required now, so a new one is bigger. 1,100
 * characters at roughly four characters to a token, plus the JSON keys the
 * model also has to emit, gives about 350 output tokens per question.
 */
const OUT_PER_QUESTION = 350
const OUT_PER_CARD = 70 // measured 171 chars + JSON scaffolding
const PROMPT_TOKENS = 3000 // syllabus context, house rules, worked examples
const VERIFY_IN_PER_Q = 250 // the stem and options, sent back to be solved
const VERIFY_OUT_PER_Q = 30 // an answer and a confidence flag

function questionCost(perSubtopic) {
  const total = SUBTOPICS * perSubtopic
  const calls = Math.ceil(total / BATCH)

  const genIn = calls * PROMPT_TOKENS
  const genOut = total * OUT_PER_QUESTION

  const verIn = VERIFY_PASSES * (calls * PROMPT_TOKENS + total * VERIFY_IN_PER_Q)
  const verOut = VERIFY_PASSES * total * VERIFY_OUT_PER_Q

  return {
    total,
    calls: calls * (1 + VERIFY_PASSES),
    input: genIn + verIn,
    output: genOut + verOut,
    dollars: (genIn + verIn) * RATE.input + (genOut + verOut) * RATE.output,
  }
}

function cardCost() {
  const total = SUBTOPICS * CARDS_PER_SUBTOPIC
  const calls = SUBTOPICS // one call per subtopic
  const genIn = calls * 2000
  const genOut = total * OUT_PER_CARD
  const verIn = calls * 2000 + total * 60
  const verOut = total * 25
  return {
    total,
    calls: calls * 2,
    input: genIn + verIn,
    output: genOut + verOut,
    dollars: (genIn + verIn) * RATE.input + (genOut + verOut) * RATE.output,
  }
}

const money = (n) => (n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString()}`)
const big = (n) => n.toLocaleString()

console.log(`Whole IB: ${big(SUBTOPICS)} subtopics, Gemini 2.5 Flash paid tier\n`)
console.log('QUESTIONS')
console.log('  per subtopic |    questions |     calls |   input tok |  output tok |      cost')
for (const per of [3, 5, 10, 20]) {
  const c = questionCost(per)
  console.log(
    `  ${String(per).padStart(12)} | ${big(c.total).padStart(12)} | ${big(c.calls).padStart(9)} | ` +
      `${big(c.input).padStart(11)} | ${big(c.output).padStart(11)} | ${money(c.dollars).padStart(9)}`
  )
}

const cards = cardCost()
console.log('\nFLASHCARDS')
console.log(
  `  ${CARDS_PER_SUBTOPIC} per subtopic | ${big(cards.total)} cards | ${big(cards.calls)} calls | ` +
    `${money(cards.dollars)}`
)

console.log('\nTOGETHER')
for (const per of [5, 10]) {
  const q = questionCost(per)
  console.log(
    `  ${per} questions + ${CARDS_PER_SUBTOPIC} cards per subtopic: ${money(q.dollars + cards.dollars)}`
  )
}

console.log(`
Assumptions worth pushing on:
  ${OUT_PER_QUESTION} output tokens per question, ${OUT_PER_CARD} per card
  ${big(PROMPT_TOKENS)} prompt tokens per generation call
  ${VERIFY_PASSES} verification passes, which the pipeline does by default

The free tier is rate-limited rather than priced, and the limits are not on
the pricing page — they are in AI Studio against your own key. Free changes
how long this takes, not what it costs.

Rejected questions still cost money. The verifier throws away anything two
independent solves disagree on, so budget above the figure, not at it.`)
