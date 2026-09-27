/**
 * Write out the syllabus map, one file per subject.
 *
 * The map lives in the database and nowhere a person can read it, which means
 * nobody has ever checked it against a real guide. 7,939 IB subtopics were
 * imported once and have been trusted ever since.
 *
 * Two outputs, because they answer different questions:
 *
 *   syllabus/<curriculum>/<subject>.md    for reading. Every topic and every
 *                                         subtopic, in order, with HL-only
 *                                         content marked. This is what you
 *                                         hold next to the real guide.
 *
 *   context/<curriculum>/<subject>.json   for filling in. The same tree, in
 *                                         the shape docs/syllabus-context-spec.md
 *                                         describes, with every context field
 *                                         null and waiting. Fill these and the
 *                                         loader has something to load.
 *
 * Usage:
 *   node scripts/export-syllabus.mjs                  everything
 *   node scripts/export-syllabus.mjs --curriculum IB
 *   node scripts/export-syllabus.mjs --subject "Physics SL"
 *   node scripts/export-syllabus.mjs --mine           the six on your profile
 */

import fs from "node:fs";
import path from "node:path";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const MINE = [
  "Math Analysis & Approaches HL",
  "Computer Science HL",
  "Economics HL",
  "Physics SL",
  "English A: Language & Literature SL",
  "Arabic A: Literature SL",
];

/** A filename that survives a subject called "English A: Language & Lit SL". */
function slug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Which folder a subject belongs in, from its own name. */
function curriculumOf(subject, stored) {
  if (stored && stored !== "IB") return stored;
  if (/^AP /.test(subject)) return "AP";
  if (/A-Level/i.test(subject)) return "A-Level";
  return stored || "IB";
}

const sql = await connect();

const where = [];
const params = [];
if (args.includes("--mine")) {
  params.push(MINE);
  where.push(`subject = ANY($${params.length})`);
} else if (arg("subject")) {
  params.push(arg("subject"));
  where.push(`subject = $${params.length}`);
}
if (arg("curriculum")) {
  const c = arg("curriculum");
  if (c === "IB") where.push(`subject NOT LIKE 'AP %' AND subject NOT LIKE '%A-Level%'`);
  else if (c === "AP") where.push(`subject LIKE 'AP %'`);
  else if (c === "A-Level") where.push(`subject LIKE '%A-Level%'`);
}

const rows = (
  await sql.query(
    `SELECT curriculum, subject, topic, unit, code, subtopic, hl_only, hl_extension, position
       FROM syllabus_content
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY subject, topic, position, code, subtopic`,
    params
  )
).rows;

if (!rows.length) {
  console.log("Nothing matched.");
  await sql.end();
  process.exit(0);
}

// group: subject -> topic -> [subtopics]
const bySubject = new Map();
for (const r of rows) {
  if (!bySubject.has(r.subject)) bySubject.set(r.subject, new Map());
  const topics = bySubject.get(r.subject);
  const key = r.topic || r.unit || "(no topic)";
  if (!topics.has(key)) topics.set(key, []);
  topics.get(key).push(r);
}

let mdCount = 0;
let jsonCount = 0;

for (const [subject, topics] of bySubject) {
  const cur = curriculumOf(subject, rows.find((r) => r.subject === subject)?.curriculum);
  const file = slug(subject);
  const total = [...topics.values()].reduce((n, t) => n + t.length, 0);
  const hlOnly = [...topics.values()].flat().filter((r) => r.hl_only).length;

  // ---------------------------------------------------------------- markdown
  const md = [];
  md.push(`# ${subject}`);
  md.push("");
  md.push(`${curriculumOf(subject)} · ${topics.size} topics · ${total} subtopics` +
    (hlOnly ? ` · ${hlOnly} HL only` : ""));
  md.push("");
  md.push(`This is what Project Syllabus has mapped for this subject, exactly as`);
  md.push(`it sits in the database. Hold it next to the official guide and mark`);
  md.push(`anything missing, renamed or no longer examined.`);
  md.push("");
  for (const [topic, items] of topics) {
    md.push(`## ${topic}`);
    md.push("");
    for (const it of items) {
      const bits = [];
      if (it.code) bits.push(`\`${it.code}\``);
      bits.push(it.subtopic);
      const tags = [];
      if (it.hl_only) tags.push("HL only");
      if (it.hl_extension) tags.push("HL extension");
      md.push(`- ${bits.join(" ")}${tags.length ? `  _(${tags.join(", ")})_` : ""}`);
    }
    md.push("");
  }
  const mdDir = path.join("syllabus", cur);
  fs.mkdirSync(mdDir, { recursive: true });
  fs.writeFileSync(path.join(mdDir, `${file}.md`), md.join("\n"));
  mdCount++;

  // -------------------------------------------------------------------- json
  const doc = {
    subject_context: {
      subject,
      curriculum: cur,
      papers: null,
      command_terms: null,
      assessment_objectives: null,
      markscheme_style: null,
      calculator: null,
      data_booklet: null,
      internal_assessment: null,
      notes: null,
    },
    subtopics: [...topics.entries()].flatMap(([topic, items]) =>
      items.map((it) => ({
        subject,
        topic,
        code: it.code,
        title: it.subtopic,
        hl_only: it.hl_only || false,
        understandings: null,
        skills: null,
        exclusions: null,
        command_terms: null,
        ao_mix: null,
        formulae: null,
        papers: null,
        typical_marks: null,
        misconceptions: null,
        prerequisites: null,
        vocabulary: null,
        worked_example: null,
        confidence: null,
        sources: null,
      }))
    ),
  };
  const jsonDir = path.join("context", cur);
  fs.mkdirSync(jsonDir, { recursive: true });
  fs.writeFileSync(path.join(jsonDir, `${file}.json`), JSON.stringify(doc, null, 2));
  jsonCount++;
}

// ------------------------------------------------------------------- index
const index = ["# Every subject mapped", "", `${bySubject.size} subjects · ${rows.length} subtopics`, ""];
const byCur = new Map();
for (const [subject, topics] of bySubject) {
  const cur = curriculumOf(subject, rows.find((r) => r.subject === subject)?.curriculum);
  if (!byCur.has(cur)) byCur.set(cur, []);
  byCur.get(cur).push([subject, [...topics.values()].reduce((n, t) => n + t.length, 0), topics.size]);
}
for (const [cur, list] of [...byCur].sort()) {
  index.push(`## ${cur}`, "");
  index.push(`| subject | topics | subtopics |`, `| --- | ---: | ---: |`);
  for (const [subject, n, t] of list.sort((a, b) => a[0].localeCompare(b[0]))) {
    index.push(`| [${subject}](${cur}/${slug(subject)}.md) | ${t} | ${n} |`);
  }
  index.push("");
}
fs.mkdirSync("syllabus", { recursive: true });
fs.writeFileSync(path.join("syllabus", "README.md"), index.join("\n"));

console.log(`${mdCount} readable files  -> syllabus/`);
console.log(`${jsonCount} context skeletons -> context/`);
console.log(`${rows.length} subtopics across ${bySubject.size} subjects`);
await sql.end();
