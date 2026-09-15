/**
 * Download the guides you have chosen, then hand them to the ingester.
 *
 * The tedious half of collecting syllabus outlines is the downloading and
 * renaming, not the deciding. This does that half: give it a list of subjects
 * and URLs and it fetches each one, checks it really is a PDF, names it after
 * the subject, and skips anything it already has.
 *
 * The deciding half stays with you, deliberately. Where a syllabus comes from
 * is a question about whether you are allowed to have it, and that is not a
 * judgement to hand to a script crawling a search engine. Exam boards publish
 * these themselves:
 *
 *   AP        apcentral.collegeboard.org — Course and Exam Description per subject
 *   A-Level   aqa.org.uk, pearson.com, ocr.org.uk, wjec.co.uk — full specifications
 *   IB        your school, or the subject briefs on ibo.org
 *
 * Put the links in a file, one "Subject = URL" per line:
 *
 *   Physics SL = https://apcentral.collegeboard.org/media/pdf/ap-physics-1-ced.pdf
 *   Economics HL = https://www.aqa.org.uk/.../specification.pdf
 *
 * Usage:
 *   node scripts/fetch-guides.mjs --list guides/sources.txt
 *   node scripts/fetch-guides.mjs --list guides/sources.txt --to ~/Downloads/guides
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const LIST = arg("list", "guides/sources.txt");
const TO = arg("to", "guides/pdf");

if (!fs.existsSync(LIST)) {
  console.error(
    `No list at ${LIST}.\n\n` +
      `Make one with a line per subject:\n` +
      `  Physics SL = https://example.org/physics-guide.pdf\n`
  );
  process.exit(1);
}

const slugify = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

const entries = fs
  .readFileSync(LIST, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const at = l.indexOf("=");
    if (at < 0) return null;
    return { subject: l.slice(0, at).trim(), url: l.slice(at + 1).trim() };
  })
  .filter((e) => e && e.subject && /^https?:\/\//i.test(e.url));

if (!entries.length) {
  console.error(`Nothing usable in ${LIST}. Lines look like:\n  Physics SL = https://…/guide.pdf`);
  process.exit(1);
}

fs.mkdirSync(TO, { recursive: true });
console.log(`${entries.length} to fetch into ${TO}/\n`);

let got = 0;
let skipped = 0;
const failed = [];

for (const { subject, url } of entries) {
  const target = path.join(TO, `${slugify(subject)}.pdf`);
  if (fs.existsSync(target)) {
    console.log(`  have already  ${subject}`);
    skipped++;
    continue;
  }

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "psyllabus-guide-fetch/1.0" },
    });
    if (!res.ok) {
      failed.push([subject, `HTTP ${res.status}`]);
      console.log(`  FAILED        ${subject} — HTTP ${res.status}`);
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());

    // A login wall or an error page returns 200 with HTML. Writing that as a
    // .pdf would fail later, somewhere less obvious, so it is caught here.
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      const looksHtml = buf.subarray(0, 400).toString("latin1").toLowerCase().includes("<html");
      failed.push([subject, looksHtml ? "got a web page, not a PDF (login wall?)" : "not a PDF"]);
      console.log(`  FAILED        ${subject} — ${looksHtml ? "a web page, not a PDF" : "not a PDF"}`);
      continue;
    }

    fs.writeFileSync(target, buf);
    console.log(`  ${String(Math.round(buf.length / 1024)).padStart(5)}kb  ${subject}`);
    got++;
  } catch (e) {
    failed.push([subject, e.message]);
    console.log(`  FAILED        ${subject} — ${e.message}`);
  }
}

console.log(`\n${got} downloaded, ${skipped} already had, ${failed.length} failed.`);
if (failed.length) {
  console.log(`\nDownload these by hand and drop them in ${TO}/:`);
  for (const [subject, why] of failed) console.log(`  ${subject.padEnd(36)} ${why}`);
}
console.log(`\nThen:\n  node scripts/ingest-guides.mjs --from ${TO}`);
