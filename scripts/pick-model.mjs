/**
 * Which of your local models can actually be trusted to write exam questions?
 *
 * Model choice is usually made from a leaderboard, which measures something
 * else, on questions nobody here is asking. This measures the only thing that
 * matters for this job: given a question and no answer, does the model work out
 * the right one, and does it reject the ones that are genuinely wrong.
 *
 * It runs the same six-question test on every model you have installed and puts
 * the scores in a table. Twenty minutes of your laptop's time, and then you
 * know, instead of finding out from a bank you spent a night generating.
 *
 * Usage:
 *   node scripts/pick-model.mjs
 *   node scripts/pick-model.mjs --models "qwen2.5:14b,qwen2.5:32b,gemma3:27b"
 *   node scripts/pick-model.mjs --pull        download the suggested candidates first
 *   node scripts/pick-model.mjs --ollama-url http://192.168.1.42:11434
 *
 * The last form tests a second machine over the network, so a PC that does not
 * have this repo on it can still be measured from the one that does.
 */

import { execSync } from "node:child_process";
import { CASES } from "./checker-cases.mjs";
import { normaliseText, parseNumber, numbersMatch, looseNumericMatch } from "../lib/grading.js";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const OLLAMA_URL = arg("ollama-url", "http://localhost:11434");
const PASSES = Math.max(1, parseInt(arg("passes", "2"), 10));

/**
 * Worth trying on a machine with enough memory, roughly in order of how likely
 * they are to do the arithmetic. Reasoning-tuned models come first: an
 * arithmetic slip is exactly what a reasoning trace catches, and arithmetic
 * slips are the failure mode that put wrong answers in the bank.
 *
 * Sizes are the quantised download. A model has to fit in memory alongside its
 * context, so on 24GB anything over about 20GB will swap and crawl.
 */
const SUGGESTED = [
  "qwen3:30b-a3b",
  "qwen2.5:32b",
  "gemma3:27b",
  "qwen2.5:14b",
];

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
          answer: { type: "string" },
          confident: { type: "boolean" },
        },
      },
    },
  },
};

function sameAnswer(a, b, kind) {
  if (a == null || b == null) return false;
  const left = normaliseText(String(a));
  const right = normaliseText(String(b));
  if (!left || !right) return false;
  if (left === right) return true;
  const ln = parseNumber(left);
  const rn = parseNumber(right);
  if (ln != null && rn != null) return numbersMatch(ln, rn, 0.02);
  if (kind !== "letter" && looseNumericMatch(a, b)) return true;
  if (kind === "text") return left.includes(right) || right.includes(left);
  return false;
}

async function callOllama(model, prompt) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: SOLUTIONS_SCHEMA,
      options: { temperature: 0 },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return JSON.parse((await res.json()).message.content);
}

const PROMPT = (() => {
  const listing = CASES.map((c, i) =>
    c.question.question_type === "short_answer"
      ? `${i}. ${c.question.stem}`
      : `${i}. ${c.question.stem}\n   ${c.question.options
          .map((o) => `(${o.id}) ${o.text}`)
          .join("  ")}`
  ).join("\n\n");

  return `Answer each question below. Work each one out fully before answering.

Give the answer only: a single letter for multiple choice, or the value alone for the rest. Include the unit where there is one. If a question cannot be answered from what it gives you, or has more than one defensible answer, set confident to false.

Questions:\n\n${listing}`;
})();

