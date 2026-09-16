/**
 * Write a ready-made deck for every subtopic in a subject.
 *
 * A flashcard with a wrong back is worse than no flashcard: the whole point of
 * spaced repetition is that you rehearse something until it sticks, so a card
 * that is wrong teaches you the wrong thing thoroughly. It gets the same
 * treatment questions get — a second model is shown the front alone, with no
 * sight of the intended back, and has to produce an answer. If the two do not
 * agree, the card is thrown away.
 *
 * That is why this is worth doing at all rather than letting a model write
 * four hundred cards unchecked.
 *
 * Usage:
 *   node scripts/generate-flashcards.mjs --subject "Physics SL"
 *   node scripts/generate-flashcards.mjs --subject "Physics SL" --per-subtopic 8
 *   node scripts/generate-flashcards.mjs --subject "Physics SL" --provider claude
 */

import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { connect } from "./db.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SUBJECT = arg("subject", null);
const PER = parseInt(arg("per-subtopic", "8"), 10);
const PROVIDER = arg("provider", "ollama");
const MODEL = arg("ollama-model", "qwen2.5:14b");
const OLLAMA = arg("ollama-url", "http://localhost:11434");
const CLAUDE_MODEL = arg("claude-model", "claude-opus-5");

if (!SUBJECT) {
  console.error('Pass --subject "Physics SL".');
  process.exit(1);
}

const anthropic = PROVIDER === "claude" ? new Anthropic() : null;

const CARDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["front", "back"],
        properties: { front: { type: "string" }, back: { type: "string" } },
      },
    },
  },
};

const ANSWERS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "answer", "answerable"],
        properties: {
          index: { type: "integer" },
          answer: { type: "string" },
          answerable: { type: "boolean" },
        },
      },
    },
  },
};

async function callOllama(prompt, schema, temperature = 0) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: schema,
      options: { temperature, num_ctx: 8192 },
      think: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return JSON.parse((await res.json()).message.content);
}

async function callClaude(prompt, schema) {
  const response = await anthropic.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    temperature: 0,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(response.content.find((b) => b.type === "text").text);
}

const ask = (prompt, schema, temperature) =>
  PROVIDER === "claude" ? callClaude(prompt, schema) : callOllama(prompt, schema, temperature);

const normalise = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const fingerprint = (s) => crypto.createHash("sha1").update(normalise(s)).digest("hex").slice(0, 20);

/**
 * A cheap contradiction check, run before anything is asked of a model.
 *
 * This does NOT decide whether two answers mean the same thing. It cannot:
 * word overlap accepted "the rate of change of acceleration" against "the rate
 * of change of velocity", because the one word that distinguishes them is the
 * one that differs and the rest of the sentence drowns it out. Judging prose is
 * a job for the model, and it is done in agreesViaModel below.
 *
 * What this catches for free is the case where both sides state numbers and
 * the numbers disagree — 9.81 against 1.62 — which is the most common way a
 * generated card is wrong and the cheapest to spot.
 */
function numericallyContradicts(a, b) {
  const nums = (s) =>
    (String(s || "").match(/\d+(?:\.\d+)?/g) || [])
      .map(Number)
      .filter((n) => Number.isFinite(n));
  const x = nums(a);
  const y = nums(b);
  if (!x.length || !y.length) return false;
  // Any number in the shorter list that has no near match in the other.
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.some((n) => !long.some((m) => Math.abs(n - m) <= Math.abs(n) * 0.02));
}

/**
 * Do these two answers say the same thing?
 *
 * Asked of the model, because it is a question about meaning. The two answers
 * are labelled X and Y in an order that does not say which came from the card,
 * so this cannot become the failure the question pipeline already had — a
 * checker shown the intended answer and asked whether it agrees will agree.
 */
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

/**
 * Identical is identical.
 *
 * Not a semantic comparison — that is what the model is for — just the case
 * where the checker produced the same sentence, or one that contains the
 * other. Half the cards in a batch hit this, and asking a model whether
 * "The slope of a position-time graph represents the velocity of the object"
 * means the same as itself is a round trip that can only introduce error.
 */
