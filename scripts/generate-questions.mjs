/**
 * Question bank generation pipeline.
 *
 * For every subtopic of a subject, generates verified MCQs with Claude until the
 * subtopic reaches the target count, verifies each batch in an independent pass,
 * and inserts only questions that survive verification into Supabase.
 *
 * Requirements (in .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (Supabase dashboard -> Settings -> API; never commit it)
 *   ANTHROPIC_API_KEY           (console.anthropic.com; or `ant auth login`)
 *
 * Usage:
 *   node scripts/generate-questions.mjs --subject "Math Analysis & Approaches HL" --per-subtopic 100
 *   node scripts/generate-questions.mjs --subject "Physics SL" --per-subtopic 50 --limit-subtopics 5
 */

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

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
const BATCH_SIZE = 20; // questions per API call
const MODEL = "claude-opus-5";

// Load .env.local without a dotenv dependency
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const anthropic = new Anthropic(); // resolves ANTHROPIC_API_KEY / ant profile

// ---------------------------------------------------------------------------
// Schemas for structured outputs
// ---------------------------------------------------------------------------

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

const VERDICTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "sound", "reason"],
        properties: {
          index: { type: "integer" },
          sound: {
            type: "boolean",
            description:
              "true only if the marked answer is mathematically/factually correct, exactly one option is correct, and the question is unambiguous",
          },
          reason: { type: "string" },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Claude calls
// ---------------------------------------------------------------------------

async function callClaude(prompt, schema, maxTokens = 16000) {
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
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

async function generateBatch(subtopic, topic, count, existingStems) {
  const avoid =
    existingStems.length > 0
      ? `\n\nDo NOT duplicate or closely paraphrase any of these existing questions:\n${existingStems
          .slice(-40)
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "";

  const prompt = `You are writing exam questions for the IB Diploma Programme subject "${SUBJECT}", ${topic}, subtopic "${subtopic}".

Write ${count} multiple-choice questions testing this exact subtopic at IB exam standard. Requirements:
- Mix of difficulties: about 30% easy (recall/one-step), 45% medium (two-step application), 25% hard (multi-step, exam-style).
- Each question has exactly 4 options (ids a-d) with plausible distractors based on common student errors.
- Exactly one option is correct. Verify each answer by working the problem before writing the options.
- marks: 1 for one-step, 2 for two-step, 3 for multi-step. time_budget_seconds: roughly 45s per mark, matching real IB pacing.
- Plain text math only (x^2, 3/4, sqrt(x)); no LaTeX.
- Explanations show the key working in one or two sentences.${avoid}`;

  const data = await callClaude(prompt, QUESTIONS_SCHEMA);
  return (data.questions || []).filter(
    (q) =>
      q.options?.length === 4 &&
      q.options.some((o) => o.id === q.correct_answer)
  );
}

async function verifyBatch(questions) {
  const listing = questions
    .map(
      (q, i) =>
        `${i}. ${q.stem}\n   Options: ${q.options
          .map((o) => `(${o.id}) ${o.text}`)
          .join("  ")}\n   Marked correct: (${q.correct_answer})`
    )
    .join("\n\n");

  const prompt = `You are the verification layer of an exam question bank. For each question below, independently solve it from scratch, then judge it.

Mark sound=false if ANY of these hold: the marked answer is wrong; more than one option is correct; no option is correct; the question is ambiguous or unanswerable; the question does not fit an IB multiple-choice format.

Questions:\n\n${listing}`;

  const data = await callClaude(prompt, VERDICTS_SCHEMA);
  const badIndices = new Set(
    (data.verdicts || []).filter((v) => !v.sound).map((v) => v.index)
  );
  for (const v of data.verdicts || []) {
    if (!v.sound) console.log(`    rejected #${v.index}: ${v.reason}`);
  }
  return questions.filter((_, i) => !badIndices.has(i));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Subject: ${SUBJECT} | target ${PER_SUBTOPIC}/subtopic | model ${MODEL}`);

  const { data: subtopics, error } = await supabase
    .from("syllabus_content")
    .select("topic, subtopic")
    .eq("subject", SUBJECT)
    .order("topic");
  if (error) throw error;
  if (!subtopics?.length) {
    console.error(`No syllabus_content rows for subject "${SUBJECT}". Seed the syllabus first.`);
    process.exit(1);
  }

  const todo = LIMIT_SUBTOPICS > 0 ? subtopics.slice(0, LIMIT_SUBTOPICS) : subtopics;
  let totalInserted = 0;

  for (const { topic, subtopic } of todo) {
    const { data: existing } = await supabase
      .from("questions")
      .select("stem")
      .eq("subject", SUBJECT)
      .eq("subtopic", subtopic);

    const existingStems = (existing || []).map((q) => q.stem);
    let have = existingStems.length;
    console.log(`\n${subtopic}: ${have}/${PER_SUBTOPIC}`);

    while (have < PER_SUBTOPIC) {
      const want = Math.min(BATCH_SIZE, PER_SUBTOPIC - have);
      try {
        const generated = await generateBatch(subtopic, topic, want, existingStems);
        console.log(`  generated ${generated.length}, verifying...`);
        const verified = await verifyBatch(generated);
        console.log(`  ${verified.length}/${generated.length} passed verification`);

        if (verified.length > 0) {
          const rows = verified.map((q) => ({
            curriculum: "IB",
            subject: SUBJECT,
            topic,
            subtopic,
            stem: q.stem,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            marks: q.marks,
            time_budget_seconds: q.time_budget_seconds,
            difficulty: Math.min(0.9, Math.max(0.1, q.difficulty)),
            source: "ai-generated",
            verified: true,
          }));
          const { error: insertError } = await supabase.from("questions").insert(rows);
          if (insertError) throw insertError;
          have += rows.length;
          totalInserted += rows.length;
          existingStems.push(...rows.map((r) => r.stem));
        } else {
          console.log("  batch fully rejected, retrying");
        }
      } catch (err) {
        console.error(`  batch failed: ${err.message}; waiting 20s`);
        await new Promise((r) => setTimeout(r, 20000));
      }
    }
  }

  console.log(`\nDone. Inserted ${totalInserted} new verified questions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
