/**
 * Talking to the writers and the checkers, and keeping count of the money.
 *
 * Claude goes through the Message Batches API: half price, results usually
 * within the hour. --direct sends the same requests straight away at full
 * price, for quick tests. Gemini Pro is called directly; it only ever sees
 * the few questions the checks disagree on and a sample for the audit.
 *
 * Every dollar is written to content-runs/spend.json and each provider stops
 * itself at a cap (--claude-cap, --gemini-cap), so a run can never spend past
 * what is on the account. Google bills afterwards and its budget alerts do
 * not stop anything, which is why this does.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
export const RUNS = path.join(ROOT, 'content-runs')
const LEDGER = path.join(RUNS, 'spend.json')

/* Dollars per million tokens. Batch is half. Gemini's thinking is billed as output. */
const PRICES = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'gemini-3.1-pro-preview': [2, 12],
  'gemini-2.5-pro': [1.25, 10],
}

export function ledger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, 'utf8'))
  } catch {
    return { claude: 0, gemini: 0, history: [] }
  }
}

function record(provider, dollars, note) {
  fs.mkdirSync(RUNS, { recursive: true })
  const l = ledger()
  l[provider] = Math.round((l[provider] + dollars) * 1e6) / 1e6
  l.history.push({ at: new Date().toISOString(), provider, dollars: Math.round(dollars * 1e6) / 1e6, note })
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2))
}

export class OverBudget extends Error {}

function guard(provider, cap) {
  const spent = ledger()[provider]
  if (spent >= cap) throw new OverBudget(`${provider} has spent $${spent.toFixed(2)} of its $${cap} cap. Raise --${provider}-cap to go on.`)
}

function claudeCost(model, usage, batch) {
  const [pi, po] = PRICES[model] || [2, 10]
  const input =
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) * 1.25 +
    (usage.cache_read_input_tokens || 0) * 0.1
  return ((input * pi + (usage.output_tokens || 0) * po) / 1e6) * (batch ? 0.5 : 1)
}

/* ---------------------------------------------------------------- Claude --- */

let client
async function anthropic() {
  if (client) return client
  const require = createRequire(path.join(ROOT, 'package.json'))
  const { default: Anthropic } = await import(pathToFileURL(require.resolve('@anthropic-ai/sdk')).href)
  client = new Anthropic()
  return client
}

/** One request's params: cached system blocks, the user turn, structured output. */
export function claudeParams({ model, effort, system, user, schema, maxTokens = 32000 }) {
  return {
    model,
    max_tokens: maxTokens,
    system: system.map((text, i) => ({
      type: 'text',
      text,
      ...(i === system.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
    })),
    messages: [{ role: 'user', content: user }],
    output_config: { ...(effort ? { effort } : {}), format: { type: 'json_schema', schema } },
  }
}

function parse(message) {
  if (message.stop_reason === 'refusal') throw new Error('declined')
  if (message.stop_reason === 'max_tokens') throw new Error('ran out of tokens')
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return JSON.parse(text)
}

/**
 * Run requests [{custom_id, params}] and return {custom_id: {data} | {error}}.
 * Resumes a batch already submitted when given its id.
 */
export async function runClaude(requests, { direct = false, cap = 60, note = '', batchId, onSubmit, log = console.log } = {}) {
  guard('claude', cap)
  const api = await anthropic()
  const out = {}
  let dollars = 0

  if (direct) {
    const queue = [...requests]
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          try {
            const message = await api.messages.stream(r.params).finalMessage()
            const cost = claudeCost(r.params.model, message.usage, false)
            dollars += cost
            out[r.custom_id] = { cost, data: parse(message) }
          } catch (e) {
            out[r.custom_id] = { error: e.message }
          }
        }
      })
    )
  } else {
    let id = batchId
    if (!id) {
      // meta is ours, not the API's.
      const batch = await api.messages.batches.create({ requests: requests.map(({ custom_id, params }) => ({ custom_id, params })) })
      id = batch.id
      onSubmit?.(id)
      log(`  submitted batch ${id} (${requests.length} requests)`)
    }
    for (;;) {
      const b = await api.messages.batches.retrieve(id)
      if (b.processing_status === 'ended') break
      log(`  ${b.request_counts.processing} still processing, ${b.request_counts.succeeded} done`)
      await new Promise((r) => setTimeout(r, 30000))
    }
    for await (const result of await api.messages.batches.results(id)) {
      const r = result.result
      if (r.type !== 'succeeded') {
        out[result.custom_id] = { error: r.type === 'errored' ? r.error?.error?.message || r.error?.type || 'errored' : r.type }
        continue
      }
      dollars += claudeCost(r.message.model, r.message.usage, true)
      try {
        out[result.custom_id] = { data: parse(r.message) }
      } catch (e) {
        out[result.custom_id] = { error: e.message }
      }
    }
  }
  record('claude', dollars, note)
  log(`  claude: $${dollars.toFixed(3)} (${note})`)
  return out
}

/* ---------------------------------------------------------------- Gemini --- */

export const GEMINI_MODEL = 'gemini-3.1-pro-preview'

/** One Gemini Pro call: parts (text and inline images), a JSON schema, a parsed answer. */
export async function askGemini(parts, schema, { cap = 25, note = '' } = {}) {
  guard('gemini', cap)
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 32000 },
      }),
    })
    if ((res.status === 429 || res.status >= 500) && attempt <= 5) {
      await new Promise((r) => setTimeout(r, 6000 * attempt))
      continue
    }
    const data = await res.json()
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
    const u = data.usageMetadata || {}
    const [pi, po] = PRICES[GEMINI_MODEL]
    record('gemini', ((u.promptTokenCount || 0) * pi + ((u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)) * po) / 1e6, note)
    const text = (data.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought && p.text).map((p) => p.text).join('')
    return JSON.parse(text)
  }
}
