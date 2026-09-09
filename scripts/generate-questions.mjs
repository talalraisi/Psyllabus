/**
 * Question bank generation pipeline.
 *
 * For every subtopic of a subject, generates original exam-style MCQs, verifies
 * each batch in an independent second pass, and inserts only the questions that
 * survive verification. Duplicate questions are rejected by the database
 * (unique stem fingerprint from 006-question-dedup.sql), so the bank grows
 * without ever repeating itself.
 *
 * COPYRIGHT: questions are generated fresh in the *style* of exam-board
 * questions. Past papers are never copied or reproduced. Do not change the
 * prompts to request verbatim past-paper content.
 *
 * TWO PROVIDERS:
 *   --provider ollama   free, unlimited, runs locally (default)
 *                       install: https://ollama.com  then: ollama pull qwen2.5:14b
 *   --provider claude   highest quality, costs API credits
 *
 * Requirements (in .env.local):
 *   DATABASE_URL       the same connection string npm run setup-db uses
 *   ANTHROPIC_API_KEY  only when using --provider claude
 *
 * Usage:
 *   node scripts/generate-questions.mjs --subject "Math Analysis & Approaches HL" --per-subtopic 100
 *   node scripts/generate-questions.mjs --subject "Physics SL" --per-subtopic 50 --provider claude
 *   node scripts/generate-questions.mjs --subject "Economics HL" --limit-subtopics 3 --per-subtopic 10
 */

import Anthropic from "@anthropic-ai/sdk";
import { connect } from "./db.mjs";
import { normaliseText, parseNumber, numbersMatch, looseNumericMatch } from "../lib/grading.js";
import { figureIsUsable } from "../lib/figures.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const SUBJECT = arg("subject", "Math Analysis & Approaches HL");
const PER_SUBTOPIC = parseInt(arg("per-subtopic", "100"), 10);
const LIMIT_SUBTOPICS = parseInt(arg("limit-subtopics", "0"), 10); // 0 = all
/**
 * ollama  free, local, one request at a time in practice
 * vllm    an OpenAI-compatible server you rent by the hour, the fast option
 * claude  the accurate option, paid per token
 *
 * vllm exists because Ollama on a laptop is the wrong tool for 300,000
 * questions: it holds one model on one machine and serves roughly one request
 * at a time, so the card sits idle between calls. vLLM on a rented GPU batches
 * dozens of requests into the same forward pass, which is the difference
 * between a question a minute and a few questions a second. It speaks the
 * OpenAI API, so this is the same code path any hosted open-weights provider
 * would use too.
 */
const PROVIDER = arg("provider", "ollama"); // ollama | vllm | claude
const OLLAMA_MODEL = arg("ollama-model", "qwen2.5:14b");
/**
 * One or more Ollama endpoints, comma separated.
 *
 * A second machine does not need this repo, the database password, or Node.
 * It needs Ollama and the model. Point at both and the work is shared between
 * them, with everything that touches the database staying on one machine.
 *
 *   --ollama-url "http://localhost:11434,http://192.168.1.42:11434"
 *
 * That is a better arrangement than running the whole pipeline twice: there is
 * one set of credentials, one progress count, and no way for the two halves to
 * disagree about what has already been generated.
 */
const OLLAMA_URLS = arg("ollama-url", "http://localhost:11434")
  .split(",")
  .map((u) => u.trim().replace(/\/$/, ""))
  .filter(Boolean);
const OLLAMA_URL = OLLAMA_URLS[0];

// Round robin. Requests are long and similar in cost, so taking the next
// endpoint each time keeps both machines busy without needing to measure them.
let endpointCursor = 0;
function nextEndpoint() {
  const url = OLLAMA_URLS[endpointCursor % OLLAMA_URLS.length];
  endpointCursor++;
  return url;
}
const VLLM_URL = arg("vllm-url", process.env.VLLM_URL || "http://localhost:8000/v1");
const VLLM_MODEL = arg("vllm-model", process.env.VLLM_MODEL || "");
const VLLM_KEY = process.env.VLLM_API_KEY || "EMPTY";
// Local models do better with smaller batches; a served model has no such
// problem and larger batches amortise the prompt across more questions.
const BATCH_SIZE = parseInt(arg("batch-size", PROVIDER === "ollama" ? "8" : "20"), 10);
const NUM_CTX = parseInt(arg("num-ctx", "16384"), 10);

/**
 * How many already-written stems to show the model so it does not repeat them.
 *
 * This is the largest part of the prompt and the first thing to cut when the
 * context is tight: forty stems is roughly 1,600 tokens, which on a machine
 * that can only spare a 4k context is most of the budget. Fewer means slightly
 * more repetition, and the unique stem fingerprint rejects the exact repeats
 * anyway, so the cost is small and the alternative is truncating the
 * instructions.
 */
const AVOID_STEMS = parseInt(arg("avoid-stems", NUM_CTX <= 4096 ? "12" : "40"), 10);

/**
 * How many subtopics to work on at once.
 *
 * Default 1, because on a laptop the model is bound by memory bandwidth and
 * running four at once mostly makes each of them four times slower. On a rented
 * GPU behind vLLM the opposite is true: one request at a time leaves the card
 * about 95% idle, and this is the single number that decides whether renting
 * one was worth it. Start at 16 there and watch tokens/sec.
 */
const CONCURRENCY = Math.max(
  1,
  parseInt(arg("concurrency", PROVIDER === "ollama" ? "1" : "16"), 10)
);

// Stop after this many, for pilots. 0 = no limit.
const MAX_QUESTIONS = parseInt(arg("max-questions", "0"), 10);
/**
 * Which Claude model, when using one. Verification is short work: it reads a
 * batch and returns one answer each, so a cheaper model is a real saving over
 * thousands of batches without giving up much of the arithmetic that matters.
 * Generation is where the quality shows.
 */
const MODEL = arg("claude-model", "claude-opus-5");

/**
 * Spend, watched rather than discovered.
 *
 * A generation run is thousands of calls made while nobody is looking, which
 * is exactly the shape of job that produces a bill you did not expect. So the
 * tokens are counted as they go, converted at the rate for the model in use,
 * printed with every subtopic, and --budget stops the run dead when it reaches
 * a number you set. Stopping early costs a night. Not stopping costs money you
 * did not agree to spend.
 *
 * Prices are dollars per million tokens and are checked at
 * https://claude.com/pricing — they change, and a number hardcoded here is a
 * number that will eventually be wrong. Everything printed is an estimate; the
 * console is the authority.
 */