function obviouslySame(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // One stating the other plus a clause — "…, and it is a vector quantity".
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  return shorter.length >= 25 && longer.includes(shorter);
}

async function agreesViaModel(pairs) {
  if (!pairs.length) return new Map();
  const listing = pairs
    .map(
      (p, i) =>
        `${i}. Question: ${p.front}\n   X: ${p.flip ? p.back : p.answer}\n   Y: ${p.flip ? p.answer : p.back}`
    )
    .join("\n\n");

  const out = await ask(
    `For each numbered item below, two answers to the same question are given. Decide whether they say the same thing.

Different wording is not a difference. "The rate of change of velocity" and "how quickly velocity changes" are the same answer. One being longer, or adding an example, is not a difference either.

A different quantity, a different direction, a different mechanism, or a different concept IS a difference, however similar the wording.

${listing}`,
    SAME_SCHEMA,
    0
  );

  const map = new Map();
  for (const v of out.verdicts || []) map.set(v.index, !!v.same);
  return map;
}

/**
 * Judge every pair, and know the difference between "different" and "no answer".
 *
 * The batch call returns an empty verdicts array often enough to matter — six
 * subtopics out of twelve produced nothing on the first real run, not because
 * the cards were wrong but because no verdict came back and a missing verdict
 * was being read as a rejection. Cards identical to the checker's own answer
 * were being thrown away.
 *
 * So: the obvious ones never reach the model, anything the batch missed is
 * asked again one at a time, and a card is only dropped when something
 * actually said it was different.
 */
async function judge(pairs) {
  const verdict = new Map();
  const needModel = [];

  for (const [i, p] of pairs.entries()) {
    if (obviouslySame(p.answer, p.back)) verdict.set(i, true);
    else needModel.push({ ...p, original: i });
  }

  if (needModel.length) {
    let got = new Map();
    try {
      got = await agreesViaModel(needModel);
    } catch {
      /* fall through to the one-at-a-time pass */
    }
    for (const [j, p] of needModel.entries()) {
      if (got.has(j)) verdict.set(p.original, got.get(j));
    }

    // Anything the batch skipped, asked on its own.
    for (const [j, p] of needModel.entries()) {
      if (verdict.has(p.original)) continue;
      try {
        const one = await agreesViaModel([p]);
        if (one.has(0)) verdict.set(p.original, one.get(0));
      } catch {
        /* leave it unknown */
      }
    }
  }

  return verdict;
}

