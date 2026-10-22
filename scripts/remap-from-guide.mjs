/**
 * Rebuild a subject's subtopic map from its current IB guide, in the same
 * shape as every other subject: topic → unit (with the guide's own code) →
 * three to six subtopics, each one thing a question can test, HL-only parts
 * flagged.
 *
 * For a subject whose guide has been rewritten since its map was made
 * (History for exams from 2028, Psychology from 2027), so questions are
 * written against what students are actually examined on. Sonnet reads the
 * guide's syllabus section; the current map is shown to it only as an
 * example of the format.
 *
 * It writes a proposal and stops. --apply replaces the subject's rows for SL
 * and HL, and refuses if anything is attached to the old ones (questions,
 * progress, flashcards), because those would be orphaned.
 *
 *   node scripts/remap-from-guide.mjs --course History --guide history-2028
 *   node scripts/remap-from-guide.mjs --course History --guide history-2028 --apply
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'
import { runClaude, claudeParams, RUNS } from './content/models.mjs'

loadEnv()
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i === -1 ? d : process.argv[i + 1]
}
const COURSE = arg('course')
const GUIDE = arg('guide')
const APPLY = process.argv.includes('--apply')
if (!COURSE || !GUIDE) {
  console.error('Pass --course History --guide history-2028')
  process.exit(1)
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(RUNS, `remap-${COURSE.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`)
const SUBJECTS = [`${COURSE} SL`, `${COURSE} HL`]

/** The guide's syllabus: past the contents page, up to the assessment chapters. */
function syllabusText() {
  const lines = fs.readFileSync(path.join(ROOT, 'guides/ib', `${GUIDE}.txt`), 'utf8').split('\n')
  const find = (re, after = 0) => lines.findIndex((l, i) => i > after && re.test(l))
  let start = find(/^\s*Syllabus (content|outline)\s*$/i, 300)
  if (start === -1) start = find(/^\s*Syllabus\s*$/i, 300)
  if (start === -1) start = 300
  let end = find(/^\s*(Assessment in the Diploma Programme|Assessment objectives|Assessment outline)\s*$/i, start + 50)
  if (end === -1) end = lines.length
  return lines.slice(start, end).filter((l) => l.trim()).join('\n').slice(0, 400000)
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['topics'],
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'units'],
        properties: {
          topic: { type: 'string' },
          units: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'unit', 'level', 'subtopics'],
              properties: {
                code: { type: 'string', description: "The guide's own number or code for this unit, e.g. '1.2' or 'PS.3'." },
                unit: { type: 'string' },
                level: { type: 'string', enum: ['both', 'hl_only', 'hl_extension'], description: 'both: SL and HL. hl_only: an HL-only unit. hl_extension: taught at both levels but HL goes further.' },
                subtopics: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'hl_only'],
                    properties: { name: { type: 'string' }, hl_only: { type: 'boolean' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

async function main() {
  const db = await connect({ quiet: true })
  const { rows: current } = await db.query(
    `select subject, topic, unit, code, subtopic, hl_only, hl_extension from syllabus_content where curriculum = 'IB' and subject = any($1) order by subject, position`,
    [SUBJECTS]
  )

  if (APPLY) {
    const proposal = JSON.parse(fs.readFileSync(OUT, 'utf8'))
    // Nothing attached to the old map may be orphaned.
    for (const t of ['questions', 'progress', 'flashcards', 'flashcard_presets', 'lessons', 'mistakes']) {
      const { rows } = await db.query(`select count(*)::int n from ${t} where subject = any($1)`, [SUBJECTS])
      if (rows[0].n) throw new Error(`${t} has ${rows[0].n} rows on the old ${COURSE} map; not replacing it.`)
    }
    await db.query('BEGIN')
    await db.query(`delete from syllabus_content where curriculum = 'IB' and subject = any($1)`, [SUBJECTS])
    let n = 0
    for (const level of ['SL', 'HL']) {
      let position = 0
      for (const t of proposal.topics) {
        // A subtopic name is unique within its topic: a repeat gets its unit.
        const seen = new Set()
        for (const u of t.units) {
          if (level === 'SL' && u.level === 'hl_only') continue
          for (const s of u.subtopics) {
            if (level === 'SL' && s.hl_only) continue
            let name = s.name.trim()
            if (seen.has(name.toLowerCase())) name = `${name} (${u.unit})`
            seen.add(name.toLowerCase())
            // HL only and "HL goes further" are exclusive; HL only wins.
            const hlOnly = level === 'HL' && (u.level === 'hl_only' || s.hl_only)
            await db.query(
              `insert into syllabus_content (curriculum, subject, topic, unit, code, subtopic, hl_only, hl_extension, position)
               values ('IB',$1,$2,$3,$4,$5,$6,$7,$8)`,
              [`${COURSE} ${level}`, t.topic, u.unit, u.code, name, hlOnly, !hlOnly && level === 'HL' && u.level === 'hl_extension', position++]
            )
            n++
          }
        }
      }
    }
    await db.query('COMMIT')
    await db.end()
    console.log(`applied: ${n} rows for ${SUBJECTS.join(' and ')}`)
    return
  }
  await db.end()

  // The current map, as an example of the format only.
  const example = current
    .filter((r) => r.subject.endsWith('HL'))
    .slice(0, 14)
    .map((r) => `${r.topic} | ${r.code} ${r.unit} | ${r.subtopic}${r.hl_only ? ' [HL only]' : ''}`)
    .join('\n')

  const user = `Below is the syllabus section of the current IB ${COURSE} subject guide. Build the subtopic map students revise from, covering everything in it.

FORMAT, exactly as the other subjects in the app are mapped (this is the old ${COURSE} map, shown only for its format, not its content):
${example}

- topic: a major area as the guide organises it (a paper's content, a core area, an option).
- unit: one section of the guide, with the guide's own code or number and its name.
- subtopics: 3 to 6 per unit, each ONE thing a question can test, named concisely in a few words like the examples. Together they cover every statement of the unit; nothing invented beyond the guide.
- level: whether the unit is for both levels, HL only, or both with HL going further; mark individual HL-only subtopics too.
- Keep the guide's order. Where the guide offers options (prescribed subjects, regions, contexts), include every option as its own unit or topic.

GUIDE:
${syllabusText()}`

  const out = await runClaude(
    [{ custom_id: 'remap', params: claudeParams({ model: 'claude-sonnet-5-5', effort: 'medium', system: ['You map IB subject guides into precise revision checklists.'], user, schema: SCHEMA, maxTokens: 48000 }) }],
    { direct: true, cap: 187, note: `remap ${COURSE}` }
  )
  const data = out.remap?.data
  if (!data) throw new Error(out.remap?.error || 'no map returned')
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1))
  const units = data.topics.flatMap((t) => t.units)
  const subs = units.flatMap((u) => u.subtopics)
  console.log(`${COURSE}: ${data.topics.length} topics, ${units.length} units, ${subs.length} subtopics (${units.filter((u) => u.level === 'hl_only').length} HL-only units); was ${current.filter((r) => r.subject.endsWith('HL')).length} HL rows`)
  for (const t of data.topics) console.log(`  ${t.topic}: ${t.units.map((u) => `${u.code} ${u.unit} (${u.subtopics.length})`).join('; ').slice(0, 300)}`)
  console.log(`proposal: ${path.relative(ROOT, OUT)} — review, then --apply`)
}

main()