const PRICES = {
  "claude-opus-5": { input: 15, output: 75 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const BUDGET = parseFloat(arg("budget", "0")); // dollars, 0 = no limit

/**
 * A rented GPU is billed by the hour, not by the token, so the meter is a
 * clock. Pass what you are paying and the run prices itself the same way a
 * paid API run does, which is the only way to compare the two honestly.
 */
const GPU_COST_PER_HOUR = parseFloat(arg("gpu-cost", "0"));
const RUN_STARTED = Date.now();
const spend = { input: 0, output: 0, calls: 0 };

function priceOf(model) {
  return PRICES[model] || PRICES["claude-sonnet-5"];
}

function elapsedHours() {
  return (Date.now() - RUN_STARTED) / 3600000;
}

function dollars() {
  if (GPU_COST_PER_HOUR > 0) return elapsedHours() * GPU_COST_PER_HOUR;
  if (PROVIDER !== "claude" && VERIFY_PROVIDER !== "claude") return 0;
  const p = priceOf(MODEL);
  return (spend.input / 1e6) * p.input + (spend.output / 1e6) * p.output;
}

/**
 * Output tokens per second across every concurrent request. This is the single
 * number that says whether a rented card is being used or idling: raise
 * --concurrency until it stops climbing, and that is the setting.
 */
function tokensPerSecond() {
  const seconds = (Date.now() - RUN_STARTED) / 1000;
  return seconds > 0 ? spend.output / seconds : 0;
}

function budgetCheck() {
  if (BUDGET > 0 && dollars() >= BUDGET) {
    console.log(
      `\nBudget of $${BUDGET.toFixed(2)} reached after ${spend.calls} calls. Stopping.\n` +
        `Re-run the same command to carry on from here: nothing is lost.`
    );
    return true;
  }
  return false;
}

// mcq | short_answer | mixed. Mixed alternates, so a subtopic ends up with both
// rather than one type followed by the other.
const TYPE = arg("type", "mixed");

/**
 * How many times each question is independently solved during verification.
 * Two is the useful minimum: one solve can only be compared to the answer the
 * generator wrote, and a model that got it wrong once will often get it wrong
 * the same way twice in a row when it is anchored. Three is stricter and
 * roughly half again as slow.
 */
const VERIFY_PASSES = Math.max(1, parseInt(arg("verify-passes", "2"), 10));

/**
 * Verification can use a different model from generation, and usually should.
 *
 * Writing a plausible exam question is easy; getting the arithmetic right is
 * not, and a local 14B model fails physics questions it can happily write. But
 * generation is the expensive half in tokens and the cheap half in
 * consequences: a badly written question gets thrown away, while a badly
 * verified one gets taught to a student. So generate free and locally, verify
 * with something that can actually do the work.
 *
 *   --provider ollama --verify-provider claude
 */
const VERIFY_PROVIDER = arg("verify-provider", PROVIDER);

/**
 * Split the subtopics between machines: --shard 1/2 on one, --shard 2/2 on the
 * other. Without this, two machines pointed at the same subject both start at
 * subtopic one and race each other through the identical list. Nothing breaks,
 * because the unique stem fingerprint throws the duplicates away, but the
 * second machine spends the night generating questions the first one already
 * has, which is the same as not having a second machine.
 *
 * The split is by position in the ordered subtopic list rather than by subject,
 * so both machines finish at roughly the same time even when one subject has
 * four times the subtopics of another.
 */
const SHARD = (() => {
  const raw = arg("shard", null);
  if (!raw) return null;
  const [index, total] = raw.split("/").map((n) => parseInt(n, 10));
  if (!index || !total || index < 1 || index > total) {
    console.error(`--shard must look like 1/2 or 2/3. Got "${raw}".`);
    process.exit(1);
  }
  return { index, total };
})();

// Looked up from the syllabus rather than assumed, now that AP and A-Level are
// in the same table. Subject names do not collide across curricula.
let CURRICULUM = "IB";

// Only constructed when actually using Claude, so Ollama runs need no API key.
const anthropic = PROVIDER === "claude" || VERIFY_PROVIDER === "claude" ? new Anthropic() : null;
let db;

// ---------------------------------------------------------------------------
// Schemas for structured outputs
// ---------------------------------------------------------------------------

/**
 * A figure, described as data rather than drawn. The app renders these, so the
 * model never writes SVG: an SVG it produces looks fine in the response and
 * renders as a tangle, and nobody finds out until a student is looking at it.
 * Four kinds, which between them cover most of what an exam actually shows.
 */
const FIGURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "alt"],
  properties: {
    kind: { type: "string", enum: ["none", "plot", "scatter", "bar", "table"] },
    alt: { type: "string", description: "What the figure shows, for a screen reader." },
    caption: { type: "string" },
    x_label: { type: "string" },
    y_label: { type: "string" },
    points: {
      type: "array",
      description: "For plot and scatter. At least 2 points, in x order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["x", "y"],
        properties: { x: { type: "number" }, y: { type: "number" } },
      },
    },
    bars: {
      type: "array",
      description: "For bar. At least 2.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value"],
        properties: { label: { type: "string" }, value: { type: "number" } },
      },
    },
    columns: { type: "array", items: { type: "string" }, description: "For table." },
    rows: {
      type: "array",
      description: "For table. Each row has one cell per column.",
      items: { type: "array", items: { type: "string" } },
    },
  },
};

const STIMULUS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "text"],
  properties: {
    kind: { type: "string", enum: ["prose", "poem", "dialogue", "nonfiction"] },
    text: {
      type: "string",
      description:
        "An ORIGINAL extract of 60 to 140 words, written for this question. Never copied or adapted from any published work. Rich enough that several questions can be asked about its technique and effect.",
    },
  },
};

const HINT_DESCRIPTION_TEXT =
  "One sentence pointing at where in the extract to look. Never the answer.";

const TEXT_MCQ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stimulus", "questions"],
  properties: {
    stimulus: STIMULUS_SCHEMA,
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stem", "options", "correct_answer", "explanation", "hint", "marks", "time_budget_seconds", "difficulty"],
        properties: {
          stem: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "text", "why_wrong"],
              properties: {
                id: { type: "string", enum: ["a", "b", "c", "d"] },
                text: { type: "string" },
                why_wrong: { type: "string" },
              },
            },
          },
          correct_answer: { type: "string", enum: ["a", "b", "c", "d"] },
          explanation: { type: "string" },
          hint: { type: "string", description: HINT_DESCRIPTION_TEXT },
          marks: { type: "integer", enum: [1, 2, 3] },
          time_budget_seconds: { type: "integer", enum: [30, 45, 60, 75, 90, 120, 150, 180] },
          difficulty: { type: "number" },
        },
      },
    },
  },
};

const TEXT_SHORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stimulus", "questions"],
  properties: {
    stimulus: STIMULUS_SCHEMA,
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stem", "accepted_answers", "explanation", "hint", "marks", "time_budget_seconds", "difficulty"],
        properties: {
          stem: { type: "string" },
          accepted_answers: { type: "array", items: { type: "string" }, minItems: 1 },
          explanation: { type: "string" },
          hint: { type: "string", description: HINT_DESCRIPTION_TEXT },
          marks: { type: "integer", enum: [1, 2, 3] },
          time_budget_seconds: { type: "integer", enum: [30, 45, 60, 75, 90, 120, 150, 180] },
          difficulty: { type: "number" },
        },
      },
    },
  },
};

const HINT_DESCRIPTION =
  "One sentence pointing at the method or the first step. It must not contain the answer, or a number that gives it away.";

