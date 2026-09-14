/**
 * Rewrite a subject's subtopic map so every entry is one assessable thing.
 *
 * The current map has subtopics like "Themes and motifs across different works
 * and text types", which is four things joined by "and" and cannot be quizzed
 * as one. Others are two words with no indication of what is actually being
 * assessed. Forty-four of the 173 subjects have fewer than twenty subtopics in
 * total, which for a two-year course is not a map, it is a table of contents.
 *
 * What this does NOT do is quietly replace one map with another. A wrong
 * syllabus is worse than a thin one: a student revising from it fails the
 * parts nobody told them about, and neither of us would be able to tell by
 * looking. So:
 *
 *   - It never deletes a subtopic that has questions, progress or flashcards
 *     attached to it. Those names stay exactly as they are and the new
 *     material is added around them.
 *   - It writes a proposal to a file and stops. Nothing reaches the database
 *     until you have read it and run it again with --apply.
 *   - It takes the real syllabus outline as input when you have one
 *     (--source), and says loudly when you have not, because a model writing
 *     an IB syllabus from memory is writing a plausible one, not the real one.
 *
 * Usage:
 *   node scripts/remap-syllabus.mjs --subject "Physics SL"
 *   node scripts/remap-syllabus.mjs --subject "Physics SL" --source guides/physics-sl.txt
 *   node scripts/remap-syllabus.mjs --subject "Physics SL" --apply
 */

import fs from "node:fs";
import path from "node:path";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const SUBJECT = arg("subject", null);
const SOURCE = arg("source", null);
const APPLY = flag("apply");
const MODEL = arg("model", "qwen2.5:32b");
const OLLAMA = arg("ollama-url", "http://localhost:11434");
const OUT_DIR = arg("out", "syllabus-proposals");

if (!SUBJECT) {
  console.error('Pass --subject "Physics SL".');
  process.exit(1);
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topics"],
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "subtopics"],
        properties: {
          topic: { type: "string" },
          subtopics: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["subtopic", "hl_only"],
              properties: {
                subtopic: { type: "string" },
                hl_only: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
};

async function ask(prompt, schema) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: schema,
      options: { temperature: 0, num_ctx: 16384 },
      think: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return JSON.parse((await res.json()).message.content);
}

/** One assessable thing, or not? Used to report on the result, not to fix it. */
const JOINED = /(,|\/| and )/i;
const VAGUE =
  /^(introduction|overview|basics|fundamentals|concepts|key (ideas|concepts)|other|misc|general|topics?|unit \d+|further)\b/i;

