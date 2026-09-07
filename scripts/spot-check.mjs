/**
 * Check the bank yourself, and find out what its error rate actually is.
 *
 * The verifier is a filter, not a proof. It removes questions a model can show
 * are wrong; it cannot show that what survived is right. So the only honest
 * answer to "is the bank accurate" is a number measured by a person who knows
 * the subject, on a random sample, with the uncertainty stated.
 *
 * That person is you. You sit the same syllabus these questions are written
 * for, which makes you better placed to mark them than anything that generated
 * them.
 *
 * This shows random questions one at a time and asks whether each is right.
 * Anything you mark wrong is unpublished immediately, so it stops being served
 * while you are still sitting there. At the end it reports the error rate with
 * a confidence interval, because "3 wrong out of 40" on its own invites you to
 * believe the bank is 92.5% correct when the honest reading is "somewhere
 * between 2% and 20%, and you need a bigger sample to say better".
 *
 * Usage:
 *   node scripts/spot-check.mjs --n 40
 *   node scripts/spot-check.mjs --subject "Physics SL" --n 30
 *   node scripts/spot-check.mjs --subject "Physics SL" --type mcq
 *   node scripts/spot-check.mjs --since 2026-09-07     only what you just made
 */

import readline from "node:readline";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const N = parseInt(arg("n", "30"), 10);
const SUBJECT = arg("subject", null);
const TYPE = arg("type", null);
const SINCE = arg("since", null);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

/**
 * Read one line, from a terminal or from a pipe.
 *
 * rl.question only resolves on a TTY: piped input closes the stream before the
 * callback fires, so the answers are read as nothing and the whole session
 * reports zero. Consuming the interface as an async iterator behaves the same
 * either way, which also makes this script testable without a person sitting
 * at it.
 */
const lines = rl[Symbol.asyncIterator]();
async function ask(prompt) {
  process.stdout.write(prompt);
  const { value, done } = await lines.next();
  if (done) throw new Error("input ended");
  return value ?? "";
}

/**
 * Wilson score interval. The obvious thing, wrong/total, is badly behaved on
 * small samples and at the edges: zero errors out of twenty is not proof of a
 * perfect bank, and this says so by putting the upper bound at about 16%.
 */
