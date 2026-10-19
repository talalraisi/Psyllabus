/**
 * Which model each Syllabi job uses, what it costs, and how a claim is made.
 *
 * Every route that calls a model goes through claim() first and settle()
 * after. The limits themselves live in the database (062-ai-limits.sql),
 * where no client can change them; this file only asks.
 */

export const MODELS = {
  // Everyday questions: the one students use most, so the cheap one.
  tutor: process.env.SYLLABI_TUTOR_MODEL || 'claude-haiku-5-5',
  // Reading drafts and the other written tasks: fewer, longer, worth more care.
  writing: process.env.SYLLABI_MODEL || 'claude-sonnet-5-5',
}

/** Dollars per million tokens. Cache writes are 1.25× input, reads 0.1×. */
const PRICES = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
}

/**
 * What a response cost, in micro-dollars (1,000,000 = $1).
 *
 * An unknown model is priced as the dearest one listed, so a model swapped
 * in by an environment variable can only make the recorded cost too high.
 */
export function costMicro(model, usage = {}) {
  const p = PRICES[model] || { input: 4, output: 20 }
  const input = usage.input_tokens || 0
  const written = usage.cache_creation_input_tokens || 0
  const read = usage.cache_read_input_tokens || 0
  const output = usage.output_tokens || 0
  return Math.ceil(input * p.input + written * p.input * 1.25 + read * p.input * 0.1 + output * p.output)
}

/** What a student is told when a claim is refused. */
const REFUSED = {
  slow_down: { status: 429, error: 'That was a lot at once. Give it a minute.' },
  daily_limit: { status: 429, error: 'That is all for today. Syllabi resets at midnight.' },
  paused: { status: 503, error: 'Syllabi is resting for today. It will be back tomorrow.' },
  signed_out: { status: 401, error: 'Sign in first.' },
  unknown_task: { status: 400, error: 'Unknown task.' },
}

/** Claim one request of this kind, or say why not. */
export async function claim(supabase, task, subject) {
  const { data, error } = await supabase.rpc('claim_ai_request', { p_task: task, p_subject: subject || null })
  if (error || !data) return { ok: false, status: 503, error: 'Syllabi could not start just now. Try again in a minute.' }
  if (!data.ok) return { ok: false, code: data.reason, ...(REFUSED[data.reason] || REFUSED.paused) }
  return { ok: true, id: data.id, remaining: data.remaining }
}

/**
 * Record what the request really cost.
 *
 *   usage    the response's usage: settles at what it actually cost
 *   null     the call failed before the model started: settles at zero
 *   omitted  unknown (a stream cut off part-way): stays at the reservation,
 *            so a dropped connection is never cheaper than it might have been
 */
export async function settle(supabase, id, model, usage) {
  if (!id) return
  await supabase.rpc('finish_ai_request', {
    p_id: id,
    p_input: usage?.input_tokens || 0,
    p_output: usage?.output_tokens || 0,
    p_cost_micro: usage ? costMicro(model, usage) : usage === null ? 0 : null,
  })
}
