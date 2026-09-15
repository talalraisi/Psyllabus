/**
 * Turn a folder of subject guide PDFs into the text files the remap reads.
 *
 * Drop the PDFs anywhere, point this at the folder, and it writes one .txt per
 * subject into guides/. It also does the tedious part: a subject guide is
 * mostly not syllabus. Forty pages of introduction, assessment outline, TOK
 * links, IA criteria and appendices surround the part that actually lists the
 * content, and feeding all of it to the mapper buries the statements that
 * matter in text that does not.
 *
 * So it finds where the syllabus content begins and ends, keeps that, and says
 * how much it threw away — because a heuristic that silently discarded the
 * wrong half would be worse than no heuristic at all. If the trim looks wrong,
 * --whole keeps everything and you can cut it by hand.
 *
 * Matching a file to a subject is by name, loosely, and anything it cannot
 * place is listed rather than guessed at.
 *
 * Usage:
 *   node scripts/ingest-guides.mjs --from ~/Downloads/ib-guides
 *   node scripts/ingest-guides.mjs --from ~/Downloads/ib-guides --whole
 *   node scripts/ingest-guides.mjs --from ~/Downloads/ib-guides --only "Physics SL"
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const FROM = arg("from", null);
const OUT = arg("out", "guides");
const ONLY = arg("only", null);
const WHOLE = flag("whole");

if (!FROM) {
  console.error("Pass --from ~/Downloads/ib-guides");
  process.exit(1);
}

/** The filename a subject's outline lives under. */
const slugify = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/** Loose comparison: case, punctuation and level words all vary between sources. */
const normalise = (s) =>
  s
    .toLowerCase()
    .replace(/\.pdf$/, "")
    .replace(/\b(guide|subject|syllabus|first assessment|\d{4})\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Where the syllabus actually starts and stops.
 *
 * Every board writes these differently, so this looks for the headings they
 * all use rather than a fixed page number. IB calls it "Syllabus content",
 * Cambridge and AQA call it "Subject content", College Board calls the units
 * "Course Framework" or "Unit 1:".
 */
const START = [
  /^\s*syllabus content\s*$/im,
  /^\s*subject content\s*$/im,
  /^\s*course (content|framework)\s*$/im,
  /^\s*content of the course\s*$/im,
  /^\s*3\.?\s*subject content/im,
  /^\s*unit 1[:.]/im,
  /^\s*topic 1[:.]/im,
];
const END = [
  /^\s*assessment outline\s*$/im,
  /^\s*internal assessment\s*$/im,
  /^\s*external assessment\s*$/im,
  /^\s*assessment objectives in practice\s*$/im,
  /^\s*appendices?\s*$/im,
  /^\s*glossary of command terms\s*$/im,
  /^\s*scheme of assessment\s*$/im,
];

function trimToSyllabus(text) {
  let from = 0;
  let startLen = 0;
  for (const re of START) {
    const m = text.match(re);
    if (m && m.index != null) {
      from = m.index;
      startLen = m[0].length;
      break;
    }
  }

  // Search from just past the start heading, not from a fixed offset into the
  // body. A flat +500 was skipping the end marker entirely whenever the
  // syllabus section was shorter than that — which it is for any subject with
  // a compact content list, and the result was the whole assessment section
  // pasted onto the end of the map's input.
  //
  // No offset is needed beyond the heading itself: these end headings only
  // appear on their own line, and never inside a list of content statements.
  const searchFrom = from + startLen;
  let to = text.length;
  for (const re of END) {
    const m = text.slice(searchFrom).match(re);
    if (m && m.index != null) to = Math.min(to, searchFrom + m.index);
  }
  return { body: text.slice(from, to), from, to };
}

function extract(file) {
  try {
    return execFileSync("pdftotext", ["-layout", "-nopgbrk", file, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(FROM)) {
    console.error(`No such folder: ${FROM}`);
    process.exit(1);
  }

  const db = await connect();
  const { rows } = await db.query(
    `SELECT DISTINCT subject, curriculum FROM syllabus_content ORDER BY subject`
  );
  const subjects = rows.map((r) => ({ ...r, key: normalise(r.subject) }));

  const files = fs
    .readdirSync(FROM)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(FROM, f));

  if (!files.length) {
    console.error(`No PDFs in ${FROM}`);
    process.exit(1);
  }

  console.log(`${files.length} PDFs, ${subjects.length} subjects in the database.\n`);
  fs.mkdirSync(OUT, { recursive: true });

  const unmatched = [];
  let written = 0;

  for (const file of files) {
    const base = path.basename(file);
    const key = normalise(base);

    // Longest matching subject name wins, so "Physics HL" beats "Physics".
    const hit = subjects
      .filter((s) => key.includes(s.key) || s.key.includes(key))
      .sort((a, b) => b.key.length - a.key.length)[0];

    if (!hit) {
      unmatched.push(base);
      continue;
    }
    if (ONLY && hit.subject !== ONLY) continue;

    const text = extract(file);
    if (!text) {
      console.log(`  could not read   ${base}`);
      continue;
    }

    const { body } = WHOLE ? { body: text } : trimToSyllabus(text);
    const kept = Math.round((body.length / text.length) * 100);
    const target = path.join(OUT, `${slugify(hit.subject)}.txt`);
    fs.writeFileSync(target, body.trim());
    written++;

    const warn =
      !WHOLE && (kept < 8 || kept > 92)
        ? `  ← check this one, the trim kept ${kept}% which is suspicious`
        : "";
    console.log(
      `  ${hit.subject.padEnd(40)} ${String(Math.round(body.length / 1000)).padStart(4)}k chars  (${kept}% of the PDF)${warn}`
    );
  }

  console.log(`\n${written} written to ${OUT}/`);

  if (unmatched.length) {
    console.log(`\n${unmatched.length} could not be matched to a subject:`);
    for (const u of unmatched.slice(0, 20)) console.log(`  ${u}`);
    console.log(
      `\nRename them to match the subject name in the app, or move them aside.` +
        `\nThe names the app uses are in syllabus_content.subject.`
    );
  }

  console.log(
    `\nNext, per subject:\n  node scripts/remap-syllabus.mjs --subject "Physics SL" --source ${OUT}/physics-sl.txt`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
