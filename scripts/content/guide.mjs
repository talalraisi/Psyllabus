/**
 * The part of an IB subject guide that a subtopic is written against.
 *
 * Every question and lesson is written to the guide's own statements of what
 * a student should understand, not to the model's memory of the course. The
 * guides live in guides/ib/ as text (IB copyright: on this machine only,
 * ignored by git, never committed — the repository is public).
 *
 * Two ways to find a section. Subjects whose syllabus rows carry the guide's
 * own codes (Physics "A.3", Biology "A1.1", Chemistry "R1.1") are found by
 * code: the heading that starts a line and is followed by real content,
 * rather than the same code in the contents page or the change log. Subjects
 * numbered by the app instead are found by the unit's name. When neither
 * finds anything the caller gets null and writes from the subtopic name
 * alone, and says so.
 */

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../guides/ib')

/* Course name in the app → guide file. Order matters: first match wins. */
const FILES = [
  [/^Math Analysis/, 'mathematics-analysis-and-approaches'],
  [/^Math Applications/, 'mathematics-applications-and-interpretation'],
  [/ A: Language & Literature/, 'language-a-language-and-literature'],
  [/ A: Literature|^Literature and Performance/, 'language-a-literature'],
  [/ ab initio/, 'language-ab-initio'],
  [/ B (SL|HL)$/, 'language-b'],
  [/^Classical Languages/, 'classical-languages'],
  [/^Sports, Exercise/, 'sports-exercise-and-health-science'],
  [/^Business Management/, 'business-management'],
  [/^Computer Science/, 'computer-science'],
  [/^Design Technology/, 'design-technology'],
  [/^Digital Society/, 'digital-society'],
  [/^Global Politics/, 'global-politics'],
  [/^Visual Arts/, 'visual-arts'],
  [/^World Religions/, 'world-religions'],
  [/^Theory of Knowledge/, 'theory-of-knowledge'],
  // Our students sit in 2028 and later: the 2028 History guide. The 2020 one
  // (guides/ib/history.txt) is for exams up to 2027.
  [/^History/, 'history-2028'],
  [/^Extended Essay/, 'extended-essay'],
]

export function guideFileFor(subject) {
  const hit = FILES.find(([re]) => re.test(subject))
  const base = hit ? hit[1] : subject.replace(/ (SL|HL)$/, '').toLowerCase().replace(/[^a-z]+/g, '-')
  const file = path.join(DIR, `${base}.txt`)
  return fs.existsSync(file) ? file : null
}

const cache = new Map()
function linesOf(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(file, 'utf8').split('\n'))
  return cache.get(file)
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "A.3" → a pattern for any heading shaped the same way: "B.1", "E.5". */
function shapeOf(code) {
  return code.replace(/[A-Z]+/g, '[A-Z]+').replace(/\d+/g, '\\d+').replace(/\./g, '\\.')
}

const CONTENT_MARK = /Understandings|Students should|Content|Guidance|Learning outcomes|Key concepts/i
const MAX = 9000

function sectionFrom(lines, start, nextHeading) {
  const out = [lines[start].trim()]
  for (let i = start + 1; i < lines.length && out.join('\n').length < MAX; i++) {
    if (nextHeading.test(lines[i])) break
    out.push(lines[i].replace(/\s+$/, ''))
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, MAX)
    .trim()
}

/** The best-looking section starting at any of these lines: the one with real content. */
function best(lines, starts, nextHeading) {
  let pick = null
  for (const s of starts) {
    const text = sectionFrom(lines, s, nextHeading)
    const score = (CONTENT_MARK.test(text) ? 10000 : 0) + text.length
    if (!pick || score > pick.score) pick = { text, score }
  }
  return pick && pick.text.length > 200 ? pick.text : null
}

/**
 * The guide's text for one syllabus row: {subject, code, unit, topic}.
 * Returns {text, how} or null.
 */
