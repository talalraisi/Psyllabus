/**
 * Does the flashcard check keep good cards and throw away wrong ones?
 *
 * A card with a wrong back is worse than no card: spaced repetition rehearses
 * it until it sticks, so a wrong one teaches the wrong thing thoroughly.
 *
 * Two parts, tested separately because they do different jobs.
 *
 * The cheap part is numeric: if both answers state numbers and the numbers
 * disagree, the card is wrong and no model needs asking. That is pure and runs
 * offline.
 *
 * The part that decides meaning is the model, because meaning is not something
 * a string comparison can reach — an earlier version of this used word overlap
 * and accepted "the rate of change of acceleration" against "the rate of change
 * of velocity", since the one word that distinguishes them is the one that
 * differs. Run with --live to put the real cases through the real model.
 *
 *   node scripts/flashcard-check-test.mjs
 *   node scripts/flashcard-check-test.mjs --live
 */
import fs from "node:fs";

const LIVE = process.argv.includes("--live");
const MODEL = "qwen2.5:14b";

const src = fs.readFileSync(
  "/Users/talalalraisi/Desktop/psyllabus/scripts/generate-flashcards.mjs",
  "utf8"
);
const slice = src.slice(src.indexOf("function numericallyContradicts"), src.indexOf("async function main()"));
const mod = await import(
  "data:text/javascript," +
    encodeURIComponent(slice.replace(/^const SAME_SCHEMA[\s\S]*$/m, "") + "\nexport { numericallyContradicts };")
);
const { numericallyContradicts } = mod;

/** [checker's answer, the card's back, should it be rejected outright] */
const NUMERIC = [
  ["The acceleration due to gravity is 9.81 m/s^2", "9.81 m/s²", false],
  ["9.81 m/s^2", "The acceleration due to gravity is 1.62 m/s²", true],
  ["A right angle is 90 degrees", "A right angle is 90°", false],
  ["Water boils at 100 °C", "Water boils at 212 °C", true],
  ["The rate of change of velocity", "Acceleration is the rate of change of velocity", false],
  ["No numbers here at all", "Nor here", false],
];

let failed = 0;
console.log("Numeric contradiction (offline, no model):\n");
for (const [checker, back, expected] of NUMERIC) {
  const got = numericallyContradicts(checker, back);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${expected ? "reject" : "allow "}  "${checker.slice(0, 40)}" vs "${back.slice(0, 40)}"`);
}

/** [front, checker's answer, the card's back, should they be judged the same] */
const MEANING = [
  ["What is acceleration?", "The rate of change of velocity", "Acceleration is the rate of change of velocity", true],
  ["What is acceleration?", "How quickly velocity changes with time", "The rate of change of velocity with respect to time", true],
  ["What is acceleration?", "The rate of change of acceleration", "Acceleration is the rate of change of velocity", false],
  ["Which way does centripetal force act?", "Toward the centre of the circular path", "Centripetal force acts toward the centre of the circle", true],
  ["Which way does centripetal force act?", "Away from the centre, outward", "Centripetal force acts toward the centre of the circle", false],
  ["What is a monopoly?", "A market where one firm supplies the whole market", "A monopoly is a market structure with a single seller supplying the entire market", true],
  ["What is a monopoly?", "A market with many small firms selling identical goods", "A monopoly is a market with a single seller", false],
];

if (!LIVE) {
  console.log(`\n${NUMERIC.length - failed}/${NUMERIC.length} offline.`);
  console.log(`\nMeaning is decided by the model. Run with --live to check those ${MEANING.length} cases against ${MODEL}.`);
  process.exit(failed ? 1 : 0);
}

const SAME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "same"],
        properties: { index: { type: "integer" }, same: { type: "boolean" } },
      },
    },
  },
};

const listing = MEANING.map(
  ([front, answer, back], i) => `${i}. Question: ${front}\n   X: ${i % 2 === 0 ? back : answer}\n   Y: ${i % 2 === 0 ? answer : back}`
).join("\n\n");

const res = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    stream: false,
    format: SAME_SCHEMA,
    options: { temperature: 0, num_ctx: 8192 },
    think: false,
    messages: [
      {
        role: "user",
        content: `For each numbered item below, two answers to the same question are given. Decide whether they say the same thing.

Different wording is not a difference. "The rate of change of velocity" and "how quickly velocity changes" are the same answer. One being longer, or adding an example, is not a difference either.

A different quantity, a different direction, a different mechanism, or a different concept IS a difference, however similar the wording.

${listing}`,
      },
    ],
  }),
});

const verdicts = new Map(
  (JSON.parse((await res.json()).message.content).verdicts || []).map((v) => [v.index, !!v.same])
);

console.log(`\nMeaning (live, ${MODEL}):\n`);
for (const [i, [front, answer, back, expected]] of MEANING.entries()) {
  const got = verdicts.get(i);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${expected ? "same " : "diff "}  "${answer.slice(0, 38)}" vs "${back.slice(0, 38)}"`);
}

const total = NUMERIC.length + MEANING.length;
console.log(`\n${total - failed}/${total}`);
process.exit(failed ? 1 : 0);
