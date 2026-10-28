/**
 * Turn ready-made flashcards that are really practice problems into
 * flashcards.
 *
 * The decks were written alongside the lessons, and in Maths and Chemistry
 * the writer often filled a deck with exercises: "Factorise x² − x − 12",
 * "Calculate the Ar of chlorine from its mass spectrum". A flashcard is for
 * recall (a definition, a formula with its symbols named, a rule, the steps
 * of a method), and the question bank is where problems belong. Each card
 * here becomes a recall card on the idea its problem tested, and the
 * original problem stays on the back as the example, so nothing is lost.
 *
 * Haiku decides card by card: a card that is already recall comes back
 * unchanged. Every original is written to content-runs/recall-cards-backup.json
 * before a row changes, so the rewrite can be undone.
 *
 *   node scripts/recall-cards.mjs              # count the candidates
 *   node scripts/recall-cards.mjs --write      # ask Haiku, save the rewrites, change nothing
 *   node scripts/recall-cards.mjs --apply      # write the saved rewrites to the database
 *   node scripts/recall-cards.mjs --undo       # put the backed-up originals back
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'
import { RUNS, claudeParams, runClaude } from './content/models.mjs'

loadEnv()
const STAGED = path.join(RUNS, 'recall-cards.json')
const BACKUP = path.join(RUNS, 'recall-cards-backup.json')
const mode = ['write', 'apply', 'undo'].find((f) => process.argv.includes(`--${f}`)) || 'count'

// Same as build-content.mjs, so a rewritten card is deduplicated like any other.
const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}.\-]+/gu, ' ').trim()
const fingerprint = (s) => crypto.createHash('sha1').update(norm(s)).digest('hex').slice(0, 20)

/* A problem to work: it opens with a command to do something to given
   numbers or expressions, or it hands over data and asks for a value. */
const WORK = String.raw`(^(calculate|find|evaluate|solve|determine|work out|compute|simplify|expand|factori[sz]e|differentiate|integrate|show that|convert|estimate|rearrange|write down the value|worked example)|worked example|how many [^?]*\?\s*$|what is the (value|probability|gradient|answer|result)|what (effort|force|mass|speed|velocity|energy|power|current|voltage|resistance|pressure) is)`
const GIVEN = String.raw`([0-9]+(\.[0-9]+)?\s*(N|m|kg|s|J|W|V|A|mol|g|dm|cm|%|°)|\$[^$]*[0-9][^$]*\$|= *[0-9])`
const WHERE = `verified and front ~* $1 and (front ~ $2 or front ~* '^(calculate|evaluate|solve|differentiate|integrate|simplify|expand|factori)')`

const SYSTEM = `You fix flashcards in an IB revision app. A flashcard is for recall: a definition, a formula with its symbols named, a rule or law, the conditions for something, the steps of a method, a key fact. A practice problem ("Factorise $x^2-x-12$", "Calculate the moles of HCl in 25.0 cm$^3$ of 0.100 mol dm$^{-3}$") is not a flashcard; the app has a separate question bank for problems.

For each card you are given:
- If it is already a recall card (it asks for a definition, rule, formula, fact, method, or an evaluation/discussion prompt that is not a numeric problem), return it with keep: true and the front and back unchanged.
- If it is a problem to work out, rewrite it as a recall card on the idea the problem tests, keep: false.
  - front: asks for that idea directly, under 160 characters. E.g. "How do you factorise a quadratic $x^2+bx+c$?", "What is the formula linking moles, concentration and volume?", "What is the derivative of $\\sin(ax+b)$?".
  - back: the answer first (the formula with each symbol named, or the rule, or the method in short steps), then "e.g." and the original problem worked in one line. Under 60 words.
  - Same subtopic and level; never introduce content beyond it. Keep the maths correct.
- Every mathematical expression in LaTeX between single dollar signs, as in the input. Chemical formulae and units may stay as plain text, as in the input.

Return one entry per card, in order, with its id.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'keep', 'front', 'back'],
        properties: { id: { type: 'string' }, keep: { type: 'boolean' }, front: { type: 'string' }, back: { type: 'string' } },
      },
    },
  },
}

const db = await connect({ quiet: true })

if (mode === 'undo') {
  const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'))
  for (const c of backup) await db.query('update flashcard_presets set front = $2, back = $3, front_fingerprint = $4 where id = $1', [c.id, c.front, c.back, c.front_fingerprint])
  console.log(`restored ${backup.length}`)
  await db.end()
  process.exit(0)
}

if (mode === 'apply') {
  const staged = JSON.parse(fs.readFileSync(STAGED, 'utf8'))
  const changes = staged.filter((c) => !c.keep)
  const { rows: before } = await db.query('select id, front, back, front_fingerprint from flashcard_presets where id = any($1)', [changes.map((c) => c.id)])
  const previous = fs.existsSync(BACKUP) ? JSON.parse(fs.readFileSync(BACKUP, 'utf8')) : []
  const known = new Set(previous.map((c) => c.id))
  fs.writeFileSync(BACKUP, JSON.stringify([...previous, ...before.filter((c) => !known.has(c.id))], null, 1))
  let done = 0
  let clashed = 0
  for (const c of changes) {
    // A deck that already has this recall card keeps its problem rather than a duplicate.
    const res = await db
      .query('update flashcard_presets set front = $2, back = $3, front_fingerprint = $4 where id = $1', [c.id, c.front.trim(), c.back.trim(), fingerprint(c.front)])
      .catch((e) => (e.code === '23505' ? null : Promise.reject(e)))
    if (res) done += res.rowCount
    else clashed++
  }
  console.log(`rewrote ${done} cards; ${clashed} left as they were because the deck already had that card; originals in ${path.relative(process.cwd(), BACKUP)}`)
  await db.end()
  process.exit(0)
}

const { rows } = await db.query(`select id, subject, subtopic, front, back from flashcard_presets where ${WHERE} order by subject, subtopic, position`, [WORK, GIVEN])
const bySubject = {}
for (const r of rows) bySubject[r.subject] = (bySubject[r.subject] || 0) + 1
console.log(`${rows.length} candidates`)
console.log(Object.entries(bySubject).map(([s, n]) => `${s}: ${n}`).join('\n'))

if (mode === 'write') {
  const requests = []
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20)
    const user = chunk.map((c) => JSON.stringify({ id: c.id, subject: c.subject, subtopic: c.subtopic, front: c.front, back: c.back })).join('\n')
    requests.push({ custom_id: `r${i}`, params: claudeParams({ model: 'claude-haiku-5-5', system: [SYSTEM], user, schema: SCHEMA, maxTokens: 8000 }) })
  }
  const out = await runClaude(requests, { cap: 226, note: 'recall cards' })
  const ids = new Set(rows.map((r) => r.id))
  const staged = Object.values(out)
    .flatMap((o) => o.data?.cards || [])
    .filter((c) => ids.has(c.id) && String(c.front).trim() && String(c.back).trim() && c.front.length <= 300 && c.back.length <= 1000)
  const failed = Object.values(out).filter((o) => o.error).length
  fs.writeFileSync(STAGED, JSON.stringify(staged, null, 1))
  console.log(`${staged.filter((c) => !c.keep).length} to rewrite, ${staged.filter((c) => c.keep).length} already recall cards, ${failed} requests failed; saved to ${path.relative(process.cwd(), STAGED)}`)
}
await db.end()
