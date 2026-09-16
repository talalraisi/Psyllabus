/**
 * Gemini, on the free tier, for bulk generation of questions and flashcards.
 *
 * The free tier is limited by request, not by money: so many requests a minute
 * and so many a day, per Google Cloud project, per model. The numbers change
 * and are only shown in AI Studio (aistudio.google.com/rate-limit), so they
 * are not hardcoded here — pass what yours says with --gemini-rpm.
 *
 * Two kinds of "too many requests" come back as the same 429, and they need
 * opposite handling:
 *
 *   per minute  wait the few seconds Google asks for, then carry on
 *   per day     stop the run. Waiting until midnight Pacific inside a script
 *               nobody is watching is a run that looks alive and does nothing.
 *               Both generators count progress from the database, so running
 *               the same command tomorrow carries on where this one stopped.
 *
 * The free tier may use what is sent to improve Google's products. What goes
 * through here is syllabus wording and generated questions — never anything
 * from a student's account. Keep it that way.
 *
 * Requires GEMINI_API_KEY in .env.local.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Thrown when the day's quota is gone. Generators stop the run on this. */
export class GeminiDailyLimit extends Error {
  constructor(model) {
    super(
      `The free daily limit for ${model} is used up. It resets at midnight Pacific time.\n` +
        `Run the same command again then: finished subtopics are skipped, nothing is lost.`
    );
    this.name = "GeminiDailyLimit";
    this.stopRun = true;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Requests are spaced so they start no closer together than the per-minute
 * limit allows. Every call goes through one chain, so running several
 * subtopics at once cannot add up to more than the limit.
 */
let chain = Promise.resolve();
let lastStart = 0;
function paced(rpm) {
  const gap = Math.ceil(60000 / Math.max(1, rpm));
  const turn = chain.then(async () => {
    const wait = lastStart + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
  });
  chain = turn.catch(() => {});
  return turn;
}

/** "37s" or "1.5s" → milliseconds. */
function parseDelay(s) {
  const m = String(s || "").match(/^([\d.]+)s$/);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
}

/**
 * The older responseSchema field takes a narrower dialect than JSON Schema:
 * no additionalProperties, and enums of strings only. Used only if the
 * endpoint turns responseJsonSchema down.
 */
function toLegacySchema(node) {
  if (Array.isArray(node)) return node.map(toLegacySchema);
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "additionalProperties") continue;
    if (k === "enum" && v.some((x) => typeof x !== "string")) continue;
    out[k] = toLegacySchema(v);
  }
  return out;
}

let legacySchema = false;

export function geminiPreflight(model) {
  if (!process.env.GEMINI_API_KEY) {
    console.error(
      `No GEMINI_API_KEY found.\n\n` +
        `  1. aistudio.google.com -> Get API key -> Create API key\n` +
        `  2. Put it in .env.local as GEMINI_API_KEY=...\n` +
        `  3. Check your free limits for ${model} at aistudio.google.com/rate-limit\n` +
        `     and pass the requests-per-minute figure as --gemini-rpm`
    );
    process.exit(1);
  }
}

/**
 * One prompt in, one JSON object out, constrained to `schema`.
 *
 * `usage`, if passed, is incremented with the tokens the call used, so a run
 * can report throughput the same way it does for the other providers.
 */
export async function callGemini(
  prompt,
  schema,
  { model = "gemini-2.5-flash", temperature, maxTokens = 16000, rpm = 8, usage } = {}
) {
  let transientFailures = 0;

  for (;;) {
    await paced(rpm);

    const generationConfig = {
      responseMimeType: "application/json",
      maxOutputTokens: maxTokens,
      ...(temperature != null ? { temperature } : {}),
      ...(legacySchema ? { responseSchema: toLegacySchema(schema) } : { responseJsonSchema: schema }),
    };

    let res;
    try {
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
      });
    } catch (e) {
      // A dropped connection: the same as a 503, not a reason to lose the batch.
      if (++transientFailures > 5) throw e;
      await sleep(5000 * transientFailures);
      continue;
    }

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const details = body?.error?.details || [];
      const violations = details.flatMap((d) => d.violations || []);
      if (violations.some((v) => /PerDay/i.test(`${v.quotaId || ""} ${v.quotaMetric || ""}`))) {
        throw new GeminiDailyLimit(model);
      }
      const retry = details.find((d) => d.retryDelay)?.retryDelay;
      const wait = parseDelay(retry) ?? 30000;
      console.log(`  (per-minute limit reached, waiting ${Math.round(wait / 1000)}s)`);
      await sleep(wait + 1000);
      continue;
    }

    if (res.status >= 500) {
      if (++transientFailures > 5) {
        throw new Error(`Gemini ${res.status} five times running: ${(await res.text()).slice(0, 200)}`);
      }
      await sleep(5000 * transientFailures);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 400 && !legacySchema && /responseJsonSchema|response_json_schema/.test(text)) {
        legacySchema = true;
        continue;
      }
      if (res.status === 404) {
        throw new Error(`Gemini has no model called "${model}". Check the name in AI Studio.`);
      }
      if (res.status === 400 && /API key/i.test(text)) {
        throw Object.assign(new Error("GEMINI_API_KEY was refused. Check it in .env.local."), {
          stopRun: true,
        });
      }
      throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    if (usage && data.usageMetadata) {
      usage.input += data.usageMetadata.promptTokenCount || 0;
      usage.output +=
        (data.usageMetadata.candidatesTokenCount || 0) + (data.usageMetadata.thoughtsTokenCount || 0);
      usage.calls++;
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error(`Gemini returned nothing (${data.promptFeedback?.blockReason || "no reason given"})`);
    }
    if (candidate.finishReason === "MAX_TOKENS") {
      throw new Error("Gemini ran out of output tokens before finishing the JSON");
    }
    const text = (candidate.content?.parts || [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (!text) throw new Error(`Empty response from Gemini (${candidate.finishReason || "unknown"})`);
    return JSON.parse(text);
  }
}
