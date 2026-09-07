/**
 * Have a second, independent model solve the whole bank from scratch.
 *
 * The generator already verifies what it writes, but it verifies it with the
 * model that wrote it, in the same session, with the same blind spots. This is
 * a different model, days later, with no idea what answer was intended: it is
 * shown the question and nothing else, solves it twice at temperature zero, and
 * the answers are compared in code.
 *
 * Anything it disagrees with is unpublished and listed. That is the point of
 * the whole exercise: it turns "check a hundred questions by hand" into "check
 * the fifteen it flagged, plus thirty it passed to make sure it is not asleep".
 *
 * It is not a replacement for checking some yourself. An independent model
 * catches arithmetic, which is where generation actually fails, but it shares
 * a lot of a generator's assumptions about what a syllabus contains. Use it to
 * find the suspects; use spot-check to find out whether it is doing its job.
 *
 * Usage:
 *   node scripts/recheck.mjs --provider claude --claude-model claude-haiku-4-5-20251001
 *   node scripts/recheck.mjs --subject "Physics SL" --provider claude
 *   node scripts/recheck.mjs --provider vllm --vllm-model Qwen/Qwen2.5-72B-Instruct
 *   node scripts/recheck.mjs --dry            report only, unpublish nothing
 */

import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { connect } from "./db.mjs";
import { normaliseText, parseNumber, numbersMatch, looseNumericMatch } from "../lib/grading.js";
import { CASES } from "./checker-cases.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const PROVIDER = arg("provider", "claude");
const MODEL = arg("claude-model", "claude-haiku-4-5-20251001");
const OLLAMA_MODEL = arg("ollama-model", "qwen2.5:14b");
const OLLAMA_URL = arg("ollama-url", "http://localhost:11434");
const VLLM_URL = arg("vllm-url", process.env.VLLM_URL || "http://localhost:8000/v1");
const VLLM_MODEL = arg("vllm-model", process.env.VLLM_MODEL || "");
const VLLM_KEY = process.env.VLLM_API_KEY || "EMPTY";
const SUBJECT = arg("subject", null);
const LIMIT = parseInt(arg("limit", "0"), 10);
const BATCH = parseInt(arg("batch-size", "20"), 10);
const CONCURRENCY = Math.max(1, parseInt(arg("concurrency", PROVIDER === "ollama" ? "1" : "8"), 10));
const PASSES = Math.max(1, parseInt(arg("passes", "2"), 10));
const BUDGET = parseFloat(arg("budget", "0"));
const DRY = flag("dry");

const PRICES = {
  "claude-opus-5": { input: 15, output: 75 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

const anthropic = PROVIDER === "claude" ? new Anthropic() : null;
const spend = { input: 0, output: 0, calls: 0 };
const dollars = () => {
  const p = PRICES[MODEL] || PRICES["claude-sonnet-5"];
  return (spend.input / 1e6) * p.input + (spend.output / 1e6) * p.output;
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
              "A single letter for multiple choice, or the value alone for the rest. No working.",
          },
          confident: { type: "boolean" },
        },
      },
    },
  },
};

/* ------------------------------------------------------------------ callers */

async function callClaude(prompt, schema) {
  const res = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    temperature: 0,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  if (res.usage) {
    spend.input += res.usage.input_tokens || 0;
    spend.output += res.usage.output_tokens || 0;
    spend.calls++;
  }
  return JSON.parse(res.content.find((b) => b.type === "text").text);
}

async function callVllm(prompt, schema) {
  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${VLLM_KEY}` },
    body: JSON.stringify({
      model: VLLM_MODEL,
      temperature: 0,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "o", schema, strict: true } },
    }),
  });
  if (!res.ok) throw new Error(`vLLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  spend.calls++;
  return JSON.parse(data.choices[0].message.content);
}

async function callOllama(prompt, schema) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: schema,
      options: { temperature: 0 },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  spend.calls++;
  return JSON.parse((await res.json()).message.content);
}

const callModel = (prompt, schema) =>
  PROVIDER === "claude"
    ? callClaude(prompt, schema)
    : PROVIDER === "vllm"
      ? callVllm(prompt, schema)
      : callOllama(prompt, schema);