async function score(model) {
  const startedAt = Date.now();
  const passes = [];
  for (let i = 0; i < PASSES; i++) {
    const data = await callOllama(model, PROMPT);
    passes.push(new Map((data.solutions || []).map((s) => [s.index, s])));
  }

  let correct = 0;
  const notes = [];
  CASES.forEach((c, i) => {
    const q = c.question;
    const kind = q.question_type === "short_answer" ? q.answer_kind || "number" : "letter";
    const marked = q.question_type === "short_answer" ? q.accepted_answers : [q.correct_answer];
    const solutions = passes.map((p) => p.get(i)).filter(Boolean);

    let kept;
    if (solutions.length < passes.length) kept = false;
    else if (solutions.some((s) => !s.confident)) kept = false;
    else if (!solutions.every((s) => sameAnswer(s.answer, solutions[0].answer, kind))) kept = false;
    else kept = marked.some((m) => sameAnswer(solutions[0].answer, m, kind));

    if (kept === c.shouldPass) correct++;
    else {
      notes.push(
        `${c.name}: expected ${c.shouldPass ? "kept" : "rejected"}, ` +
          `got ${kept ? "kept" : "rejected"}` +
          (solutions[0] ? ` (said ${solutions[0].answer})` : "")
      );
    }
  });

  return { correct, seconds: Math.round((Date.now() - startedAt) / 1000), notes };
}

async function installed() {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);
  const { models } = await res.json();
  return (models || []).map((m) => m.name);
}

async function main() {
  let have;
  try {
    have = await installed();
  } catch {
    console.error(`Cannot reach Ollama at ${OLLAMA_URL}. Install it from https://ollama.com`);
    process.exit(1);
  }

  if (flag("pull")) {
    for (const m of SUGGESTED) {
      if (have.some((h) => h === m || h.startsWith(`${m}:`))) continue;
      console.log(`Pulling ${m}…`);
      try {
        execSync(`ollama pull ${m}`, { stdio: "inherit" });
      } catch {
        console.log(`  ${m} could not be pulled; skipping.`);
      }
    }
    have = await installed();
  }

  const explicit = arg("models", null);
  const candidates = explicit
    ? explicit.split(",").map((s) => s.trim())
    : have.filter((m) => !/embed|cloud/i.test(m));

  if (!candidates.length) {
    console.error("No models to test. Try --pull, or ollama pull qwen2.5:32b");
    process.exit(1);
  }

  console.log(
    `Testing ${candidates.length} model(s) on the six questions that decide this.\n` +
      `Each one is solved ${PASSES}x at temperature zero. This takes a few minutes each.\n`
  );

  const results = [];
  for (const model of candidates) {
    process.stdout.write(`  ${model.padEnd(30)} `);
    try {
      const r = await score(model);
      results.push({ model, ...r });
      console.log(`${r.correct}/${CASES.length}  (${r.seconds}s)`);
    } catch (e) {
      console.log(`failed: ${e.message}`);
      results.push({ model, correct: -1, seconds: 0, notes: [e.message] });
    }
  }

  results.sort((a, b) => b.correct - a.correct || a.seconds - b.seconds);

  console.log(`\n${"═".repeat(72)}`);
  for (const r of results) {
    if (r.correct < 0) continue;
    console.log(`${r.model.padEnd(30)} ${r.correct}/${CASES.length}   ${r.seconds}s`);
    for (const n of r.notes) console.log(`    missed: ${n}`);
  }

  const best = results[0];
  console.log(`\n${"═".repeat(72)}`);
  if (!best || best.correct < 0) {
    console.log("Nothing ran. Check Ollama is serving.");
  } else if (best.correct === CASES.length) {
    console.log(`Use ${best.model}. It got all six.\n`);
    console.log(`  node scripts/build-bank.mjs --mine --per-subtopic 50 \\`);
    console.log(`    --provider ollama --ollama-model ${best.model} --shard 1/2`);
  } else {
    console.log(
      `Best is ${best.model} at ${best.correct}/${CASES.length}. Nothing here is safe for\n` +
        `arithmetic subjects, so generate the ones without numeric answers tonight and\n` +
        `leave physics, chemistry and maths until you can verify them properly:\n`
    );
    console.log(`  node scripts/build-bank.mjs --per-subtopic 50 \\`);
    console.log(`    --subjects "English A: Literature SL,Arabic A: Literature SL,Economics HL" \\`);
    console.log(`    --provider ollama --ollama-model ${best.model}`);
    console.log(
      `\nThat is not a failure. Three subjects generated tonight is three more than\n` +
        `you have, and the maths is still there tomorrow when the hardware is better.`
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