async function main() {
  const db = await connect();

  const { rows: subtopics } = await db.query(
    `SELECT topic, subtopic, hl_only FROM syllabus_content
     WHERE subject = $1 ORDER BY topic, subtopic`,
    [SUBJECT]
  );
  if (!subtopics.length) {
    console.error(`No syllabus rows for "${SUBJECT}".`);
    process.exit(1);
  }
  const { rows: cur } = await db.query(
    `SELECT DISTINCT curriculum FROM syllabus_content WHERE subject = $1`,
    [SUBJECT]
  );
  const curriculum = cur[0]?.curriculum || "IB";

  const { rows: have } = await db.query(
    `SELECT subtopic, count(*)::int n FROM flashcard_presets
     WHERE subject = $1 GROUP BY subtopic`,
    [SUBJECT]
  );
  const existing = new Map(have.map((r) => [r.subtopic, r.n]));

  const label =
    PROVIDER === "claude" ? CLAUDE_MODEL : `${MODEL} (local, free)`;
  console.log(`${SUBJECT} (${curriculum}) · ${subtopics.length} subtopics · target ${PER} each · ${label}\n`);

  let written = 0;
  let rejected = 0;

  for (const { topic, subtopic } of subtopics) {
    const already = existing.get(subtopic) || 0;
    const want = PER - already;
    if (want <= 0) {
      console.log(`  ${subtopic} — already has ${already}`);
      continue;
    }
    process.stdout.write(`  ${subtopic}: `);

    let cards;
    try {
      const made = await ask(
        `Write ${want} flashcards for one subtopic of ${curriculum} ${SUBJECT}.

Topic: ${topic}
Subtopic: ${subtopic}

A flashcard is one fact, asked one way. The front is a question or a term; the back is the answer, in one or two sentences at most.

Rules:
- Each card must be answerable from the front alone. "Explain this process" is not a card, because it does not say which process.
- Only this subtopic. Not the topic around it, not the subject in general.
- No card that depends on a diagram, a graph, or a specific textbook.
- Definitions, conditions, formulas, units, causes, consequences and common misconceptions all make good cards. Fifteen cards all starting "What is" do not.
- The back must be checkable: a specific answer rather than a discussion.`,
        CARDS_SCHEMA,
        0.4
      );
      cards = (made.cards || []).filter((c) => c.front?.trim() && c.back?.trim()).slice(0, want);
    } catch (e) {
      console.log(`generation failed — ${e.message.slice(0, 60)}`);
      continue;
    }

    if (!cards.length) {
      console.log("nothing generated");
      continue;
    }

    // Blind check: the front only, no sight of the intended back.
    let answers = [];
    try {
      const listing = cards.map((c, i) => `${i}. ${c.front}`).join("\n");
      const checked = await ask(
        `Answer each of these ${curriculum} ${SUBJECT} questions from your own knowledge.

Give the answer only, in one or two sentences. If a question cannot be answered as written — because it is ambiguous, or does not say what it is about — set answerable to false.

${listing}`,
        ANSWERS_SCHEMA,
        0
      );
      answers = checked.answers || [];
    } catch (e) {
      console.log(`verification failed — ${e.message.slice(0, 60)}`);
      continue;
    }

    const byIndex = new Map(answers.map((a) => [a.index, a]));

    // Anything the checker could not answer, or that contradicts it on a
    // number, is gone before the comparison is worth paying for.
    const survivors = [];
    for (const [i, c] of cards.entries()) {
      const a = byIndex.get(i);
      if (!a || !a.answerable) continue;
      if (numericallyContradicts(a.answer, c.back)) continue;
      survivors.push({ card: c, answer: a.answer, front: c.front, back: c.back, flip: i % 2 === 0 });
    }

    let kept = [];
    if (survivors.length) {
      try {
        const verdicts = await judge(survivors);
        const unknown = survivors.filter((_, i) => !verdicts.has(i)).length;
        kept = survivors.filter((_, i) => verdicts.get(i) === true).map((s) => s.card);
        if (unknown) process.stdout.write(`(${unknown} unjudged) `);
      } catch (e) {
        console.log(`comparison failed — ${e.message.slice(0, 50)}`);
        continue;
      }
    }
    rejected += cards.length - kept.length;

    let inserted = 0;
    for (const [i, c] of kept.entries()) {
      try {
        const res = await db.query(
          `INSERT INTO flashcard_presets
             (curriculum, subject, topic, subtopic, front, back, position, verified, source, front_fingerprint)
           VALUES ($1,$2,$3,$4,$5,$6,$7,true,'ai-generated',$8)
           ON CONFLICT (subject, subtopic, front_fingerprint) WHERE front_fingerprint IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [curriculum, SUBJECT, topic, subtopic, c.front.trim(), c.back.trim(), already + i, fingerprint(c.front)]
        );
        if (res.rowCount) inserted++;
      } catch {
        /* a duplicate or a constraint: skip the card, keep the run */
      }
    }
    written += inserted;
    console.log(`${kept.length}/${cards.length} verified, ${inserted} new`);
  }

  const { rows: final } = await db.query(
    `SELECT count(*)::int n, count(DISTINCT subtopic)::int covered
     FROM flashcard_presets WHERE subject = $1 AND verified`,
    [SUBJECT]
  );
  console.log(
    `\n${written} written this run, ${rejected} rejected by the check.` +
      `\n${final[0].n} cards across ${final[0].covered} of ${subtopics.length} subtopics.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
