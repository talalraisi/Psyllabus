/**
 * The shape of every real exam paper, read out of the IB subject guides.
 *
 * A predicted paper is only worth sitting if it is the real paper's shape:
 * the same duration, the same sections, the same choice ("answer one of
 * three"), the same marks per part and the same kind of question in each.
 * Those facts are in each guide's "External assessment details". This reads
 * that section once per guide and has Sonnet set it down in a fixed form,
 * written to lib/paper-blueprints.json for the app and the paper generator.
 *
 * The guide text itself stays on this machine (guides/ib, IB copyright, never
 * committed). The blueprint is a description of the paper's format, in our
 * words: durations, marks and structure.
 *
 *   node scripts/content/blueprints.mjs            every guide with papers
 *   node scripts/content/blueprints.mjs --only economics
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnv } from '../db.mjs'
import { runClaude, claudeParams } from './models.mjs'

loadEnv()
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const OUT = path.join(ROOT, 'lib/paper-blueprints.json')
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null

/* Guide file → the course names in the app it covers. */
const GUIDES = {
  biology: ['Biology'],
  chemistry: ['Chemistry'],
  physics: ['Physics'],
  'sports-exercise-and-health-science': ['Sports, Exercise, and Health Science'],
  'design-technology': ['Design Technology'],
  'computer-science': ['Computer Science'],
  'environmental-systems-and-societies': ['Environmental Systems and Societies'],
  'mathematics-analysis-and-approaches': ['Math Analysis & Approaches'],
  'mathematics-applications-and-interpretation': ['Math Applications & Interpretation'],
  economics: ['Economics'],
  'business-management': ['Business Management'],
  geography: ['Geography'],
  // Two History courses run side by side: the 2020 guide for exams up to
  // 2027, the 2028 guide after. The app picks by the student's exam year.
  history: ['History'],
  'history-2028': ['History (exams from 2028)'],
  psychology: ['Psychology'],
  'global-politics': ['Global Politics'],
  'digital-society': ['Digital Society'],
  philosophy: ['Philosophy'],
  'social-and-cultural-anthropology': ['Social and Cultural Anthropology'],
  'world-religions': ['World Religions'],
  'language-a-literature': ['Language A: Literature'],
  'language-a-language-and-literature': ['Language A: Language & Literature'],
  'language-b': ['Language B'],
  'language-ab-initio': ['Language ab initio'],
  'classical-languages': ['Classical Languages'],
}

