/**
 * Replace a course's subtopic map with a reviewed outline, without losing work.
 *
 * The maps we imported at the start were thin and, in places, wrong: Physics SL
 * listed four option topics that the 2025 guide removed, and Maths AA listed
 * Poisson and transition matrices, which belong to a different course. A
 * student revising from that map revises the wrong subject.
 *
 * Replacing a map is not the same as writing one. Questions, flashcards,
 * progress and mistakes all point at a subtopic by name, so a rename that
 * ignores them silently orphans hundreds of questions. So every outline carries
 * a `merge` map — old name to new name — and everything attached to the old
 * name is moved before the old row goes. Anything not named in `merge` and not
 * in `retire` is kept as it is, because a subtopic somebody has worked on is
 * not something to delete on a hunch.
 *
 * Nothing is written without --apply, and --apply writes a backup of every row
 * it is about to change first.
 *
 * Usage:
 *   node scripts/apply-outline.mjs --file data/syllabus/physics.json
 *   node scripts/apply-outline.mjs --all
 *   node scripts/apply-outline.mjs --file data/syllabus/physics.json --apply
 */

import fs from "node:fs";
import path from "node:path";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const DIR = "data/syllabus";
const FILE = arg("file");
const ALL = flag("all");
const APPLY = flag("apply");
const OUT_DIR = arg("out", "syllabus-proposals");

if (!FILE && !ALL) {
  console.error("Pass --file data/syllabus/physics.json, or --all.");
  process.exit(1);
}

/** Tables that name a subtopic and must follow a rename. */
const ATTACHED = [
  { table: "questions", hasTopic: true },
  { table: "flashcards", hasTopic: true },
  { table: "flashcard_presets", hasTopic: true },
  { table: "notes", hasTopic: true },
  { table: "progress", hasTopic: true },
  { table: "quiz_attempts", hasTopic: true },
  { table: "resources", hasTopic: true },
  { table: "mastery_credits", hasTopic: false },
];

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** Every row the outline says a given subject should have. */
function rowsFor(outline, level) {
  const rows = [];
  // Position counts through the whole subject in guide order, so the app can
  // show kinematics before momentum instead of sorting the course by name.
  let position = 0;
  for (const { topic, units } of outline.topics) {
    for (const { code, unit, subtopics } of units) {
      for (const [subtopic, lvl] of subtopics) {
        if (level === "sl" && lvl === "hl") continue;
        rows.push({
          topic,
          unit,
          code,
          subtopic,
          position: position++,
          hl_only: level === "hl" && lvl === "hl",
          hl_extension: level === "hl" && lvl === "ext",
        });
      }
    }
  }
  return rows;
}

async function attachedCounts(db, subject) {
  const counts = new Map(); // subtopic -> { table: n }
  for (const { table } of ATTACHED) {
    const { rows } = await db.query(
      `SELECT subtopic, count(*)::int n FROM ${table} WHERE subject = $1 GROUP BY subtopic`,
      [subject]
    );
    for (const r of rows) {
      if (!r.subtopic) continue;
      const entry = counts.get(r.subtopic) || {};
      entry[table] = r.n;
      counts.set(r.subtopic, entry);
    }
  }
  return counts;
}

const totalOf = (entry) => Object.values(entry || {}).reduce((a, b) => a + b, 0);

async function planSubject(db, outline, subject, level) {
  const wanted = rowsFor(outline, level);
  const wantedByName = new Map(wanted.map((r) => [r.subtopic, r]));

  const { rows: current } = await db.query(
    `SELECT topic, subtopic, hl_only FROM syllabus_content WHERE subject = $1`,
    [subject]
  );
  const currentByName = new Map(current.map((r) => [r.subtopic, r]));
  const work = await attachedCounts(db, subject);

  const merge = outline.merge || {};
  const retire = outline.retire || {};

  const plan = {
    subject,
    level,
    curriculum: outline.curriculum,
    add: [],
    keep: [],
    moves: [], // { from, to, counts }
    remove: [], // { subtopic, why }
    orphans: [], // kept because work is attached and no destination was given
    changeFlags: [], // { subtopic, from, to }
  };

  for (const r of wanted) {
    const existing = currentByName.get(r.subtopic);
    if (!existing) plan.add.push(r);
    else {
      plan.keep.push(r);
      if (existing.hl_only !== r.hl_only) {
        plan.changeFlags.push({
          subtopic: r.subtopic,
          from: existing.hl_only ? "HL only" : "shared",
          to: r.hl_only ? "HL only" : "shared",
        });
      }
    }
  }

  for (const r of current) {
    if (wantedByName.has(r.subtopic)) continue;
    const destination = merge[r.subtopic];
    const attached = work.get(r.subtopic);
    if (destination && wantedByName.has(destination)) {
      if (totalOf(attached)) plan.moves.push({ from: r.subtopic, to: destination, counts: attached });
      plan.remove.push({ subtopic: r.subtopic, why: `merged into "${destination}"` });
    } else if (totalOf(attached)) {
      plan.orphans.push({ subtopic: r.subtopic, counts: attached });
    } else {
      plan.remove.push({
        subtopic: r.subtopic,
        why: retire[r.subtopic] || (destination ? `merge target "${destination}" is not in the outline` : "not in the outline"),
      });
    }
  }

  return plan;
}