const SHORT_ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "stem",
          "accepted_answers",
          "answer_kind",
          "explanation",
          "marks",
          "time_budget_seconds",
          "difficulty",
          "hint",
        ],
        properties: {
          stem: {
            type: "string",
            description:
              "The question. It must have exactly one correct answer that is a number or a single short term. Plain text, ^ for powers, / for division.",
          },
          accepted_answers: {
            type: "array",
            description:
              "Every form of the answer that should be marked correct: 0.5 and 1/2, or mitochondrion and mitochondria. First one is the canonical form.",
            items: { type: "string" },
            minItems: 1,
          },
          answer_kind: {
            type: "string",
            enum: ["numeric", "text"],
            description: "numeric when the answer is a number, text when it is a term or short phrase.",
          },
          answer_hint: {
            type: "string",
            description: "What form the answer should take, e.g. 'to 3 significant figures' or 'in m/s'. Optional.",
          },
          explanation: { type: "string", description: "One or two sentences of working." },
          hint: { type: "string", description: HINT_DESCRIPTION },
          figure: FIGURE_SCHEMA,
          marks: { type: "integer", enum: [1, 2, 3] },
          time_budget_seconds: { type: "integer", enum: [30, 45, 60, 75, 90, 120, 150, 180] },
          difficulty: { type: "number", description: "0.1 easy to 0.9 hard." },
        },
      },
    },
  },
};

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "stem",
          "options",
          "correct_answer",
          "explanation",
          "hint",
          "marks",
          "time_budget_seconds",
          "difficulty",
        ],
        properties: {
          stem: { type: "string", description: "The question text. Plain text, no LaTeX; use ^ for powers and / for division." },
          options: {
            type: "array",
            description: "Exactly 4 answer options with ids a, b, c, d.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "text", "why_wrong"],
              properties: {
                id: { type: "string", enum: ["a", "b", "c", "d"] },
                text: { type: "string" },
                why_wrong: {
                  type: "string",
                  description:
                    "For a wrong option: the specific mistake that leads a student here, in one sentence, e.g. 'forgot to convert grams to kilograms'. For the correct option: an empty string.",
                },
              },
            },
          },
          correct_answer: { type: "string", enum: ["a", "b", "c", "d"] },
          explanation: { type: "string", description: "One or two sentences showing why the correct answer is right." },
          hint: { type: "string", description: HINT_DESCRIPTION },
          figure: FIGURE_SCHEMA,
          marks: { type: "integer", enum: [1, 2, 3] },
          time_budget_seconds: { type: "integer", enum: [30, 45, 60, 75, 90, 120, 150, 180] },
          difficulty: { type: "number", description: "0.1 (easy) to 0.9 (hard)" },
        },
      },
    },
  },
};

const SOLUTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["solutions"],
  properties: {
    solutions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "answer", "confident"],
        properties: {
          index: { type: "integer" },
          answer: {
            type: "string",
            description:
              "For multiple choice, the single letter a, b, c or d. For short answer, the value alone: a number with its unit, or a single term. No working, no sentence.",
          },
          all_true_options: {
            type: "array",
            description:
              "Multiple choice only: EVERY option that is a true statement or a correct answer, not just the best one. Usually one letter. More than one means the question has no single answer.",
            items: { type: "string" },
          },
          confident: {
            type: "boolean",
            description:
              "false if the question is ambiguous, unanswerable, or has more than one defensible answer",
          },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Claude calls
// ---------------------------------------------------------------------------

async function callClaude(prompt, schema, maxTokens = 16000, temperature) {
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    ...(temperature != null ? { temperature } : {}),
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.usage) {
    spend.input += response.usage.input_tokens || 0;
    spend.output += response.usage.output_tokens || 0;
    spend.calls++;
  }
  if (response.stop_reason === "refusal") {
    throw new Error("Request was declined by safety classifiers");
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty response");
  return JSON.parse(text);
}

/**
 * An OpenAI-compatible server: vLLM, SGLang, or a hosted open-weights provider.
 *
 * Schema-constrained decoding is requested through response_format, which vLLM
 * implements with guided decoding, so the output is valid against the schema
 * by construction rather than by asking nicely and hoping. Without it a 70B
 * model returns prose around the JSON often enough to matter across thousands
 * of calls.
 */
async function callOpenAICompatible(prompt, schema, temperature) {
  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${VLLM_KEY}`,
    },
    body: JSON.stringify({
      model: VLLM_MODEL,
      temperature: temperature ?? 0.8,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "output", schema, strict: true },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`vLLM ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from the server");

  // Track tokens here too: a rented box is billed by the hour rather than by
  // the token, but tokens per second is the number that tells you whether you
  // are getting your money's worth out of it.
  if (data.usage) {
    spend.input += data.usage.prompt_tokens || 0;
    spend.output += data.usage.completion_tokens || 0;
    spend.calls++;
  }
  return JSON.parse(content);
}

/** Free local generation via Ollama's JSON-schema-constrained output. */
async function callOllama(prompt, schema, temperature) {
  const endpoint = nextEndpoint();
  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: schema, // Ollama constrains output to this JSON schema
      // Ollama defaults num_ctx to 4096. A generation prompt is ~3.6k tokens
      // and the reply is another ~6.6k, so the default silently truncates the
      // oldest part of the context: the instructions. That does not error, it
      // just quietly produces worse questions, which is the worst way for a
      // setting to be wrong.
      options: { temperature: temperature ?? 0.8, num_ctx: NUM_CTX },
      // Thinking models spend the whole budget reasoning before they emit any
      // JSON, and with schema-constrained output that reads as a hang. The
      // verification here does its own double-solve, so the trace buys nothing.
      think: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new Error(
        `Model "${OLLAMA_MODEL}" not found. Run: ollama pull ${OLLAMA_MODEL}`
      );
    }
    throw new Error(`Ollama ${res.status} at ${endpoint}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.message?.content;
  if (!content) throw new Error("Empty response from Ollama");
  return JSON.parse(content);
}

async function callModel(prompt, schema, maxTokens, temperature, provider = PROVIDER) {
  if (provider === "claude") return callClaude(prompt, schema, maxTokens, temperature);
  if (provider === "vllm") return callOpenAICompatible(prompt, schema, temperature);
  return callOllama(prompt, schema, temperature);
}

async function preflight() {
  if (PROVIDER === "claude" || VERIFY_PROVIDER === "claude") {
    // Failing here, before anything is generated, beats failing on the first
    // call at 2am with a stack trace and a night already lost.
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        `No ANTHROPIC_API_KEY found.\n\n` +
          `  1. console.anthropic.com -> Billing -> add credits (API credits are\n` +
          `     separate from a Claude.ai subscription; a Pro plan does not include them)\n` +
          `  2. API keys -> Create key\n` +
          `  3. Put it in .env.local as ANTHROPIC_API_KEY=sk-ant-...\n\n` +
          `Or generate without paying: --provider ollama`
      );
      process.exit(1);
    }
    if (PROVIDER === "claude") return;
  }

  if (PROVIDER === "vllm" || VERIFY_PROVIDER === "vllm") {
    if (!VLLM_MODEL) {
      console.error("--vllm-model is required, e.g. --vllm-model Qwen/Qwen2.5-72B-Instruct");
      process.exit(1);
    }
    try {
      const res = await fetch(`${VLLM_URL}/models`, {
        headers: { authorization: `Bearer ${VLLM_KEY}` },
      });
      const { data } = await res.json();
      const served = (data || []).map((m) => m.id);
      if (served.length && !served.includes(VLLM_MODEL)) {
        console.error(
          `The server at ${VLLM_URL} is serving ${served.join(", ")}, not "${VLLM_MODEL}".`
        );
        process.exit(1);
      }
      console.log(`Server: ${VLLM_MODEL} at ${VLLM_URL}`);
    } catch {
      console.error(
        `Cannot reach an OpenAI-compatible server at ${VLLM_URL}.\n` +
          `Start one on the rented box, then tunnel or expose it:\n` +
          `  vllm serve ${VLLM_MODEL} --port 8000 --max-model-len 8192`
      );
      process.exit(1);
    }
    if (PROVIDER === "vllm") return;
  }

  // Every endpoint is checked, because one machine quietly missing the model
  // means half the night's requests fail and the other half carry the load.
  for (const url of OLLAMA_URLS) {
    try {
      const res = await fetch(`${url}/api/tags`);
      const { models } = await res.json();
      const names = (models || []).map((m) => m.name);
      if (!names.some((n) => n === OLLAMA_MODEL || n.startsWith(`${OLLAMA_MODEL}:`))) {
        console.error(
          `${url} is running but "${OLLAMA_MODEL}" is not installed there.\n` +
            `Installed: ${names.join(", ") || "(none)"}\n` +
            `Fix, on that machine: ollama pull ${OLLAMA_MODEL}`
        );
        process.exit(1);
      }
    } catch {
      console.error(
        `Cannot reach Ollama at ${url}.\n` +
          (url.includes("localhost")
            ? `1. Install it from https://ollama.com\n` +
              `2. ollama pull ${OLLAMA_MODEL}\n` +
              `3. Re-run (Ollama serves automatically once installed).`
            : `On that machine: set OLLAMA_HOST=0.0.0.0 so it listens on the network,\n` +
              `restart Ollama, and check the firewall allows port 11434.`)
      );
      process.exit(1);
    }
  }
  if (OLLAMA_URLS.length > 1) {
    console.log(`Sharing work across ${OLLAMA_URLS.length} machines.`);
  }
}