/** The guide's external assessment section, or the outline when it has none by that name. */
function assessmentText(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const find = (re, after = 0) => lines.findIndex((l, i) => i > after && re.test(l))
  // Past the contents page, which lists the same headings near the top.
  let start = find(/^\s*External assessment details/, 400)
  if (start === -1) start = find(/^\s*Assessment outline/, 400)
  if (start === -1) start = find(/^External assessment \(/, 400)
  if (start === -1) return null
  let end = find(/^\s*Internal assessment\s*$/, start)
  if (end === -1 || end - start > 1400) end = start + 1400
  // The outline (durations and weightings) sits just before the details.
  const outline = find(/^\s*Assessment outline/, 400)
  const from = outline !== -1 && outline < start && start - outline < 200 ? outline : start
  return lines
    .slice(from, end)
    .filter((l) => l.trim())
    .join('\n')
    .slice(0, 60000)
}

const SECTION = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'marks', 'instructions', 'answer', 'from', 'style', 'question_count', 'parts', 'marking', 'notes'],
  properties: {
    name: { type: 'string', description: 'e.g. "Paper 1A", "Section A", or the paper name when it has no sections.' },
    marks: { type: 'integer', description: 'Marks available in this section as the candidate sits it.' },
    instructions: { type: 'string', description: 'The rubric a candidate reads, in our words: "Answer all questions." "Answer one question from a choice of three."' },
    answer: { type: 'integer', description: 'How many questions the candidate answers. Equal to from when all are compulsory.' },
    from: { type: 'integer', description: 'How many questions are offered.' },
    style: {
      type: 'string',
      enum: ['multiple_choice', 'data_based', 'short_answer', 'structured', 'extended_response', 'essay', 'source_based', 'case_study', 'text_analysis', 'writing_task', 'reading_comprehension', 'problem_solving', 'unseen_text_guided_analysis'],
    },
    question_count: { type: 'integer', description: 'Questions in the section as printed (offered, not answered). For multiple choice, the number of items.' },
    parts: { type: 'string', description: 'How each question is divided and marked, e.g. "(a) 10 marks, (b) 15 marks". Empty if not specified.' },
    marking: { type: 'string', enum: ['answer_key', 'analytic', 'markbands', 'analytic_and_markbands', 'criteria'] },
    notes: { type: 'string', description: 'Anything else that shapes the paper: data booklet, calculator, prescribed sources, word counts, what content it draws on.' },
  },
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['levels'],
  properties: {
    levels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'papers'],
        properties: {
          level: { type: 'string', enum: ['SL', 'HL'] },
          papers: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'name', 'minutes', 'marks', 'weighting', 'calculator', 'content', 'sections', 'sit_here'],
              properties: {
                id: { type: 'string', enum: ['p1', 'p2', 'p3'] },
                name: { type: 'string' },
                minutes: { type: 'integer' },
                marks: { type: 'integer' },
                weighting: { type: 'integer', description: 'Percent of the final grade.' },
                calculator: { type: 'string', enum: ['yes', 'no', 'not_applicable'] },
                content: { type: 'string', description: 'What the paper draws on: "SL material only", "SL and additional HL material", "HL extension only", "prescribed subject chosen by the school"...' },
                sections: { type: 'array', items: SECTION },
                sit_here: { type: 'boolean', description: 'false when the paper cannot be sat in an app: listening comprehension needing audio, or a paper that only works on texts the school chose.' },
              },
            },
          },
        },
      },
    },
  },
}

const PROMPT = `Below is the external assessment section of an IB Diploma subject guide. Set down every externally assessed written paper, for SL and for HL, in the structure given. Take every number (duration in minutes, marks, weighting, how many questions are offered and answered, marks per part) from the text, never from memory. Where SL and HL share a paper, list it under both. Internal assessment, coursework and oral components are not papers: leave them out. Describe in your own words.`

const requests = []
for (const [file, courses] of Object.entries(GUIDES)) {
  if (only && !only.includes(file)) continue
  const text = assessmentText(path.join(ROOT, 'guides/ib', `${file}.txt`))
  if (!text) {
    console.log(`  ${file}: no assessment section found`)
    continue
  }
  requests.push({
    custom_id: file,
    meta: courses,
    params: claudeParams({
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      system: [PROMPT],
      user: text,
      schema: SCHEMA,
      maxTokens: 24000,
    }),
  })
}
console.log(`blueprints: ${requests.length} guides`)
const out = await runClaude(requests, { direct: true, cap: 60, note: 'blueprints' })

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
for (const r of requests) {
  const res = out[r.custom_id]
  if (!res?.data) {
    console.log(`  ${r.custom_id}: ${res?.error || 'failed'}`)
    continue
  }
  for (const course of r.meta) existing[course] = { guide: r.custom_id, levels: res.data.levels }
  const summary = res.data.levels.map((l) => `${l.level} ${l.papers.map((p) => `${p.name} ${p.minutes}m/${p.marks}`).join(', ')}`).join(' | ')
  console.log(`  ${r.custom_id.padEnd(44)} ${summary}`)
}
// Tidy: a paper listed twice for one level keeps its first entry, and
// anything with no exam time (an HL essay is coursework) is not a paper.
for (const course of Object.values(existing)) {
  for (const level of course.levels) {
    const seen = new Set()
    level.papers = level.papers.filter((p) => p.minutes > 0 && !seen.has(p.id) && seen.add(p.id))
  }
}
fs.writeFileSync(OUT, JSON.stringify(existing, null, 1))
console.log(`written ${path.relative(ROOT, OUT)}`)