export function guideSection({ subject, code, unit, topic }) {
  const file = guideFileFor(subject)
  if (!file) return null
  const lines = linesOf(file)

  if (code && /[A-Z]/.test(code)) {
    const heading = new RegExp(`^\\s*${escape(code)}\\s+\\S`)
    const next = new RegExp(`^\\s*${shapeOf(code)}\\s+\\S`)
    const starts = lines.flatMap((l, i) => (heading.test(l) ? [i] : []))
    const text = best(lines, starts, next)
    if (text) return { text, how: `code ${code}` }
  }

  for (const name of [unit, topic].filter(Boolean)) {
    const words = name.replace(/^[A-Z0-9.]+\s+/, '').trim()
    if (words.length < 4) continue
    const heading = new RegExp(`^\\s*(?:[A-Z0-9.]+\\s+)?${escape(words)}\\s*$`, 'i')
    const starts = lines.flatMap((l, i) => (heading.test(l) ? [i] : []))
    // Name headings have no shape to stop at, so stop at the next short title-case line.
    const next = /^\s{0,4}(?:[A-Z0-9][\w.]*\s+)?[A-Z][A-Za-z ,'&-]{3,60}\s*$/
    const text = best(lines, starts, next)
    if (text) return { text, how: `name "${words}"` }
  }
  return null
}

/** Teaching hours for a section, when the guide states them ("8 hours"). */
export function hoursIn(text) {
  const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*hours?/i)
  return m ? Number(m[1]) : null
}

/**
 * Find units in a guide the code cannot find by itself.
 *
 * Guides label their sections in their own ways ("Structure 1.1", "SL 1.1",
 * a topic name in a table), so for units with no section found above, Haiku
 * reads the guide once and names the exact line each unit's content starts
 * on. Code then cuts each section from that line to the next unit's. About a
 * cent a course. `ask(prompt, schema)` is the caller's model call.
 *
 * Returns {unitKey: {text, how}}.
 */
export async function mapUnits(subject, units, ask) {
  const file = guideFileFor(subject)
  if (!file || !units.length) return {}
  const lines = linesOf(file)
  // The syllabus part of the guide: past the contents page, before assessment.
  const find = (re, after = 0) => lines.findIndex((l, i) => i > after && re.test(l))
  let start = find(/^\s*Syllabus content\s*$/i, 300)
  if (start === -1) start = find(/^\s*Syllabus outline\s*$/i, 300)
  if (start === -1) start = 300
  let end = find(/^\s*(Assessment in the Diploma Programme|Assessment objectives|External assessment)\s*$/i, start + 50)
  if (end === -1) end = lines.length
  const body = lines.slice(start, end).map((l, i) => `${start + i}: ${l}`).join('\n').slice(0, 600000)

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['units'],
    properties: {
      units: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'line'],
          properties: {
            key: { type: 'string' },
            line: { type: 'integer', description: 'The line number where this unit\'s content begins (its heading), or -1 if it is not in the guide.' },
          },
        },
      },
    },
  }
  const res = await ask(
    `Below is the syllabus section of the IB ${subject.replace(/ (SL|HL)$/, '')} subject guide, with line numbers. For each unit listed, give the line number of the heading where that unit's content (its understandings, content statements or learning outcomes) begins. Use the line where the content starts, not the contents page. -1 if the unit is not in the guide.

UNITS:
${units.map((u) => `- key "${u.key}": ${[u.code, u.unit, u.topic].filter(Boolean).join(' · ')}${u.examples ? ` (subtopics such as: ${u.examples})` : ''}`).join('\n')}

GUIDE:
${body}`,
    schema
  )
  const found = (res?.units || []).filter((u) => u.line >= start && u.line < end).sort((a, b) => a.line - b.line)
  const out = {}
  found.forEach((u, i) => {
    const stop = Math.min(found[i + 1]?.line ?? end, u.line + 400)
    const text = lines
      .slice(u.line, stop > u.line ? stop : u.line + 120)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .slice(0, MAX)
      .trim()
    if (text.length > 200) out[u.key] = { text, how: `mapped line ${u.line}` }
  })
  return out
}