/**
 * The angles a question can come at a subtopic from.
 *
 * Asking for "20 more questions" produced twenty versions of the same one: the
 * bank came out at 86 distinct shapes across 98 questions. Naming the angle
 * forces a different question rather than the same question with new numbers,
 * which is what actually adds coverage.
 */
const ANGLES = [
  "state or define the key idea precisely",
  "apply it to a routine case with given values",
  "work backwards from a result to a missing input",
  "combine it with something from an earlier topic",
  "interpret a described graph, diagram or data set",
  "spot and correct a common student error in a worked attempt",
  "decide which method or formula applies and why",
  "apply it to an unfamiliar real-world context",
  "compare two cases and explain the difference",
  "handle an edge case, limit or special value",
];

function anglesFor(round, count) {
  // Rotate so a long run works through every angle rather than the first few.
  const start = (round * count) % ANGLES.length;
  return Array.from({ length: Math.min(count, ANGLES.length) }, (_, i) => ANGLES[(start + i) % ANGLES.length]);
}

/**
 * A figure the app cannot draw is worse than no figure: it renders as an empty
 * box under a stem that refers to it. So it is checked here, with the same
 * function the renderer uses, and dropped when it does not hold up.
 */
/**
 * The spread of difficulties a batch must contain.
 *
 * Models do not self-assess difficulty. Asked for "a mix", qwen returned 0.90
 * for every question in Economics, Physics and Computer Science, and 43 of 51
 * in English: a bank where everything is Burning, which is the same as a bank
 * with no difficulty information at all. So the difficulty is decided here and
 * the model is told which one to write, one question at a time.
 *
 * The model's own number is still read, but only as a nudge within the band it
 * was asked for. It can say a question came out slightly harder than requested;
 * it cannot say everything is the hardest thing in the syllabus.
 */
const DIFFICULTY_PLAN = [0.2, 0.3, 0.45, 0.55, 0.7, 0.85];

/**
 * Subjects assessed on reading rather than on calculation.
 *
 * These get a different generator entirely, not a warning bolted onto the
 * usual one. Telling a model "no arithmetic" while asking it for exam
 * questions about genre conventions produced questions about what percentage
 * of a plot the build-up occupies, because the shape it was asked for wanted a
 * number and the subject had none to give.
 */
const IS_TEXT_SUBJECT =
  /Literature|Language|Philosophy|Theatre|Film|Visual Arts|Music|Religions|Anthropology/i.test(
    SUBJECT
  );

function plannedDifficulties(count, round) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(DIFFICULTY_PLAN[(i + round) % DIFFICULTY_PLAN.length]);
  }
  return out;
}

/** Keep the model's opinion, but inside the band it was asked to write. */
function settleDifficulty(requested, reported) {
  const r = typeof reported === "number" ? reported : requested;
  return Math.min(0.9, Math.max(0.1, Math.min(requested + 0.1, Math.max(requested - 0.1, r))));
}

/**
 * A stem that refers to a figure, with no figure, is unanswerable. It happens
 * because an unusable figure is dropped after the stem has already been written
 * around it, and the student is then asked to read a chart that was never
 * there. Cheaper to throw the question away than to explain it.
 */
const MENTIONS_FIGURE =
  /\b(bar chart|pie chart|line graph|scatter|the graph|the chart|the table|the diagram|the figure|shown below|following (?:graph|chart|table|diagram|figure)|attached)\b/i;

function referencesMissingFigure(q) {
  return !q.figure && MENTIONS_FIGURE.test(q.stem || "");
}

function cleanFigure(figure) {
  if (!figure || figure.kind === "none") return null;
  return figureIsUsable(figure) ? figure : null;
}

/**
 * Literature and language questions, built the way the subject is examined.
 *
 * Paper 1 is guided analysis of an unseen text, so the question carries the
 * text. One original extract per batch, several questions about it, exactly as
 * a real paper works.
 *
 * This is not a stricter prompt bolted onto the general generator; it is a
 * different shape, because the general shape was the problem. Asked for exam
 * questions on genre conventions with the numbers taken away, the model wrote
 * about what percentage of a plot the build-up occupies. Asked to make them
 * hard, it wrote about Beloved and The Great Gatsby — unanswerable for a
 * student whose school teaches neither, and IB English A has no set text list,
 * so most students study neither.
 *
 * An original extract fixes all of it at once. Any student can answer it
 * whatever their school teaches, it tests analysis rather than whether they
 * read the right novel, and nothing published is reproduced, so the bank stays
 * clear of copyright.
 */
/**
 * Is this question actually about the extract it was written for?
 *
 * The model writes the extract, then writes questions from memory rather than
 * from the thing in front of it. Given a piece of dialogue it produced
 * questions about "the second stanza" and quoted the words 'darkness',
 * 'blanket' and 'heavy', none of which appear anywhere in it. Those are not
 * hard questions; they are questions about a poem that does not exist.
 *
 * Prompting did not fix this and is not the right tool. Whether a quoted
 * phrase occurs in the extract is a fact, so it is checked as one.
 */
