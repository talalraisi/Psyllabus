/**
 * Does the specificity gate actually reject the things it is supposed to?
 *
 * The whole point of the remap is "specific, not vague". That is a claim about
 * the output, so it gets tested against the real cases — the ones currently in
 * the database that prompted the rewrite, and the good ones it must not throw
 * away.
 */
import fs from "node:fs";

// Pull the checker out of the script rather than duplicating it, so this tests
// what actually runs.
const src = fs.readFileSync("/Users/talalalraisi/Desktop/psyllabus/scripts/remap-syllabus.mjs", "utf8");
const start = src.indexOf("const JOINED =");
const end = src.indexOf("async function main()");
const mod = await import(
  "data:text/javascript," + encodeURIComponent(src.slice(start, end) + "\nexport { problemsWith };")
);
const { problemsWith } = mod;

const MUST_REJECT = [
  // Real entries from the current database.
  "Themes and motifs across different works and text types",
  "Text types and genres (literary and non-literary)",
  "How literature and language reflect/shape societies and values",
  "Influence and dialogue between authors and traditions",
  "Further macroeconomic models and diagrams (HL only)",
  "Introduction to limits and derivatives",
  // Things a model reaches for when it is padding.
  "Overview",
  "Key concepts",
  "Unit 3",
  "Functions",
  "Calculus",
];

const MUST_KEEP = [
  "Composite functions and their domain",
  "Differentiating from first principles",
  "Negative externalities of production",
  "The derivative as a rate of change",
  "Binomial theorem for positive integer n",
  "Complex numbers",
  "Arithmetic sequences and series",
  // Joined, but one named concept.
  "Supply and demand",
  "Mean and variance of a discrete random variable",
  "Space, time and motion",
];

let failed = 0;

console.log("Must be rejected:\n");
for (const name of MUST_REJECT) {
  const problems = problemsWith(name);
  const ok = problems.length > 0;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? `\n          → ${problems[0]}` : ""}`);
}

console.log("\nMust be kept:\n");
for (const name of MUST_KEEP) {
  const problems = problemsWith(name);
  const ok = problems.length === 0;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n          → wrongly flagged: ${problems.join("; ")}`}`);
}

const total = MUST_REJECT.length + MUST_KEEP.length;
console.log(`\n${total - failed}/${total}`);
process.exit(failed ? 1 : 0);
