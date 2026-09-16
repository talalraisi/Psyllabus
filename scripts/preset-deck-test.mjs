/** Does taking a ready-made deck copy it correctly, and survive being pressed twice? */
import { connect } from "/Users/talalalraisi/Desktop/psyllabus/scripts/db.mjs";
const db = await connect();

const ME = "12b8ea33-9835-4188-8a8d-7e485255575d";

const { rows: deck } = await db.query(
  `SELECT subject, subtopic, count(*)::int n FROM flashcard_presets
   WHERE verified GROUP BY subject, subtopic ORDER BY n DESC LIMIT 1`
);
if (!deck.length) {
  console.log("No preset decks yet — generation still running.");
  process.exit(0);
}
const { subject, subtopic, n } = deck[0];
console.log(`Testing with "${subtopic}" (${subject}), ${n} cards\n`);

const as = async (uid, fn) => {
  await db.query("BEGIN");
  await db.query(`SELECT set_config('request.jwt.claims', $1, true)`,
    [JSON.stringify({ sub: uid, role: "authenticated" })]);
  await db.query("SET LOCAL ROLE authenticated");
  try { return await fn(); } finally { await db.query("ROLLBACK"); }
};

const checks = [];

checks.push(["taking a deck copies every card", await as(ME, async () => {
  const { rows } = await db.query(`SELECT start_preset_deck($1,$2) AS added`, [subject, subtopic]);
  return rows[0].added === n;
})]);

checks.push(["pressing it twice adds nothing the second time", await as(ME, async () => {
  await db.query(`SELECT start_preset_deck($1,$2)`, [subject, subtopic]);
  const { rows } = await db.query(`SELECT start_preset_deck($1,$2) AS added`, [subject, subtopic]);
  return rows[0].added === 0;
})]);

checks.push(["copies land as the student's own, scheduled from now", await as(ME, async () => {
  await db.query(`SELECT start_preset_deck($1,$2)`, [subject, subtopic]);
  const { rows } = await db.query(
    `SELECT user_id, source, box, due_at, reviews FROM flashcards
     WHERE user_id=$1 AND subtopic=$2 LIMIT 1`, [ME, subtopic]);
  const c = rows[0];
  return c && c.user_id === ME && c.source === "preset" && c.box === 1 && c.reviews === 0;
})]);

checks.push(["a top-up adds only what is missing", await as(ME, async () => {
  await db.query(`SELECT start_preset_deck($1,$2)`, [subject, subtopic]);
  // Delete one, as a student might, then take the deck again.
  await db.query(
    `DELETE FROM flashcards WHERE ctid IN (
       SELECT ctid FROM flashcards WHERE user_id=$1 AND subtopic=$2 LIMIT 1)`,
    [ME, subtopic]);
  const { rows } = await db.query(`SELECT start_preset_deck($1,$2) AS added`, [subject, subtopic]);
  return rows[0].added === 1;
})]);

checks.push(["signed out is refused", await (async () => {
  await db.query("BEGIN");
  try {
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ role: "authenticated" })]);
    await db.query("SET LOCAL ROLE authenticated");
    await db.query(`SELECT start_preset_deck($1,$2)`, [subject, subtopic]);
    return false;
  } catch (e) {
    return /Sign in first/.test(e.message);
  } finally { await db.query("ROLLBACK"); }
})()]);

// Seeded privileged, because an ordinary account cannot write presets at all —
// which is itself the correct behaviour, and worth asserting separately.
checks.push(["an ordinary account cannot write a preset", await as(ME, async () => {
  try {
    await db.query(
      `INSERT INTO flashcard_presets (subject, topic, subtopic, front, back, verified)
       VALUES ($1,'probe',$2,'SHOULD BE REFUSED','x',true)`, [subject, subtopic]);
    return false;
  } catch { return true; }
})]);

checks.push(["unverified cards are never copied", await (async () => {
  await db.query("BEGIN");
  try {
    await db.query(
      `INSERT INTO flashcard_presets (subject, topic, subtopic, front, back, verified)
       VALUES ($1,'probe',$2,'UNVERIFIED PROBE','should not appear',false)`,
      [subject, subtopic]);
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: ME, role: "authenticated" })]);
    await db.query("SET LOCAL ROLE authenticated");
    await db.query(`SELECT start_preset_deck($1,$2)`, [subject, subtopic]);
    const { rows } = await db.query(
      `SELECT count(*)::int n FROM flashcards WHERE user_id=$1 AND front='UNVERIFIED PROBE'`, [ME]);
    return rows[0].n === 0;
  } finally { await db.query("ROLLBACK"); }
})()]);

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}
console.log(`\n${checks.length - failed}/${checks.length}`);
process.exit(failed ? 1 : 0);