function groundedInExtract(q, stimulus, kind) {
  const hay = normaliseForMatch(stimulus);

  // Structural vocabulary that only means something in verse.
  if (kind !== "poem" && /\b(stanza|verse|line break|rhyme scheme|refrain)\b/i.test(q.stem)) {
    return { ok: false, why: `refers to ${kind === "dialogue" ? "stanzas in an exchange" : "stanzas in prose"}` };
  }

  // Every phrase the question puts in quotes has to be in the extract.
  const text = [q.stem, ...(q.options || []).map((o) => o.text)].join(" ");
  // An opening quote has to follow a space or a bracket, and a closing one has
  // to be followed by space or punctuation. Without that, the apostrophe in
  // "the writer's choice" reads as a quotation and every question is rejected
  // for quoting something it never quoted.
  const quoted = [
    ...text.matchAll(/(?:^|[\s(\[])["“]([^"”]{6,120})["”](?=[\s).,;:?!\]]|$)/g),
    ...text.matchAll(/(?:^|[\s(\[])['‘]([^'’]{6,120})['’](?=[\s).,;:?!\]]|$)/g),
  ].map((m) => m[1]);
  for (const phrase of quoted) {
    const needle = normaliseForMatch(phrase);
    if (needle.length < 6) continue;
    if (!hay.includes(needle)) {
      return { ok: false, why: `quotes "${phrase.slice(0, 40)}" which is not in the extract` };
    }
  }

  return { ok: true };
}

/** Loose enough to survive smart quotes and ellipses, strict enough to mean something. */
function normaliseForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.…]+/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateTextBatch(subtopic, topic, count, existingStems, { round = 0, type = "mcq" }) {
  const plan = plannedDifficulties(count, round);
  const avoid =
    existingStems.length > 0
      ? `\n\nAlready asked, so do not repeat these:\n${existingStems
          .slice(-AVOID_STEMS)
          .map((x) => `- ${x}`)
          .join("\n")}`
      : "";

  const forms = ["prose", "poem", "dialogue", "nonfiction"];
  const form = forms[round % forms.length];

  const shared = `You are writing ${CURRICULUM} exam questions for "${SUBJECT}", ${topic}, subtopic "${subtopic}".

FIRST write one ORIGINAL extract, ${form}, 60 to 140 words, that a question about "${subtopic}" can genuinely be asked about. Write it yourself. Do not copy, adapt, or paraphrase any published work, and do not use a real author's characters or lines.

THEN write ${count} questions about THAT EXTRACT.

Rules that decide whether these are usable at all:
- Every question must be answerable by someone who has read only the extract. This is an unseen-text paper.
- NEVER name a novel, play, poem or author as the thing being asked about. A student whose school studies different works cannot answer it, and there is no set text list.
- NO arithmetic. No percentages, word counts, reading speeds, page numbers, durations. If a question has a number in it, it is the wrong question for this subject.
- Do not invent an error for a student to spot. A question claiming a correct statement is wrong has no answer.
- Ask about what the writer does and what it achieves: diction, imagery, structure, voice, tone, form, the effect on a reader.
- Quote the exact words from the extract that a question turns on, so the student knows where to look.

Difficulties, in order:
${plan.map((d, i) => `${i + 1}. ${d <= 0.3 ? "straightforward: name a technique the extract clearly uses" : d <= 0.55 ? "moderate: link a technique to its effect" : d <= 0.7 ? "hard: compare two choices the writer makes, or read tone against content" : "very hard: an interpretation that has to be argued from precise detail"} (difficulty ${d})`).join("\n")}

Every question carries a hint: one sentence pointing at where in the extract to look, never the answer.${avoid}`;

  if (type === "short_answer") {
    const prompt = `${shared}

Write them as SHORT ANSWER questions marked by exact comparison, so the answer must be ONE technical term a student would type identically every time: "metaphor", "enjambment", "sibilance", "first person", "iambic pentameter".

Never ask "why", "how" or "what effect" as a short answer: those need a sentence and cannot be marked here. Ask "which technique", "what is the form", "name the device".
Put every spelling that should pass in accepted_answers, e.g. ["personification"], ["enjambment", "enjambement"].`;

    const data = await callModel(prompt, TEXT_SHORT_SCHEMA);
    const stim = data.stimulus;
    if (!stim?.text) return [];
    return (data.questions || [])
      .filter((q) => q.stem && q.accepted_answers?.length)
      .map((q, i) => ({
        ...q,
        question_type: "short_answer",
        answer_kind: "text",
        stimulus: stim.text,
        stimulus_kind: stim.kind,
        figure: null,
        difficulty: settleDifficulty(plan[i] ?? 0.5, q.difficulty),
      }))
      .filter((q) => {
        const g = groundedInExtract(q, stim.text, stim.kind);
        if (!g.ok) console.log(`    dropped: ${g.why}`);
        return g.ok;
      });
  }

  const prompt = `${shared}

Write them as multiple choice, 4 options with ids a to d.
- Exactly one option is true of this extract. The other three must be false of it, not merely less good: an option that is also true makes the question unanswerable.
- Distractors should be techniques or readings a student might plausibly claim about this extract and be wrong about.
- Spread the correct option across a, b, c and d.
- Every wrong option carries why_wrong: the misreading that leads there, in one sentence.`;

  const data = await callModel(prompt, TEXT_MCQ_SCHEMA);
  const stim = data.stimulus;
  if (!stim?.text) return [];
  return (data.questions || [])
    .filter((q) => q.options?.length === 4 && q.options.some((o) => o.id === q.correct_answer))
    .map((q, i) => ({
      ...q,
      question_type: "mcq",
      stimulus: stim.text,
      stimulus_kind: stim.kind,
      figure: null,
      difficulty: settleDifficulty(plan[i] ?? 0.5, q.difficulty),
    }))
    .filter((q) => {
      const g = groundedInExtract(q, stim.text, stim.kind);
      if (!g.ok) console.log(`    dropped: ${g.why}`);
      return g.ok;
    });
}

async function generateBatch(subtopic, topic, count, existingStems, { round = 0, type = "mcq" } = {}) {
  const avoid =
    existingStems.length > 0
      ? `\n\nAlready written, so do not repeat these or reword them:\n${existingStems
          .slice(-AVOID_STEMS)
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "";

  const angles = anglesFor(round, count)
    .map((a, i) => `${i + 1}. ${a}`)
    .join("\n");

  const isTextSubject = IS_TEXT_SUBJECT;
  const plan = plannedDifficulties(count, round);
  const planned = plan
    .map((d, i) => `${i + 1}. ${d <= 0.3 ? "easy, one step" : d <= 0.55 ? "medium, two steps" : d <= 0.7 ? "hard, multi-step" : "very hard, exam-standard and combining ideas"} (difficulty ${d})`)
    .join("\n");


  if (isTextSubject) return generateTextBatch(subtopic, topic, count, existingStems, { round, type });

  const shared = `You are writing exam questions for the ${CURRICULUM} subject "${SUBJECT}", ${topic}, subtopic "${subtopic}".

Write them at these difficulties, in this order:
${planned}

Use the difficulty you were given for each question. Do not mark everything hard.${numericRule}

Each question must come at the subtopic from a DIFFERENT angle. Use these, in order:
${angles}

Requirements:
- Mix of difficulties: about 30% easy (recall or one step), 45% medium (two steps), 25% hard (multi-step, exam standard).
- marks: 1 for one step, 2 for two steps, 3 for multi-step. time_budget_seconds: roughly 45s per mark.
- Plain text maths only (x^2, 3/4, sqrt(x)); never LaTeX.
- Work the problem out before writing the answer, and make the explanation show the key step.
- Vary the surface: different quantities, contexts and phrasings, not the same sentence with new numbers.

GIVE EXACTLY THE DATA NEEDED AND NO MORE. This is the rule that breaks most
often and it ruins the question every time. If orbital radius and g are enough,
do not also state the mass of the Earth: three quantities where two suffice will
not agree with each other, and then two students using two correct methods get
two different answers and both are right. Before writing the numbers, check that
every quantity you state is either needed or consistent with the others.

THE ANSWER IS WHAT YOUR NUMBERS PRODUCE, not what the textbook says. If the
figures you invented give Earth a mass of 5.82 x 10^24 kg, the answer is
5.82 x 10^24, not 5.97 x 10^24. Never state a remembered constant as the answer
to a question whose own data implies something else. If the two differ, the
question is wrong: change the given numbers until they agree.

DO NOT ASK ABOUT A MISTAKE THAT IS NOT THERE. "What is wrong with this
expression" is only a question when the expression is actually wrong. v =
sqrt(GM/r) is correct, and asking what it is missing has no answer.

Every question also carries a hint: one sentence pointing at the method or the
first step, never containing the answer or a number that gives it away. "Start
from F = ma" is a hint. "Divide 40 by 8" is the answer.

FIGURES. Most questions need none: set kind to "none" and move on. Add one only
when the question genuinely cannot be asked without it, and only as data, never
as a description of a picture:
- "plot" for a relationship or function, as points in x order
- "scatter" for measured data, with fit_line only if the question is about it
- "bar" for categories against values
- "table" for a data-based question where the numbers are the point
The stem must then refer to it ("the graph shows...", "using the table..."), and
alt must say what it shows for a student using a screen reader. A figure that
merely decorates a question is worse than none, because it implies something is
there to read.${avoid}`;

  if (type === "short_answer") {
    const prompt = `${shared}

Write ${count} SHORT ANSWER questions. The student types their answer into a box and
a computer marks it by comparing what they typed, so the answer has to be something
a person would write identically every time.

HARD RULES. A question breaking any of these is useless and must not be written:
- NEVER ask "why", "explain", "describe", "compare", "discuss", or "which formula
  would you use". Those need a sentence, and a sentence cannot be marked here.
- NEVER expect an algebraic expression as the answer. "sqrt(rg)" and "(v^2)/r" are
  not things a student would type character for character.
- If the question gives numbers, the answer MUST be the worked-out number. Do the
  arithmetic yourself and put the result in accepted_answers.
- ONE value or ONE term. Not two things, and never a value plus a reason.

For every question:
- answer_kind is "numeric" when the answer is a number, even with a unit attached.
  "85 min" is numeric, not text. Use "text" only for a named thing: a term, a law,
  a scientist, an organelle.
- For numeric, put the bare number FIRST in accepted_answers, then other forms worth
  taking: ["84.8", "85", "84.8 min"]. Units are stripped before comparison, so the
  plain number must be in there.
- Put any required rounding or unit in answer_hint, e.g. "to 3 significant figures".
- For text, list the spellings that should pass: ["mitochondrion", "mitochondria"].

Good: "A car travels at 20 m/s around a track of radius 50 m. Calculate its
centripetal acceleration." -> accepted_answers ["8", "8.0"], numeric, hint "in m/s^2".

Bad: "Which formula would you use and why?" -> needs a sentence.
Bad: "What is the minimum speed?" answered "sqrt(rg)" -> the numbers were given, so
the answer is a number.`;

    const data = await callModel(prompt, SHORT_ANSWER_SCHEMA);
    return (data.questions || [])
      .filter((q) => q.stem && q.accepted_answers?.length)
      .map((q, i) => ({
        ...q,
        question_type: "short_answer",
        figure: cleanFigure(q.figure),
        difficulty: settleDifficulty(plan[i] ?? 0.5, q.difficulty),
      }))
      .filter((q) => !referencesMissingFigure(q));
  }

  const prompt = `${shared}

Write ${count} multiple-choice questions.
- Exactly 4 options (ids a-d), with distractors that are the answers a student would reach by making a specific, common mistake.
- Exactly one option is correct.
- Spread the correct option across a, b, c and d roughly evenly. Do not favour any letter.

EXACTLY ONE OPTION MAY BE TRUE. Not "one is best" — the other three must be
statements that are actually false. This fails most often on questions that list
formulas: if the options are g = GM/r^2, v = sqrt(gr), v = 2*pi*r/T and g = v^2/r,
every one of them is true for an orbit, and the question has no answer. When
options are formulas, three of them must be formulas that do not hold.

Every wrong option carries why_wrong: the specific mistake that lands a student
there, in one sentence. "Forgot to convert grams to kilograms" or "used the
diameter instead of the radius". This is what the student sees when they pick it,
so it has to name the error rather than restate the right answer. If you cannot
name the mistake behind an option, that option is a filler and the question needs
a better distractor. The correct option has why_wrong as an empty string.`;

  const data = await callModel(prompt, QUESTIONS_SCHEMA);
  return (data.questions || [])
    .filter((q) => q.options?.length === 4 && q.options.some((o) => o.id === q.correct_answer))
    .map((q, i) => ({
      ...q,
      question_type: "mcq",
      figure: cleanFigure(q.figure),
      difficulty: settleDifficulty(plan[i] ?? 0.5, q.difficulty),
    }))
    .filter((q) => !referencesMissingFigure(q));
}

/**
 * Verification by independent solving.
 *
 * The old version showed the model the answer it had just written and asked
 * whether it was sound. That is not a check, it is a request for agreement,
 * and it passed two physics questions whose answers were out by a factor of
 * four. Being told the answer anchors the next token as surely for a model as
 * it does for a person marking their own homework.
 *
 * So the answer is not shown. Each question is solved from scratch, twice, at
 * a temperature low enough to be near deterministic, and the two solutions are
 * compared to each other and to the marked answer in code rather than by the
 * model. A question survives only when three independent things agree.
 *
 * This rejects more than it used to, including some questions that were fine.
 * That is the intended trade. A bank of 40 questions a student can trust beats
 * a bank of 100 where one in twenty quietly teaches them the wrong physics,
 * because the second kind costs them marks in a real exam and they will never
 * know why.
 */
function askForAnswers(questions, { alternativeRoute = false } = {}) {
  const listing = questions
    .map((q, i) =>
      q.question_type === "short_answer"
        ? `${i}. ${q.stem}`
        : `${i}. ${q.stem}\n   ${q.options.map((o) => `(${o.id}) ${o.text}`).join("  ")}`
    )
    .join("\n\n");

  const route = alternativeRoute
    ? `\n\nWhere a question can be worked more than one way, deliberately take a DIFFERENT route from the most obvious one: use a different given quantity, or a different relationship, to reach the answer. If two valid routes give two different answers, the question's data contradicts itself. Set confident to false when that happens.`
    : "";

  return `Answer each question below. Work each one out fully before answering, using ONLY the numbers the question gives you. Never substitute a remembered constant for what the question's own data implies.

Give the answer only: a single letter for multiple choice, or the value alone for the rest. Include the unit where there is one. If a question cannot be answered from what it gives you, or has more than one defensible answer, set confident to false.

For multiple choice, also list in all_true_options EVERY option that is a true statement or a correct answer, not only the one you chose. Most questions will have exactly one. Listing two is how a question with no single answer gets caught.${route}

Questions:\n\n${listing}`;
}

/** Compare two answers the way a marker would, not the way a string does. */
function sameAnswer(a, b, kind) {
  if (a == null || b == null) return false;
  const left = normaliseText(String(a));
  const right = normaliseText(String(b));
  if (!left || !right) return false;
  if (left === right) return true;

  const ln = parseNumber(left);
  const rn = parseNumber(right);
  if (ln != null && rn != null) return numbersMatch(ln, rn, 0.02);

  // A checker told to answer "40" sometimes answers "a shortage of 40 million
  // bushels". That is obedience failing, not a wrong answer, and treating it
  // as a disagreement unpublishes a good question.
  if (kind !== "letter" && looseNumericMatch(a, b)) return true;

  if (kind === "text") return left.includes(right) || right.includes(left);
  return false;
}

/** What the question itself claims the answer is. */
function markedAnswer(q) {
  if (q.question_type === "short_answer") return q.accepted_answers || [];
  return [q.correct_answer];
}

function agreesWithMarked(q, given) {
  const kind = q.question_type === "short_answer" ? q.answer_kind || "number" : "letter";
  return markedAnswer(q).some((expected) => sameAnswer(given, expected, kind));
}

async function verifyBatch(questions) {
  if (!questions.length) return [];

  // The passes are deliberately NOT identical. Two solves at temperature zero
  // take the same route and agree with each other even when the question's own
  // numbers contradict themselves, which is how three over-specified satellite
  // questions got through: state the radius, g and the Earth's mass, and two
  // correct methods give two different answers. Asking the second pass to reach
  // the answer another way is what surfaces that.
  const passes = [];
  for (let i = 0; i < VERIFY_PASSES; i++) {
    const prompt = askForAnswers(questions, { alternativeRoute: i > 0 });
    const data = await callModel(prompt, SOLUTIONS_SCHEMA, undefined, i > 0 ? 0.3 : 0, VERIFY_PROVIDER);
    const byIndex = new Map();
    for (const s of data.solutions || []) byIndex.set(s.index, s);
    passes.push(byIndex);
  }

  const kept = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const solutions = passes.map((p) => p.get(i)).filter(Boolean);

    if (solutions.length < passes.length) {
      console.log(`    rejected #${i}: verifier did not answer it`);
      continue;
    }
    if (solutions.some((s) => !s.confident)) {
      console.log(`    rejected #${i}: verifier called it ambiguous`);
      continue;
    }

    // The independent solves must agree with each other first. Two different
    // answers means the question is hard to pin down even when it is fair, and
    // a question nobody can answer the same way twice does not belong here.
    const kind = q.question_type === "short_answer" ? q.answer_kind || "number" : "letter";
    const [first, ...rest] = solutions;
    if (!rest.every((s) => sameAnswer(s.answer, first.answer, kind))) {
      console.log(
        `    rejected #${i}: solves disagreed (${solutions.map((s) => s.answer).join(" vs ")})`
      );
      continue;
    }

    // More than one true option means there is no single answer, however
    // confidently the solver picked one of them.
    const trueOptions = new Set(
      solutions.flatMap((s) => (s.all_true_options || []).map((o) => String(o).toLowerCase().trim()))
    );
    if (q.question_type !== "short_answer" && trueOptions.size > 1) {
      console.log(`    rejected #${i}: more than one option is true (${[...trueOptions].join(", ")})`);
      continue;
    }

    if (!agreesWithMarked(q, first.answer)) {
      console.log(
        `    rejected #${i}: worked answer ${first.answer}, marked ${markedAnswer(q).join("/")}`
      );
      continue;
    }

    kept.push(q);
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * A background run must not die on one stray rejection. Anything unhandled is
 * logged and the loop carries on: the alternative is what happened overnight,
 * where a dropped socket ended the whole thing and the log was a stack trace.
 */
process.on("unhandledRejection", (err) => {
  console.error(`  unhandled: ${err?.message || err}`);
});

async function main() {
  const modelLabel =
    PROVIDER === "claude"
      ? MODEL
      : PROVIDER === "vllm"
        ? `${VLLM_MODEL} (served)`
        : `${OLLAMA_MODEL} (local, free)`;
  console.log(`Subject: ${SUBJECT} | target ${PER_SUBTOPIC}/subtopic | ${modelLabel}`);
  await preflight();

  db = await connect();

  const { rows: subtopics } = await db.query(
    `SELECT topic, subtopic, curriculum FROM syllabus_content
     WHERE subject = $1 ORDER BY topic, subtopic`,
    [SUBJECT]
  );
  if (subtopics[0]?.curriculum) CURRICULUM = subtopics[0].curriculum;
  if (!subtopics?.length) {
    console.error(`No syllabus_content rows for subject "${SUBJECT}". Seed the syllabus first.`);
    process.exit(1);
  }

  const mine = SHARD
    ? subtopics.filter((_, i) => i % SHARD.total === SHARD.index - 1)
    : subtopics;
  if (SHARD) {
    console.log(
      `Shard ${SHARD.index}/${SHARD.total}: ${mine.length} of ${subtopics.length} subtopics.`
    );
  }

  const todo = LIMIT_SUBTOPICS > 0 ? mine.slice(0, LIMIT_SUBTOPICS) : mine;
  let totalInserted = 0;
  const startedAt = Date.now();

  /** One subtopic, worked until it hits the target or stops making progress. */
  async function fillSubtopic({ topic, subtopic }) {
    const { rows: existing } = await db.query(
      `SELECT stem FROM questions WHERE subject = $1 AND subtopic = $2`,
      [SUBJECT, subtopic]
    );

    const existingStems = existing.map((q) => q.stem);
    let have = existingStems.length;
    const cost = dollars();
    const meter =
      spend.calls > 0
        ? ` · ${tokensPerSecond().toFixed(0)} tok/s` + (cost > 0 ? ` · $${cost.toFixed(2)}` : "")
        : "";
    console.log(`\n${subtopic}: ${have}/${PER_SUBTOPIC}${meter}`);

    let consecutiveNoProgress = 0;
    let round = 0;
    while (have < PER_SUBTOPIC) {
      if (budgetCheck()) return;
      round++;
      if (consecutiveNoProgress >= 3) {
        console.log(
          `  no new unique questions after 3 attempts; moving on at ${have}/${PER_SUBTOPIC}`
        );
        break;
      }
      const want = Math.min(BATCH_SIZE, PER_SUBTOPIC - have);
      const batchType =
        TYPE === "mixed" ? (round % 2 === 0 ? "mcq" : "short_answer") : TYPE;
      try {
        const generated = await generateBatch(subtopic, topic, want, existingStems, {
          round,
          type: batchType,
        });
        console.log(`  generated ${generated.length}, verifying...`);
        const verified = await verifyBatch(generated);
        console.log(`  ${verified.length}/${generated.length} passed verification`);

        if (verified.length > 0) {
          const rows = verified.map((q) => ({
            curriculum: CURRICULUM,
            subject: SUBJECT,
            topic,
            subtopic,
            question_type: q.question_type || "mcq",
            stem: q.stem,
            // A short answer has no options, and its answer lives in
            // accepted_answers; correct_answer keeps the canonical form so
            // anything reading only that column still shows something sensible.
            options: q.options || null,
            correct_answer: q.correct_answer ?? q.accepted_answers?.[0] ?? null,
            accepted_answers: q.accepted_answers || null,
            answer_kind: q.answer_kind || null,
            answer_hint: q.answer_hint || null,
            explanation: q.explanation,
            hint: q.hint || null,
            // Only the wrong options carry feedback. Storing an empty string
            // for the correct one would make the UI think there is something
            // to say about picking the right answer.
            option_feedback: q.options
              ? Object.fromEntries(
                  q.options
                    .filter((o) => o.id !== q.correct_answer && o.why_wrong?.trim())
                    .map((o) => [o.id, o.why_wrong.trim()])
                )
              : null,
            figure: q.figure || null,
            stimulus: q.stimulus || null,
            stimulus_kind: q.stimulus_kind || null,
            marks: q.marks,
            time_budget_seconds: q.time_budget_seconds,
            difficulty: q.difficulty,
            source: "ai-generated",
            verified: true,
          }));
          // Insert individually so one duplicate (rejected by the unique stem
          // fingerprint) doesn't discard the whole batch.
          let inserted = 0;
          let duplicates = 0;
          for (const row of rows) {
            try {
              const res = await db.query(
                `INSERT INTO questions
                   (curriculum, subject, topic, subtopic, question_type, stem, options,
                    correct_answer, accepted_answers, answer_kind, answer_hint,
                    explanation, hint, option_feedback, figure,
                    stimulus, stimulus_kind,
                    marks, time_budget_seconds, difficulty, source, verified)
                 VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,
                         $14::jsonb,$15::jsonb,$16,$17,$18,$19,$20,$21,$22)
                 ON CONFLICT DO NOTHING`,
                [
                  row.curriculum, row.subject, row.topic, row.subtopic, row.question_type,
                  row.stem,
                  row.options ? JSON.stringify(row.options) : null,
                  row.correct_answer,
                  row.accepted_answers ? JSON.stringify(row.accepted_answers) : null,
                  row.answer_kind, row.answer_hint, row.explanation,
                  row.hint,
                  row.option_feedback && Object.keys(row.option_feedback).length
                    ? JSON.stringify(row.option_feedback)
                    : null,
                  row.figure ? JSON.stringify(row.figure) : null,
                  row.stimulus, row.stimulus_kind,
                  row.marks, row.time_budget_seconds, row.difficulty, row.source, row.verified,
                ]
              );
              if (res.rowCount > 0) {
                inserted++;
                existingStems.push(row.stem);
              } else {
                duplicates++;
              }
            } catch (e) {
              if (e.code === "23505") duplicates++;
              else throw e;
            }
          }
          have += inserted;
          totalInserted += inserted;
          console.log(
            `  inserted ${inserted}${duplicates ? `, ${duplicates} duplicate(s) skipped` : ""} → ${have}/${PER_SUBTOPIC}`
          );
          consecutiveNoProgress = inserted === 0 ? consecutiveNoProgress + 1 : 0;
        } else {
          console.log("  batch fully rejected, retrying");
          consecutiveNoProgress++;
        }
      } catch (err) {
        console.error(`  batch failed: ${err.message}; waiting 20s`);
        await new Promise((r) => setTimeout(r, 20000));
      }
    }
  }

  // A pool rather than Promise.all over everything: 2,590 subtopics started at
  // once would open 2,590 model requests and fall over. Workers pull the next
  // subtopic as they finish, so exactly CONCURRENCY are ever in flight.
  const queue = [...todo];
  let stopped = false;

  async function worker(id) {
    while (!stopped) {
      const next = queue.shift();
      if (!next) return;
      if (MAX_QUESTIONS > 0 && totalInserted >= MAX_QUESTIONS) {
        stopped = true;
        return;
      }
      try {
        await fillSubtopic(next);
      } catch (err) {
        // One bad subtopic must not take the whole run down. It stays
        // unfinished and the next run picks it up, because progress is counted
        // from what is already in the database rather than from memory.
        console.error(`  [w${id}] ${next.subtopic} failed: ${err.message}`);
      }
    }
  }

  console.log(
    `${todo.length} subtopics, ${CONCURRENCY} at a time` +
      (MAX_QUESTIONS > 0 ? `, stopping after ${MAX_QUESTIONS} questions` : "")
  );

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, (_, i) => worker(i + 1))
  );

  const mins = (Date.now() - startedAt) / 60000;
  console.log(`\nDone. Inserted ${totalInserted} new verified questions in ${mins.toFixed(1)} min.`);
  if (spend.calls > 0) {
    console.log(
      `Throughput: ${tokensPerSecond().toFixed(0)} output tok/s over ${spend.calls} calls ` +
        `(${(spend.input / 1000).toFixed(0)}k in, ${(spend.output / 1000).toFixed(0)}k out) ` +
        `at concurrency ${CONCURRENCY}.`
    );
    const cost = dollars();
    if (cost > 0 && totalInserted > 0) {
      const perQuestion = cost / totalInserted;
      console.log(
        `Cost: $${cost.toFixed(2)} = $${perQuestion.toFixed(4)} per question kept. ` +
          `10,000 would be about $${(perQuestion * 10000).toFixed(0)}, ` +
          `all 295,700 about $${Math.round((perQuestion * 295700) / 10) * 10}.`
      );
    }
    const rate = totalInserted / Math.max(mins, 0.01);
    if (rate > 0) {
      console.log(
        `At ${rate.toFixed(1)} questions/min, 295,700 would take ` +
          `${(295700 / rate / 60).toFixed(0)} hours.`
      );
    }
  }
  if (totalInserted > 0) {
    console.log(`Rate: ${(totalInserted / mins).toFixed(1)} questions/min at concurrency ${CONCURRENCY}.`);
  }
  await db.end();
}

main().catch(async (err) => {
  console.error(`\n${err.message}\n`);
  await db?.end().catch(() => {});
  process.exit(1);
});