/* ------------------------------------------------------------------ marking */

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

const markedOf = (q) =>
  q.question_type === "short_answer" ? q.accepted_answers || [] : [q.correct_answer];

/**
 * One batch: solved `PASSES` times, blind, and judged in code. The question's
 * own answer is never in the prompt, which is the entire difference between
 * this and asking a model whether it agrees with itself.
 */
async function checkBatch(batch) {
  const listing = batch
    .map((q, i) =>
      q.question_type === "short_answer"
        ? `${i}. ${q.stem}`
        : `${i}. ${q.stem}\n   ${(q.options || [])
            .map((o) => `(${o.id}) ${o.text}`)
            .join("  ")}`
    )
    .join("\n\n");

  const prompt = `Answer each question below. Work each one out fully before answering.

Give the answer only: a single letter for multiple choice, or the value alone for the rest. Include the unit where there is one. If a question cannot be answered from what it gives you, or has more than one defensible answer, set confident to false.

Questions:\n\n${listing}`;

  const passes = [];
  for (let i = 0; i < PASSES; i++) {
    const data = await callModel(prompt, SOLUTIONS_SCHEMA);
    passes.push(new Map((data.solutions || []).map((s) => [s.index, s])));
  }

  return batch.map((q, i) => {
    const kind = q.question_type === "short_answer" ? q.answer_kind || "number" : "letter";
    const solutions = passes.map((p) => p.get(i)).filter(Boolean);
    const marked = markedOf(q);

    if (solutions.length < passes.length) {
      return { q, ok: false, note: "the checker did not answer it" };
    }
    if (solutions.some((s) => !s.confident)) {
      return { q, ok: false, note: "the checker called it ambiguous or unanswerable" };
    }
    if (!solutions.every((s) => sameAnswer(s.answer, solutions[0].answer, kind))) {
      return {
        q,
        ok: false,
        note: `two independent solves disagreed: ${solutions.map((s) => s.answer).join(" vs ")}`,
      };
    }
    if (!marked.some((m) => sameAnswer(solutions[0].answer, m, kind))) {
      return {
        q,
        ok: false,
        note: `checker worked out ${solutions[0].answer}, question says ${marked.join("/")}`,
      };
    }
    return { q, ok: true, note: null };
  });
}

/**
 * Can this checker be trusted to unpublish things?
 *
 * Running a recheck with a weak model is worse than not running one. Measured
 * on qwen2.5:14b over twenty real questions it flagged three, and two of them
 * were correct questions it had simply got wrong: the sum of the first twenty
 * terms of 2 + 5 + 8 + … really is 610, and it said otherwise. Left to run,
 * that pass would have quietly deleted a working bank and reported it as
 * quality control.
 *
 * So the checker sits the same six-question test first, and a model that does
 * not score full marks may report but may not unpublish.
 */
async function checkerIsTrustworthy() {
  const results = await checkBatch(
    CASES.map((c) => ({ ...c.question, id: null, subject: "", subtopic: "" }))
  );
  const correct = results.filter((r, i) => r.ok === CASES[i].shouldPass).length;
  return { correct, total: CASES.length };
}

/* --------------------------------------------------------------------- main */

