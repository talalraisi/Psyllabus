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
import { normaliseText, parseNumber, numbersMatch } from "../lib/grading.js";

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
const PROVIDER = arg("provider", "ollama"); // ollama (free) | claude
const OLLAMA_MODEL = arg("ollama-model", "qwen2.5:14b");
const OLLAMA_URL = arg("ollama-url", "http://localhost:11434");
const BATCH_SIZE = PROVIDER === "ollama" ? 8 : 20; // local models do better with smaller batches

/**
 * How many subtopics to work on at once.
 *
 * Default 1, because on a laptop the model is bound by memory bandwidth and
 * running four at once mostly makes each of them four times slower. On a rented
 * GPU behind vLLM the opposite is true: one request at a time leaves the card
 * about 95% idle, and this is the single number that decides whether renting
 * one was worth it. Start at 16 there and watch tokens/sec.
 */
const CONCURRENCY = Math.max(1, parseInt(arg("concurrency", "1"), 10));

// Stop after this many, for pilots. 0 = no limit.
const MAX_QUESTIONS = parseInt(arg("max-questions", "0"), 10);
const MODEL = "claude-opus-5";

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

// Looked up from the syllabus rather than assumed, now that AP and A-Level are
// in the same table. Subject names do not collide across curricula.
let CURRICULUM = "IB";

// Only constructed when actually using Claude, so Ollama runs need no API key.
const anthropic = PROVIDER === "claude" || VERIFY_PROVIDER === "claude" ? new Anthropic() : null;
let db;

// ---------------------------------------------------------------------------
// Schemas for structured outputs
// ---------------------------------------------------------------------------

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
              required: ["id", "text"],
              properties: {
                id: { type: "string", enum: ["a", "b", "c", "d"] },
                text: { type: "string" },
              },
            },
          },
          correct_answer: { type: "string", enum: ["a", "b", "c", "d"] },
          explanation: { type: "string", description: "One or two sentences showing why the correct answer is right." },
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
  if (response.stop_reason === "refusal") {
    throw new Error("Request was declined by safety classifiers");
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty response");
  return JSON.parse(text);
}

/** Free local generation via Ollama's JSON-schema-constrained output. */
async function callOllama(prompt, schema, temperature) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: schema, // Ollama constrains output to this JSON schema
      // High for generation so batches differ; 0 for verification, where
      // the same question must produce the same answer every time.
      options: { temperature: temperature ?? 0.8 },
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
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.message?.content;
  if (!content) throw new Error("Empty response from Ollama");
  return JSON.parse(content);
}

async function callModel(prompt, schema, maxTokens, temperature, provider = PROVIDER) {
  return provider === "claude"
    ? callClaude(prompt, schema, maxTokens, temperature)
    : callOllama(prompt, schema, temperature);
}