function printPlan(p) {
  const n = (x) => String(x).padStart(3, " ");
  console.log(`\n${p.subject}`);
  console.log(`  ${n(p.add.length)} new subtopics`);
  console.log(`  ${n(p.keep.length)} unchanged`);
  console.log(`  ${n(p.remove.length)} removed`);
  if (p.moves.length) {
    console.log(`  ${n(p.moves.length)} carrying work, moved:`);
    for (const m of p.moves) {
      const what = Object.entries(m.counts)
        .map(([t, c]) => `${c} ${t}`)
        .join(", ");
      console.log(`        "${m.from}" -> "${m.to}"  (${what})`);
    }
  }
  if (p.changeFlags.length) {
    console.log(`  ${n(p.changeFlags.length)} HL/SL corrections:`);
    for (const c of p.changeFlags) console.log(`        ${c.subtopic}: ${c.from} -> ${c.to}`);
  }
  if (p.orphans.length) {
    console.log(`  ${n(p.orphans.length)} KEPT because work is attached and no destination was given:`);
    for (const o of p.orphans) {
      const what = Object.entries(o.counts)
        .map(([t, c]) => `${c} ${t}`)
        .join(", ");
      console.log(`        "${o.subtopic}" (${what}) — add it to merge, or it stays`);
    }
  }
}

async function applyPlan(db, plan) {
  await db.query("BEGIN");
  try {
    for (const m of plan.moves) {
      const topic = plan.topicOf.get(m.to);
      for (const { table, hasTopic } of ATTACHED) {
        if (hasTopic) {
          await db.query(
            `UPDATE ${table} SET subtopic = $1, topic = $2 WHERE subject = $3 AND subtopic = $4`,
            [m.to, topic, plan.subject, m.from]
          );
        } else {
          await db.query(`UPDATE ${table} SET subtopic = $1 WHERE subject = $2 AND subtopic = $3`, [
            m.to,
            plan.subject,
            m.from,
          ]);
        }
      }
    }
    for (const r of plan.remove) {
      await db.query(`DELETE FROM syllabus_content WHERE subject = $1 AND subtopic = $2`, [
        plan.subject,
        r.subtopic,
      ]);
    }
    // A subtopic that kept its name but moved to another topic: the old row
    // would otherwise survive under the old topic and show up twice.
    for (const r of [...plan.add, ...plan.keep]) {
      await db.query(
        `DELETE FROM syllabus_content WHERE subject = $1 AND subtopic = $2 AND topic <> $3`,
        [plan.subject, r.subtopic, r.topic]
      );
    }
    for (const r of [...plan.add, ...plan.keep]) {
      await db.query(
        `INSERT INTO syllabus_content
           (curriculum, subject, topic, unit, code, subtopic, position, hl_only, hl_extension)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (curriculum, subject, topic, subtopic) DO UPDATE
           SET unit = EXCLUDED.unit, code = EXCLUDED.code, position = EXCLUDED.position,
               hl_only = EXCLUDED.hl_only, hl_extension = EXCLUDED.hl_extension`,
        [
          plan.curriculum, plan.subject, r.topic, r.unit, r.code, r.subtopic,
          r.position, r.hl_only, r.hl_extension,
        ]
      );
    }
    // Questions and the rest carry their own copy of the topic name. Anything
    // whose subtopic now sits under a different topic is brought into line,
    // rather than left pointing at a topic that no longer exists.
    for (const { table, hasTopic } of ATTACHED) {
      if (!hasTopic) continue;
      await db.query(
        `UPDATE ${table} t SET topic = s.topic
           FROM syllabus_content s
          WHERE s.subject = t.subject AND s.subtopic = t.subtopic
            AND t.subject = $1 AND t.topic IS DISTINCT FROM s.topic`,
        [plan.subject]
      );
    }

    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
}

async function main() {
  const db = await connect();
  const files = ALL
    ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(DIR, f))
    : [FILE];

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = [];
  const plans = [];

  for (const file of files) {
    const outline = JSON.parse(fs.readFileSync(file, "utf8"));
    console.log(`\n=== ${outline.course} (${outline.guide})`);
    console.log(`    ${outline.confidence}`);

    for (const level of ["sl", "hl"]) {
      for (const subject of asList(outline.subjects[level])) {
        const { rows: exists } = await db.query(
          `SELECT 1 FROM syllabus_content WHERE subject = $1 LIMIT 1`,
          [subject]
        );
        if (!exists.length) {
          console.log(`\n${subject}\n  (not in the database — skipped)`);
          continue;
        }
        const plan = await planSubject(db, outline, subject, level);
        plan.topicOf = new Map([...plan.add, ...plan.keep].map((r) => [r.subtopic, r.topic]));
        printPlan(plan);
        plans.push(plan);

        const { rows: before } = await db.query(
          `SELECT topic, subtopic, hl_only FROM syllabus_content WHERE subject = $1`,
          [subject]
        );
        backup.push({ subject, rows: before });
      }
    }
  }

  const backupPath = path.join(OUT_DIR, `backup-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  if (!APPLY) {
    console.log(
      `\nNothing written. Current rows saved to ${backupPath}.\n` +
        `Run again with --apply when the plan above looks right.`
    );
    process.exit(0);
  }

  for (const plan of plans) await applyPlan(db, plan);
  console.log(
    `\nApplied. The rows as they were are in ${backupPath}, so this can be put back.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