async function main() {
  if (PROVIDER === "claude" && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      `No ANTHROPIC_API_KEY found. Add credits at console.anthropic.com, create a\n` +
        `key, and put it in .env.local. API credits are separate from a Claude.ai\n` +
        `subscription. Or check locally with --provider ollama, which can report\n` +
        `but will not be allowed to unpublish.`
    );
    process.exit(1);
  }

  const db = await connect();
  await db.query(fs.readFileSync(new URL("./034-recheck.sql", import.meta.url), "utf8"));

  const params = [];
  let where = "verified = true AND rechecked_at IS NULL";
  if (SUBJECT) {
    params.push(SUBJECT);
    where += ` AND subject = $${params.length}`;
  }
  const limit = LIMIT > 0 ? `LIMIT ${LIMIT}` : "";
  const { rows: questions } = await db.query(
    `SELECT * FROM questions WHERE ${where} ORDER BY subject, subtopic ${limit}`,
    params
  );

  if (!questions.length) {
    console.log("Nothing left to re-check. Everything published has been through it.");
    process.exit(0);
  }

  const label = PROVIDER === "claude" ? MODEL : PROVIDER === "vllm" ? VLLM_MODEL : OLLAMA_MODEL;

  process.stdout.write(`Testing whether ${label} can be trusted to check… `);
  const trust = await checkerIsTrustworthy();
  console.log(`${trust.correct}/${trust.total}`);

  let dryRun = DRY;
  if (trust.correct < trust.total) {
    if (flag("force")) {
      console.log(
        `  Scored ${trust.correct}/${trust.total} and --force was passed. Unpublishing anyway.`
      );
    } else {
      dryRun = true;
      console.log(
        `\n  This model is not accurate enough to unpublish anything, so it will only report.\n` +
          `  A checker that gets questions wrong deletes correct ones and calls it quality\n` +
          `  control. Use a stronger model: --provider claude --claude-model claude-sonnet-5.\n` +
          `  Pass --force to override, if you intend to read every flag by hand.\n`
      );
    }
  }

  console.log(
    `Re-checking ${questions.length} questions with ${label}, ${PASSES} blind solves each.` +
      (dryRun ? " (reporting only, nothing will be unpublished)" : "")
  );

  const batches = [];
  for (let i = 0; i < questions.length; i += BATCH) batches.push(questions.slice(i, i + BATCH));

  let done = 0;
  let flagged = 0;
  const failures = [];
  let stopped = false;
  let cursor = 0;

  async function worker() {
    while (cursor < batches.length && !stopped) {
      const batch = batches[cursor++];
      try {
        const results = await checkBatch(batch);
        for (const r of results) {
          if (r.ok) {
            if (!dryRun) {
              await db.query(
                "UPDATE questions SET rechecked_at = now(), recheck_note = NULL WHERE id = $1",
                [r.q.id]
              );
            }
          } else {
            flagged++;
            failures.push(r);
            if (!dryRun) {
              await db.query(
                "UPDATE questions SET verified = false, rechecked_at = now(), recheck_note = $2 WHERE id = $1",
                [r.q.id, r.note]
              );
            }
          }
        }
        done += batch.length;
      } catch (e) {
        console.error(`\n  batch failed: ${e.message}`);
      }

      const cost = PROVIDER === "claude" ? ` · $${dollars().toFixed(2)}` : "";
      process.stdout.write(`\r  ${done}/${questions.length} · ${flagged} flagged${cost}   `);

      if (BUDGET > 0 && dollars() >= BUDGET) {
        stopped = true;
        console.log(`\n  Budget of $${BUDGET.toFixed(2)} reached. Stopping; re-run to continue.`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () => worker())
  );

  console.log(`\n\n${"═".repeat(72)}`);
  const rate = done ? flagged / done : 0;
  console.log(
    `${flagged} of ${done} disagreed (${(rate * 100).toFixed(1)}%)` +
      (dryRun ? ", nothing changed." : `, and ${flagged} ${flagged === 1 ? "is" : "are"} now unpublished.`)
  );
  if (PROVIDER === "claude") {
    console.log(
      `Spend: $${dollars().toFixed(2)} over ${spend.calls} calls ` +
        `= $${done ? (dollars() / done).toFixed(5) : 0} per question checked.`
    );
  }

  if (failures.length) {
    console.log(`\nFirst few disagreements:`);
    for (const f of failures.slice(0, 10)) {
      console.log(`\n  ${f.q.subject} · ${f.q.subtopic}`);
      console.log(`  ${f.q.stem.slice(0, 100)}${f.q.stem.length > 100 ? "…" : ""}`);
      console.log(`  → ${f.note}`);
    }
  }

  console.log(
    `\nNext: spot-check about 30 that PASSED, by hand. If the checker were asleep,\n` +
      `that is the only way you would find out.\n` +
      `  npm run spot-check -- ${SUBJECT ? `--subject "${SUBJECT}" ` : ""}--n 30`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