function wilson(errors, total, z = 1.96) {
  if (!total) return [0, 1];
  const p = errors / total;
  const d = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [Math.max(0, (centre - spread) / d), Math.min(1, (centre + spread) / d)];
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

function show(q, i, total) {
  const line = "─".repeat(72);
  console.log(`\n${line}`);
  console.log(`[${i + 1}/${total}]  ${q.subject} · ${q.subtopic}`);
  console.log(`${q.question_type} · difficulty ${Number(q.difficulty).toFixed(2)} · ${q.marks} mark(s)`);
  console.log(line);
  console.log(`\n${q.stem}\n`);

  if (q.figure) {
    console.log(`  [figure: ${q.figure.kind}] ${q.figure.alt || ""}`);
    if (q.figure.kind === "table") {
      console.log(`    ${(q.figure.columns || []).join(" | ")}`);
      for (const row of q.figure.rows || []) console.log(`    ${row.join(" | ")}`);
    } else if (q.figure.kind === "bar") {
      for (const b of q.figure.bars || []) console.log(`    ${b.label}: ${b.value}`);
    } else {
      const points = q.figure.points || [];
      console.log(`    points: ${points.map((p) => `(${p.x}, ${p.y})`).join(" ")}`);
    }
    console.log("");
  }

  if (q.options) {
    for (const o of q.options) {
      const mark = o.id === q.correct_answer ? " <- marked correct" : "";
      console.log(`  (${o.id}) ${o.text}${mark}`);
    }
    if (q.option_feedback) {
      console.log("");
      for (const [id, why] of Object.entries(q.option_feedback)) {
        console.log(`  why not ${id}: ${why}`);
      }
    }
  } else {
    console.log(`  Answer: ${(q.accepted_answers || []).join("  |  ")}`);
    if (q.answer_hint) console.log(`  Expected form: ${q.answer_hint}`);
  }

  console.log(`\n  Explanation: ${q.explanation}`);
  if (q.hint) console.log(`  Hint: ${q.hint}`);
}

async function main() {
  const db = await connect();

  const where = ["verified = true"];
  const params = [];
  if (SUBJECT) {
    params.push(SUBJECT);
    where.push(`subject = $${params.length}`);
  }
  if (TYPE) {
    params.push(TYPE);
    where.push(`question_type = $${params.length}`);
  }
  if (SINCE) {
    params.push(SINCE);
    where.push(`created_at >= $${params.length}`);
  }
  params.push(N);

  const { rows } = await db.query(
    `SELECT * FROM questions WHERE ${where.join(" AND ")}
     ORDER BY random() LIMIT $${params.length}`,
    params
  );

  if (!rows.length) {
    console.log("Nothing matches those filters.");
    process.exit(0);
  }

  console.log(
    `\nSpot-checking ${rows.length} random questions${SUBJECT ? ` from ${SUBJECT}` : ""}.\n` +
      `y = correct   n = wrong   s = not sure   q = stop early\n` +
      `Work the answer out yourself before looking at the marked one.`
  );

  const verdicts = [];
  const bad = [];

  // Whatever happens in here, the summary still prints. Marking thirty
  // questions and losing the number because the input stream ended would be a
  // poor reward for the only part of this that needs a person.
  try {
  for (const [i, q] of rows.entries()) {
    show(q, i, rows.length);
    let answer = "";
    while (!["y", "n", "s", "q"].includes(answer)) {
      answer = (await ask("\n  Is this right? [y/n/s/q] ")).trim().toLowerCase();
    }
    if (answer === "q") break;
    verdicts.push({ q, answer });
    if (answer === "n") {
      const note = (await ask("  What is wrong with it? (optional) ")).trim();
      bad.push({ q, note });
      // Unpublished straight away rather than at the end, so a question you
      // have just decided is wrong is not served to anybody else while you
      // finish the rest of the sample.
      await db.query("UPDATE questions SET verified = false WHERE id = $1", [q.id]);
      console.log("  Unpublished.");
    }
  }
  } catch {
    console.log("\n  Input ended. Reporting on what was judged so far.");
  }

  rl.close();

  const judged = verdicts.filter((v) => v.answer !== "s");
  const errors = verdicts.filter((v) => v.answer === "n").length;
  const unsure = verdicts.filter((v) => v.answer === "s").length;

  console.log(`\n${"═".repeat(72)}`);
  if (!judged.length) {
    console.log("Nothing judged, so there is nothing to report.");
    process.exit(0);
  }

  const [lo, hi] = wilson(errors, judged.length);
  console.log(
    `${errors} wrong out of ${judged.length} judged${unsure ? ` (${unsure} unsure, not counted)` : ""}.`
  );
  console.log(`Error rate: ${pct(errors / judged.length)}. True value between ${pct(lo)} and ${pct(hi)}.`);

  // A per-subject split, because an average across subjects hides the one
  // subject the model cannot do.
  const bySubject = new Map();
  for (const v of judged) {
    const s = bySubject.get(v.q.subject) || { total: 0, wrong: 0 };
    s.total++;
    if (v.answer === "n") s.wrong++;
    bySubject.set(v.q.subject, s);
  }
  if (bySubject.size > 1) {
    console.log("");
    for (const [subject, s] of [...bySubject].sort((a, b) => b[1].wrong - a[1].wrong)) {
      console.log(`  ${subject.padEnd(36)} ${s.wrong}/${s.total} wrong`);
    }
  }

  if (bad.length) {
    console.log(`\nUnpublished ${bad.length}:`);
    for (const b of bad) {
      console.log(`  · ${b.q.stem.slice(0, 70)}…${b.note ? `\n      ${b.note}` : ""}`);
    }
  }

  console.log(
    `\n${
      hi < 0.05
        ? "Under 5% at the top of the range. Good enough to put in front of people."
        : hi < 0.15
          ? "The upper bound is still high. Check another sample before trusting this subject."
          : "Too high to ship. Find what the errors have in common before generating more."
    }`
  );
  console.log(
    `Sample size sets the precision: 30 questions can only tell you the rate to about ±10 points, 100 to about ±5.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
