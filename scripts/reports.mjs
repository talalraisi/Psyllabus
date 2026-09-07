/**
 * What students have reported, worst first.
 *
 * Three separate people reporting the same question takes it down on its own,
 * so this queue is not an alarm: it is where you find out what is wrong with
 * the bank before it gets that far, and which subject the generator is quietly
 * failing at.
 *
 * Usage:
 *   node scripts/reports.mjs
 *   node scripts/reports.mjs --subject "Physics SL"
 *   node scripts/reports.mjs --resolve <question-id>    keep it down, stop asking
 *   node scripts/reports.mjs --restore <question-id>    it was fine, republish
 */

import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SUBJECT = arg("subject", null);
const RESOLVE = arg("resolve", null);
const RESTORE = arg("restore", null);

async function main() {
  const db = await connect();

  if (RESOLVE) {
    await db.query(
      "UPDATE question_reports SET resolved_at = now() WHERE question_id = $1 AND resolved_at IS NULL",
      [RESOLVE]
    );
    await db.query("UPDATE questions SET verified = false WHERE id = $1", [RESOLVE]);
    console.log("Marked resolved and left unpublished.");
    process.exit(0);
  }

  if (RESTORE) {
    await db.query(
      "UPDATE question_reports SET resolved_at = now() WHERE question_id = $1 AND resolved_at IS NULL",
      [RESTORE]
    );
    await db.query("UPDATE questions SET verified = true WHERE id = $1", [RESTORE]);
    console.log("Republished, and the open reports on it are closed.");
    process.exit(0);
  }

  const params = [];
  let filter = "";
  if (SUBJECT) {
    params.push(SUBJECT);
    filter = `AND q.subject = $${params.length}`;
  }

  const { rows } = await db.query(
    `SELECT q.id, q.subject, q.subtopic, q.stem, q.verified,
            count(DISTINCT r.user_id) AS reporters,
            array_agg(DISTINCT r.reason) AS reasons,
            array_remove(array_agg(r.note), NULL) AS notes
     FROM question_reports r
     JOIN questions q ON q.id = r.question_id
     WHERE r.resolved_at IS NULL ${filter}
     GROUP BY q.id
     ORDER BY count(DISTINCT r.user_id) DESC, max(r.created_at) DESC
     LIMIT 50`,
    params
  );

  if (!rows.length) {
    console.log("Nothing reported.");
    process.exit(0);
  }

  console.log(`${rows.length} question${rows.length === 1 ? "" : "s"} with open reports.\n`);
  for (const r of rows) {
    const state = r.verified ? "live" : "DOWN";
    console.log(`[${state}] ${r.reporters} report(s) · ${r.subject} · ${r.subtopic}`);
    console.log(`  ${r.stem.slice(0, 100)}${r.stem.length > 100 ? "…" : ""}`);
    console.log(`  reasons: ${r.reasons.join(", ")}`);
    for (const note of r.notes) console.log(`  note: ${note}`);
    console.log(`  id: ${r.id}\n`);
  }

  // Which subject is generating badly is more useful than which question is
  // bad: one question is a fix, a subject is a decision about the model.
  const { rows: bySubject } = await db.query(
    `SELECT q.subject, count(DISTINCT r.question_id) AS reported
     FROM question_reports r JOIN questions q ON q.id = r.question_id
     WHERE r.resolved_at IS NULL
     GROUP BY q.subject ORDER BY 2 DESC`
  );
  if (bySubject.length > 1) {
    console.log("By subject:");
    for (const s of bySubject) {
      console.log(`  ${s.subject.padEnd(36)} ${s.reported}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