async function main() {
  const db = await connect();

  const { rows: existing } = await db.query(
    `SELECT topic, subtopic, hl_only FROM syllabus_content
     WHERE subject = $1 ORDER BY topic, subtopic`,
    [SUBJECT]
  );
  if (!existing.length) {
    console.error(`No syllabus rows for "${SUBJECT}". Check the exact name.`);
    process.exit(1);
  }
  const { rows: curriculumRow } = await db.query(
    `SELECT DISTINCT curriculum FROM syllabus_content WHERE subject = $1`,
    [SUBJECT]
  );
  const curriculum = curriculumRow[0]?.curriculum || "IB";

  // Anything a student has already touched, or that carries questions, is
  // load-bearing. Those names are kept verbatim whatever the model suggests.
  const { rows: pinnedRows } = await db.query(
    `SELECT subtopic FROM questions WHERE subject = $1
     UNION SELECT subtopic FROM progress WHERE subject = $1
     UNION SELECT subtopic FROM flashcards WHERE subject = $1 AND subtopic IS NOT NULL`,
    [SUBJECT]
  );
  const pinned = new Set(pinnedRows.map((r) => r.subtopic));

  const source = SOURCE ? fs.readFileSync(SOURCE, "utf8").slice(0, 40000) : null;

  console.log(`${SUBJECT} (${curriculum})`);
  console.log(`  ${existing.length} subtopics now, across ${new Set(existing.map((r) => r.topic)).size} topics`);
  console.log(`  ${pinned.size} of them are load-bearing and will be kept verbatim`);
  console.log(`  source outline: ${source ? SOURCE : "NONE — see the warning at the end"}`);
  console.log(`  model: ${MODEL}\n`);

  const prompt = `You are mapping the ${curriculum} syllabus for ${SUBJECT} into a list of assessable subtopics.

${source ? `Use ONLY the official outline below. Do not add anything that is not in it.\n\n--- OFFICIAL OUTLINE ---\n${source}\n--- END ---\n` : `Work from the published ${curriculum} subject guide for ${SUBJECT}.`}

Rules:
- One subtopic is ONE assessable idea. "Themes and motifs across different works and text types" is four subtopics, not one. Split anything joined by "and", a comma or a slash unless the joined phrase is a single named concept ("supply and demand", "mean and variance" are single concepts; "waves and optics" is not).
- A subtopic must be specific enough to write an exam question about. "Introduction", "Overview", "Key concepts" and "Further topics" are not subtopics.
- Use the wording of the guide, not a paraphrase.
- Mark hl_only true only for content that SL candidates are not assessed on.
- Keep these existing subtopic names EXACTLY as written, because student work is attached to them. Put each under the topic it belongs to, and add the missing material around them:
${[...pinned].map((p) => `  - ${p}`).join("\n") || "  (none)"}

Group into the topics the guide uses. Return every topic and every subtopic.`;

  process.stdout.write("  asking… ");
  const proposal = await ask(prompt, SCHEMA);
  console.log("done\n");

  const flat = [];
  for (const t of proposal.topics || []) {
    for (const st of t.subtopics || []) {
      flat.push({ topic: t.topic, subtopic: st.subtopic, hl_only: !!st.hl_only });
    }
  }

  // Whatever the model returned, every pinned name must survive.
  const returned = new Set(flat.map((r) => r.subtopic));
  const dropped = [...pinned].filter((p) => !returned.has(p));
  for (const d of dropped) {
    const old = existing.find((e) => e.subtopic === d);
    flat.push({ topic: old?.topic || "Unsorted", subtopic: d, hl_only: !!old?.hl_only, restored: true });
  }

  const joined = flat.filter((r) => JOINED.test(r.subtopic)).length;
  const vague = flat.filter((r) => VAGUE.test(r.subtopic.trim())).length;
  const dupes = flat.length - new Set(flat.map((r) => r.subtopic.toLowerCase().trim())).size;

  console.log(`  proposed: ${flat.length} subtopics across ${(proposal.topics || []).length} topics`);
  console.log(`  was:      ${existing.length} subtopics`);
  console.log(`  still joined by and/comma/slash: ${joined}`);
  console.log(`  still vague: ${vague}`);
  console.log(`  duplicates: ${dupes}`);
  if (dropped.length) console.log(`  restored ${dropped.length} load-bearing names the model dropped`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${SUBJECT.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ subject: SUBJECT, curriculum, source: SOURCE || null, model: MODEL, existing, proposal: flat }, null, 2)
  );
  console.log(`\n  written to ${file}`);

  if (!APPLY) {
    console.log("\nNothing written to the database. Read the file, then re-run with --apply.");
    if (!source) {
      console.log(
        `\n  WARNING: no --source outline was given, so this map is what ${MODEL} believes\n` +
          `  the ${curriculum} ${SUBJECT} syllabus to be. That is a plausible syllabus, not\n` +
          `  necessarily the real one. Check it against your subject guide before applying,\n` +
          `  or re-run with --source pointing at the guide's contents.`
      );
    }
    process.exit(0);
  }

  // Additive. Nothing is deleted, so nothing can be orphaned.
  let added = 0;
  for (const r of flat) {
    const res = await db.query(
      `INSERT INTO syllabus_content (curriculum, subject, topic, subtopic, hl_only)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (curriculum, subject, subtopic) DO UPDATE SET topic = EXCLUDED.topic
       RETURNING (xmax = 0) AS inserted`,
      [curriculum, SUBJECT, r.topic, r.subtopic, r.hl_only]
    );
    if (res.rows[0]?.inserted) added++;
  }
  const { rows: after } = await db.query(
    `SELECT count(*)::int n FROM syllabus_content WHERE subject = $1`,
    [SUBJECT]
  );
  console.log(`\n  applied: ${added} new subtopics, ${after[0].n} in total. Nothing deleted.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
