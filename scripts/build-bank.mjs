/**
 * Build the question bank for a set of subjects, one after another.
 *
 * The generator handles one subject. This runs a list of them, prints where it
 * has got to, and survives being stopped: every question is counted from what
 * is already in the database, so killing this at 3am and starting it again
 * tomorrow picks up exactly where it left off rather than duplicating work.
 *
 * Usage:
 *   node scripts/build-bank.mjs --mine                  the six subjects on your profile
 *   node scripts/build-bank.mjs --subjects "Physics SL,Economics HL"
 *   node scripts/build-bank.mjs --mine --per-subtopic 20 --concurrency 4
 *   node scripts/build-bank.mjs --mine --verify-provider claude
 *
 * Two machines at once: give each one a shard and they split every subject
 * between them instead of racing through the same list.
 *   Mac: node scripts/build-bank.mjs --all --shard 1/2
 *   PC:  node scripts/build-bank.mjs --all --shard 2/2
 *
 * Anything it does not recognise is passed straight through to the generator,
 * so --provider, --ollama-model, --verify-passes and the rest work here too.
 */

import { spawn } from "node:child_process";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const PER_SUBTOPIC = arg("per-subtopic", "20");
const EMAIL = arg("email", null);

/** Flags that belong to this script and must not be forwarded. */
const OWN = new Set(["--subjects", "--per-subtopic", "--mine", "--all", "--email"]);
function passthrough() {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (OWN.has(args[i])) {
      if (args[i] !== "--mine" && args[i] !== "--all") i++; // skip its value too
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

async function subjectList(db) {
  const explicit = arg("subjects", null);
  if (explicit) return explicit.split(",").map((s) => s.trim()).filter(Boolean);

  if (flag("mine")) {
    // subjects is jsonb, so it is a JSON array rather than a Postgres one.
    const { rows } = EMAIL
      ? await db.query(
          `SELECT p.subjects FROM profiles p
           JOIN auth.users u ON u.id = p.id WHERE u.email = $1`,
          [EMAIL]
        )
      : await db.query(
          `SELECT subjects FROM profiles
           WHERE subjects IS NOT NULL AND jsonb_array_length(subjects) > 0
           ORDER BY updated_at DESC NULLS LAST LIMIT 1`
        );
    const raw = rows[0]?.subjects;
    const subjects = Array.isArray(raw) ? raw : JSON.parse(raw || "[]");
    if (!subjects.length) {
      console.error(
        "No profile with subjects found. Pass --subjects \"A,B\" or --email you@example.com."
      );
      process.exit(1);
    }
    // The DP core is coursework: there is nothing to generate questions for.
    return subjects.filter(
      (s) => !/^(Theory of Knowledge|Extended Essay|Creativity)/.test(s)
    );
  }

  if (flag("all")) {
    const { rows } = await db.query(
      `SELECT DISTINCT subject FROM syllabus_content ORDER BY subject`
    );
    return rows.map((r) => r.subject);
  }

  console.error(
    "Nothing to build. Pass --mine, --all, or --subjects \"Physics SL,Economics HL\"."
  );
  process.exit(1);
}

function run(subject) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        new URL("./generate-questions.mjs", import.meta.url).pathname,
        "--subject",
        subject,
        "--per-subtopic",
        PER_SUBTOPIC,
        ...passthrough(),
      ],
      { stdio: "inherit" }
    );
    child.on("exit", (code) => resolve(code));
  });
}

async function progress(db, subjects) {
  const { rows } = await db.query(
    `SELECT s.subject,
            count(DISTINCT s.subtopic) AS subtopics,
            count(q.id) AS questions
     FROM syllabus_content s
     LEFT JOIN questions q ON q.subject = s.subject AND q.subtopic = s.subtopic
     WHERE s.subject = ANY($1)
     GROUP BY s.subject ORDER BY s.subject`,
    [subjects]
  );
  return rows;
}

async function main() {
  const db = await connect();
  const subjects = await subjectList(db);

  const before = await progress(db, subjects);
  const target = before.reduce((sum, r) => sum + Number(r.subtopics) * Number(PER_SUBTOPIC), 0);
  const have = before.reduce((sum, r) => sum + Number(r.questions), 0);

  console.log(`Building ${subjects.length} subjects at ${PER_SUBTOPIC} questions per subtopic.`);
  console.table(
    before.map((r) => ({
      subject: r.subject,
      subtopics: Number(r.subtopics),
      have: Number(r.questions),
      want: Number(r.subtopics) * Number(PER_SUBTOPIC),
    }))
  );
  console.log(`${have} of ${target} done. ${target - have} to go.\n`);

  const startedAt = Date.now();
  for (const [i, subject] of subjects.entries()) {
    console.log(`\n${"=".repeat(70)}\n[${i + 1}/${subjects.length}] ${subject}\n${"=".repeat(70)}`);
    const code = await run(subject);
    if (code !== 0) console.log(`  (${subject} exited with code ${code}, carrying on)`);
  }

  const after = await progress(db, subjects);
  const now = after.reduce((sum, r) => sum + Number(r.questions), 0);
  const mins = (Date.now() - startedAt) / 60000;

  console.log(`\n${"=".repeat(70)}`);
  console.table(
    after.map((r) => ({
      subject: r.subject,
      questions: Number(r.questions),
      want: Number(r.subtopics) * Number(PER_SUBTOPIC),
    }))
  );
  console.log(
    `Added ${now - have} questions in ${mins.toFixed(0)} min (${((now - have) / Math.max(mins, 1)).toFixed(1)}/min). ${now} in the bank.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
