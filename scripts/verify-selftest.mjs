/**
 * Does the verifier actually catch a wrong answer?
 *
 * Two physics questions got into the bank with answers out by a factor of four
 * and the old verifier passed both, because it was shown the answer and asked
 * whether it agreed. This is the test that has to pass before generation is
 * trusted again: known-bad questions must be rejected, and known-good ones
 * must survive. If the good ones are also rejected the model is too weak for
 * the subject, which is worth knowing before spending a night generating.
 *
 * Usage:
 *   node scripts/verify-selftest.mjs
 *   node scripts/verify-selftest.mjs --provider claude
 *   node scripts/verify-selftest.mjs --ollama-model qwen2.5:14b --verify-passes 3
 */

import Anthropic from "@anthropic-ai/sdk";
import { normaliseText, parseNumber, numbersMatch } from "../lib/grading.js";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PROVIDER = arg("provider", "ollama");
const OLLAMA_MODEL = arg("ollama-model", "qwen2.5:14b");
const OLLAMA_URL = arg("ollama-url", "http://localhost:11434");
const VERIFY_PASSES = Math.max(1, parseInt(arg("verify-passes", "2"), 10));
const anthropic = PROVIDER === "claude" ? new Anthropic() : null;

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

/**
 * The first two are the real failures, with the answers that were actually
 * stored. The rest are correct, and exist so a verifier that simply rejects
 * everything cannot pass this test.
 */
const CASES = [
  {
    name: "geostationary speed (was wrong in the bank)",
    shouldPass: false,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A satellite orbits Earth in a geostationary orbit of radius 4.22 x 10^7 m. Calculate its orbital speed in km/h.",
      accepted_answers: ["3071"],
    },
  },
  {
    name: "centripetal force (was wrong in the bank)",
    shouldPass: false,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A 2.0 kg mass moves in a circle of radius 0.50 m at a constant speed of 3.0 m/s. Calculate the centripetal force in N.",
      accepted_answers: ["900"],
    },
  },
  {
    name: "centripetal force, correct answer",
    shouldPass: true,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A 2.0 kg mass moves in a circle of radius 0.50 m at a constant speed of 3.0 m/s. Calculate the centripetal force in N.",
      accepted_answers: ["36"],
    },
  },
  {
    name: "kinetic energy, correct answer",
    shouldPass: true,
    question: {
      question_type: "short_answer",
      answer_kind: "number",
      stem: "A 4.0 kg object moves at 5.0 m/s. Calculate its kinetic energy in J.",
      accepted_answers: ["50"],
    },
  },
  {
    name: "MCQ derivative, correct answer",
    shouldPass: true,
    question: {
      question_type: "mcq",
      stem: "What is the derivative of f(x) = 3x^2 + 2x with respect to x?",
      options: [
        { id: "a", text: "6x + 2" },
        { id: "b", text: "3x + 2" },
        { id: "c", text: "6x" },
        { id: "d", text: "x^3 + x^2" },
      ],
      correct_answer: "a",
    },
  },
  {
    name: "MCQ derivative, wrong option marked",
    shouldPass: false,
    question: {
      question_type: "mcq",
      stem: "What is the derivative of f(x) = 3x^2 + 2x with respect to x?",
      options: [
        { id: "a", text: "6x + 2" },
        { id: "b", text: "3x + 2" },
        { id: "c", text: "6x" },
        { id: "d", text: "x^3 + x^2" },
      ],
      correct_answer: "c",
    },
  },
];

async function callOllama(prompt, schema, temperature) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: schema,
      options: { temperature: temperature ?? 0 },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return JSON.parse(data.message.content);
}

async function callClaude(prompt, schema) {
  const response = await anthropic.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 8000,
    temperature: 0,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(response.content.find((b) => b.type === "text").text);
}

const callModel = (prompt, schema, temperature) =>
  PROVIDER === "claude" ? callClaude(prompt, schema) : callOllama(prompt, schema, temperature);

function sameAnswer(a, b, kind) {
  if (a == null || b == null) return false;
  const left = normaliseText(String(a));
  const right = normaliseText(String(b));
  if (!left || !right) return false;
  if (left === right) return true;
  const ln = parseNumber(left);
  const rn = parseNumber(right);
  if (ln != null && rn != null) return numbersMatch(ln, rn, 0.02);
  if (kind === "text") return left.includes(right) || right.includes(left);
  return false;
}

async function run() {
  const questions = CASES.map((c) => c.question);
  const listing = questions
    .map((q, i) =>
      q.question_type === "short_answer"
        ? `${i}. ${q.stem}`
        : `${i}. ${q.stem}\n   ${q.options.map((o) => `(${o.id}) ${o.text}`).join("  ")}`
    )
    .join("\n\n");

  const prompt = `Answer each question below. Work each one out fully before answering.

Give the answer only: a single letter for multiple choice, or the value alone for the rest. Include the unit where there is one. If a question cannot be answered from what it gives you, or has more than one defensible answer, set confident to false.

Questions:\n\n${listing}`;

  console.log(
    `Verifier self-test · ${PROVIDER === "claude" ? "claude-opus-5" : OLLAMA_MODEL} · ${VERIFY_PASSES} passes\n`
  );

  const passes = [];
  for (let i = 0; i < VERIFY_PASSES; i++) {
    process.stdout.write(`  solving, pass ${i + 1}…`);
    const data = await callModel(prompt, SOLUTIONS_SCHEMA, 0);
    const byIndex = new Map();
    for (const s of data.solutions || []) byIndex.set(s.index, s);
    passes.push(byIndex);
    console.log(" done");
  }
  console.log("");

  let failures = 0;
  CASES.forEach((c, i) => {
    const q = c.question;
    const kind = q.question_type === "short_answer" ? q.answer_kind || "number" : "letter";
    const marked = q.question_type === "short_answer" ? q.accepted_answers : [q.correct_answer];
    const solutions = passes.map((p) => p.get(i)).filter(Boolean);

    let verdict;
    let why;
    if (solutions.length < passes.length) {
      verdict = false;
      why = "not answered";
    } else if (solutions.some((s) => !s.confident)) {
      verdict = false;
      why = "called ambiguous";
    } else if (!solutions.every((s) => sameAnswer(s.answer, solutions[0].answer, kind))) {
      verdict = false;
      why = `solves disagreed: ${solutions.map((s) => s.answer).join(" vs ")}`;
    } else if (!marked.some((m) => sameAnswer(solutions[0].answer, m, kind))) {
      verdict = false;
      why = `worked ${solutions[0].answer}, marked ${marked.join("/")}`;
    } else {
      verdict = true;
      why = `agreed on ${solutions[0].answer}`;
    }

    const ok = verdict === c.shouldPass;
    if (!ok) failures++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${c.name}\n      expected ${c.shouldPass ? "kept" : "rejected"}, got ${verdict ? "kept" : "rejected"} (${why})`
    );
  });

  console.log(
    `\n${CASES.length - failures}/${CASES.length} correct.` +
      (failures
        ? "\n\nThe verifier is not safe to generate with yet. A stronger model, or more passes, is the fix; loosening the check is not."
        : "\n\nSafe to generate.")
  );
  process.exit(failures ? 1 : 0);
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