async function preflight() {
  if (PROVIDER === "claude" || VERIFY_PROVIDER === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("No ANTHROPIC_API_KEY set; relying on an `ant auth login` profile.");
    }
    if (PROVIDER === "claude") return;
  }
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const { models } = await res.json();
    const names = (models || []).map((m) => m.name);
    if (!names.some((n) => n === OLLAMA_MODEL || n.startsWith(`${OLLAMA_MODEL}:`))) {
      console.error(
        `Ollama is running but "${OLLAMA_MODEL}" is not installed.\n` +
          `Installed: ${names.join(", ") || "(none)"}\n` +
          `Fix: ollama pull ${OLLAMA_MODEL}`
      );
      process.exit(1);
    }
  } catch {
    console.error(
      `Cannot reach Ollama at ${OLLAMA_URL}.\n` +
        `1. Install it from https://ollama.com\n` +
        `2. ollama pull ${OLLAMA_MODEL}\n` +
        `3. Re-run this script (Ollama serves automatically once installed).\n` +
        `Or use paid generation instead: --provider claude`
    );
    process.exit(1);
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

async function generateBatch(subtopic, topic, count, existingStems, { round = 0, type = "mcq" } = {}) {
  const avoid =
    existingStems.length > 0
      ? `\n\nAlready written, so do not repeat these or reword them:\n${existingStems
          .slice(-40)
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "";

  const angles = anglesFor(round, count)
    .map((a, i) => `${i + 1}. ${a}`)
    .join("\n");

  const shared = `You are writing exam questions for the ${CURRICULUM} subject "${SUBJECT}", ${topic}, subtopic "${subtopic}".

Each question must come at the subtopic from a DIFFERENT angle. Use these, in order:
${angles}

Requirements:
- Mix of difficulties: about 30% easy (recall or one step), 45% medium (two steps), 25% hard (multi-step, exam standard).
- marks: 1 for one step, 2 for two steps, 3 for multi-step. time_budget_seconds: roughly 45s per mark.
- Plain text maths only (x^2, 3/4, sqrt(x)); never LaTeX.
- Work the problem out before writing the answer, and make the explanation show the key step.
- Vary the surface: different quantities, contexts and phrasings, not the same sentence with new numbers.${avoid}`;

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
      .map((q) => ({ ...q, question_type: "short_answer" }));
  }

  const prompt = `${shared}

Write ${count} multiple-choice questions.
- Exactly 4 options (ids a-d), with distractors that are the answers a student would reach by making a specific, common mistake.
- Exactly one option is correct.
- Spread the correct option across a, b, c and d roughly evenly. Do not favour any letter.`;

  const data = await callModel(prompt, QUESTIONS_SCHEMA);
  return (data.questions || [])
    .filter((q) => q.options?.length === 4 && q.options.some((o) => o.id === q.correct_answer))
    .map((q) => ({ ...q, question_type: "mcq" }));
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
function askForAnswers(questions) {
  const listing = questions
    .map((q, i) =>
      q.question_type === "short_answer"
        ? `${i}. ${q.stem}`
        : `${i}. ${q.stem}\n   ${q.options.map((o) => `(${o.id}) ${o.text}`).join("  ")}`
    )
    .join("\n\n");

  return `Answer each question below. Work each one out fully before answering.

Give the answer only: a single letter for multiple choice, or the value alone for the rest. Include the unit where there is one. If a question cannot be answered from what it gives you, or has more than one defensible answer, set confident to false.

Questions:\n\n${listing}`;
}

/** Compare two answers the way a marker would, not the way a string does. */
function sameAnswer(a, b, kind) {
  if (a == null || b == null) return false;
  const left = normaliseText(String(a));
  const right = normaliseText(String(b));
  if (!left || !right) return false;
  if (left === right) return true;

  // Numbers compare by value, so 1.2e4, 12000 and "12000 m/s" all agree.
  const ln = parseNumber(left);
  const rn = parseNumber(right);
  if (ln != null && rn != null) return numbersMatch(ln, rn, 0.02);

  // Text answers: one being contained in the other covers "the mitochondria"
  // against "mitochondria" without accepting anything looser.
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

  const prompt = askForAnswers(questions);
  const passes = [];
  for (let i = 0; i < VERIFY_PASSES; i++) {
    const data = await callModel(prompt, SOLUTIONS_SCHEMA, undefined, 0, VERIFY_PROVIDER);
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

async function main() {
  const modelLabel = PROVIDER === "claude" ? MODEL : `${OLLAMA_MODEL} (local, free)`;
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

  const todo = LIMIT_SUBTOPICS > 0 ? subtopics.slice(0, LIMIT_SUBTOPICS) : subtopics;
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
    console.log(`\n${subtopic}: ${have}/${PER_SUBTOPIC}`);

    let consecutiveNoProgress = 0;
    let round = 0;
    while (have < PER_SUBTOPIC) {
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
            marks: q.marks,
            time_budget_seconds: q.time_budget_seconds,
            difficulty: Math.min(0.9, Math.max(0.1, q.difficulty)),
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
                    explanation, marks, time_budget_seconds, difficulty, source, verified)
                 VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17)
                 ON CONFLICT DO NOTHING`,
                [
                  row.curriculum, row.subject, row.topic, row.subtopic, row.question_type,
                  row.stem,
                  row.options ? JSON.stringify(row.options) : null,
                  row.correct_answer,
                  row.accepted_answers ? JSON.stringify(row.accepted_answers) : null,
                  row.answer_kind, row.answer_hint, row.explanation,
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
