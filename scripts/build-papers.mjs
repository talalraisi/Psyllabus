/**
 * Predicted papers: whole exam papers in each subject's real format.
 *
 * Each paper is written section by section against its blueprint
 * (lib/paper-blueprints.json, read out of the IB guide): the same sections,
 * the same choice of questions, the same marks per part, the same kind of
 * question in each. Every version leans on a different half of the syllabus,
 * so a second paper is not the first one reworded.
 *
 * Stages, saved to content-runs/papers-<course>.json:
 *
 *   write    Sonnet writes every section of every version
 *   check    free code checks on structure and marks; Haiku solves every
 *            multiple-choice and numeric part blind; a section that fails
 *            either is rewritten once
 *   audit    Gemini Pro reads each paper against its blueprint for accuracy,
 *            format and IB style; a rejected paper is rewritten once
 *   publish  into exam_papers for every course and level it belongs to
 *
 * Usage:
 *   node scripts/build-papers.mjs --course Economics --versions 2
 *   node scripts/build-papers.mjs --course "Spanish B" --versions 2
 *   node scripts/build-papers.mjs --course Economics --stage publish
 *
 * Options: --levels SL,HL  --papers p1,p2  --direct  --claude-cap  --gemini-cap
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'
import { runClaude, claudeParams, askGemini, RUNS, OverBudget } from './content/models.mjs'
import { readFigure, checkFigure, sameValue } from './content/checks.mjs'
import { parseNumber } from '../lib/grading.js'

loadEnv()
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const BLUEPRINTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/paper-blueprints.json'), 'utf8'))

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}
const COURSE = arg('course')
if (!COURSE) {
  console.error('Name a course: --course Economics')
  process.exit(1)
}
const VERSIONS = Number(arg('versions', 2))
const STAGE = arg('stage', 'all')
const DIRECT = Boolean(arg('direct', false))
const CLAUDE_CAP = Number(arg('claude-cap', 160))
const GEMINI_CAP = Number(arg('gemini-cap', 25))
const LEVELS = arg('levels') ? String(arg('levels')).split(',') : null
const PAPERS = arg('papers') ? String(arg('papers')).split(',') : null
// Gemini reads version 1 of each paper; later versions are written to the same
// format and checked the same free ways, which keeps Gemini's bill down.
const AUDIT_VERSIONS = Number(arg('audit-versions', 99))

/* -------------------------------------------------------- which course --- */

/**
 * The course asked for, as a blueprint and the app's course names. Languages
 * name the language ("Spanish B") and share one blueprint; History has two
 * guides running side by side, told apart by the exam year they start in.
 */
function resolve(course) {
  const lang = /^(\w+) (A: Literature|A: Language & Literature|B|ab initio)$/.exec(course)
  if (lang) {
    const key = { 'A: Literature': 'Language A: Literature', 'A: Language & Literature': 'Language A: Language & Literature', B: 'Language B', 'ab initio': 'Language ab initio' }[lang[2]]
    return { key, base: course, language: lang[1], examFrom: null }
  }
  if (course === 'History 2028') return { key: 'History (exams from 2028)', base: 'History', language: 'English', examFrom: 2028 }
  if (!BLUEPRINTS[course]) throw new Error(`No blueprint for "${course}".`)
  return { key: course, base: course, language: 'English', examFrom: null }
}
const R = resolve(COURSE)
const BLUEPRINT = BLUEPRINTS[R.key]
const slug = `papers-${COURSE.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
const STATE_FILE = path.join(RUNS, `${slug}.json`)
fs.mkdirSync(RUNS, { recursive: true })
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { course: COURSE, batches: {}, sections: {} }
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1))
const log = (...a) => console.log(...a)

const claude = (requests, note) =>
  runClaude(requests, {
    direct: DIRECT,
    cap: CLAUDE_CAP,
    note: `${slug} ${note}`,
    batchId: state.batches[note],
    onSubmit: (id) => {
      state.batches[note] = id
      save()
    },
  }).then((out) => {
    delete state.batches[note]
    save()
    return out
  })

/* ------------------------------------------------------------- the plan --- */

/** Every section of every paper to be written: level × paper × version × section. */
function units() {
  const out = []
  for (const level of BLUEPRINT.levels) {
    if (LEVELS && !LEVELS.includes(level.level)) continue
    for (const paper of level.papers) {
      if (PAPERS && !PAPERS.includes(paper.id)) continue
      for (let v = 1; v <= VERSIONS; v++) {
        paper.sections.forEach((section, si) => {
          // Listening needs audio; the rest of the paper is still worth sitting.
          if (/listening/i.test(section.name)) return
          out.push({ key: `${level.level}-${paper.id}-v${v}-s${si}`, level: level.level, paper, version: v, si, section })
        })
      }
    }
  }
  return out
}

async function syllabusFor(level) {
  const db = await connect({ quiet: true })
  const subjects = [`${R.base} ${level}`, R.base]
  const { rows } = await db.query(
    `select topic, subtopic, hl_only, hl_extension from syllabus_content where curriculum = 'IB' and subject = any($1) order by position`,
    [subjects]
  )
  await db.end()
  return rows
}

/** Half the syllabus a version leans on, so two versions do not overlap. */
function emphasis(rows, version) {
  const topics = [...new Set(rows.map((r) => r.topic))]
  return topics.filter((_, i) => i % VERSIONS === (version - 1) % VERSIONS)
}

/* --------------------------------------------------------------- schema --- */

const PART = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'marks', 'command_term', 'prompt', 'type', 'options', 'correct_answer', 'accepted_answers', 'markscheme'],
  properties: {
    label: { type: 'string', description: 'As printed: "a", "b(i)", or the item number for multiple choice.' },
    marks: { type: 'integer' },
    command_term: { type: 'string' },
    prompt: { type: 'string' },
    type: { type: 'string', enum: ['mcq', 'numeric', 'short_text', 'written'], description: 'numeric: one number is the answer. short_text: one term or phrase. written: sentences, paragraphs or an essay.' },
    options: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: { type: 'string', enum: ['a', 'b', 'c', 'd'] }, text: { type: 'string' } } },
      description: 'mcq only: exactly 4.',
    },
    correct_answer: { type: 'string', description: 'mcq: the option id. Otherwise empty.' },
    accepted_answers: { type: 'array', items: { type: 'string' }, description: 'numeric or short_text: the answer first, then other forms of the same answer.' },
    markscheme: {
      type: 'object',
      additionalProperties: false,
      required: ['points', 'markbands', 'indicative_content', 'guidance'],
      properties: {
        points: {
          type: 'array',
          description: 'Analytic marking: what earns each mark. May list more points than marks ("any two of").',
          items: { type: 'object', additionalProperties: false, required: ['point', 'marks'], properties: { point: { type: 'string' }, marks: { type: 'integer' } } },
        },
        markbands: { type: 'string', description: 'For parts marked on markbands or criteria: the bands with their mark ranges and descriptors, as IB writes them. Empty otherwise.' },
        indicative_content: { type: 'array', items: { type: 'string' }, description: 'For written parts: what a good answer is likely to include. Empty otherwise.' },
        guidance: { type: 'string' },
      },
    },
  },
}

const SECTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'title', 'stimulus', 'figure', 'parts'],
        properties: {
          number: { type: 'string' },
          title: { type: 'string', description: 'The topic or theme the question is on, for the contents. Empty for multiple choice.' },
          stimulus: { type: 'string', description: 'The text, extract, case study, source or data the question is built on, written fresh. Empty if none.' },
          figure: { type: 'string', description: 'A figure as JSON in the shapes given, or "none".' },
          parts: { type: 'array', items: PART },
        },
      },
    },
  },
}

/* --------------------------------------------------------------- prompts --- */

const RULES = `You write predicted exam papers for the IB Diploma Programme. A student sits them to prepare for the real exam, so each must be in exactly the real paper's format and as close to a real IB paper as possible in style, demand, command terms and marking.

- Follow the format you are given exactly: the number of questions offered, how they are divided into parts, and the marks for each part and for the section.
- Write everything fresh: new data, new extracts, new case studies, new contexts. Never copy or reword a real past-paper question or a published text. A stimulus may be set in a real country or industry, but its figures are invented and must be internally consistent.
- Use IB command terms exactly, with marks that match their demand.
- Every part has a markscheme in IB style. Analytic parts: what earns each mark (M1/A1 for maths and sciences, "any two of" where that is the convention). Parts marked on markbands or criteria: the bands with mark ranges and descriptors, plus indicative content.
- Where IB accepts a numeric answer with or without its sign (an elasticity, a change described as a fall), list both signs in accepted_answers.
- Correctness: work every calculation fully before writing it. Give exactly the data needed. Multiple choice has exactly one correct option.
- Maths notation: x^2, v_1, m s^-1 written plainly; other maths in single dollars ($\\frac{a}{b}$). Never put a currency amount in dollars.
- Figures, when a question needs one, as JSON: table {"kind":"table","alt":"...","columns":[...],"rows":[[...]]}; plot or scatter {"kind":"plot","alt":"...","x_label":"...","y_label":"...","points":[{"x":0,"y":0}]}; bar {"kind":"bar","alt":"...","bars":[{"label":"A","value":3}]}; circuit {"kind":"circuit","alt":"...","source":"12 V","series":[{"type":"resistor","label":"R1 = 2.0 Ω"}],"parallel":[]}; forces {"kind":"forces","alt":"...","surface":"incline","angle_deg":30,"body":"block","forces":[{"label":"W","direction_deg":270,"size":1},{"label":"N","direction_deg":60,"size":0.9,"from":"contact"},{"label":"F","direction_deg":30,"size":0.8,"angle_label":"30°"}],"motion":{"direction_deg":0,"label":"direction of motion"}}. Otherwise "none".`

function sectionPrompt(u, syllabus, focus) {
  const p = u.paper
  const s = u.section
  // An HL paper mixes SL and HL content, as the real ones do; a paper the
  // guide describes as the HL extension leans on the HL topics without
  // leaving SL out. The one exception is a paper the guide says is SL
  // material only even at HL (Economics Paper 2 is the same paper for both).
  const hlRow = (r) => r.hl_only || r.hl_extension
  const slOnly = u.level === 'SL' || /SL material only|standard level material only|excluding (the )?HL|excludes (the )?HL/i.test(p.content)
  const hlLean = !slOnly && /HL extension|HL-only|higher level extension/i.test(p.content)
  const rows = syllabus.filter((r) => !slOnly || !hlRow(r))
  const topics = [...new Set(rows.map((r) => r.topic))]
  const byTopic = topics
    .map((t) => `${t}: ${rows.filter((r) => r.topic === t).map((r) => `${r.subtopic}${!slOnly && hlRow(r) ? ' [HL]' : ''}`).join('; ')}`)
    .join('\n')
  const mix = slOnly
    ? 'No HL-only topics may appear anywhere in this paper.'
    : hlLean
      ? 'Most marks should come from the HL topics, marked [HL], with SL content used within questions as the real paper does.'
      : 'Mix SL and HL topics (HL ones are marked [HL]) in the proportions the real HL paper uses.'
  const count =
    s.from > 0
      ? `Write exactly ${s.from} question${s.from === 1 ? '' : 's'}${s.answer < s.from ? ` (the candidate answers ${s.answer})` : ''}${s.style === 'multiple_choice' ? `, each worth 1 mark` : ''}.`
      : `Write as many questions as the real paper has in this section, so the section totals exactly ${s.marks} marks.`
  return `COURSE: IB ${COURSE} ${u.level}${R.language !== 'English' ? `\nLANGUAGE: write the whole paper in ${R.language}, as the real ${COURSE} paper is` : ''}
PAPER: ${p.name}, ${p.minutes} minutes, ${p.marks} marks${p.calculator === 'no' ? ', no calculator' : p.calculator === 'yes' ? ', calculator allowed' : ''}
DRAWS ON: ${p.content}. ${mix}

THIS SECTION: ${s.name} — ${s.marks} marks — ${s.instructions}
Style: ${s.style.replace(/_/g, ' ')}. Marking: ${s.marking.replace(/_/g, ' ')}.
${s.parts ? `How each question is divided: ${s.parts}` : ''}
${s.notes ? `Notes: ${s.notes}` : ''}

${count}

THE SYLLABUS (questions come only from here):
${byTopic}

This is version ${u.version}. Spread the questions across the syllabus as a real paper does, but lean on these topics so that each version covers different ground: ${focus.join('; ')}.`
}

/* ---------------------------------------------------------------- checks --- */

/** Structure and marks against the blueprint, at no cost. */
function checkSection(u, data) {
  const s = u.section
  const problems = []
  const qs = data?.questions || []
  if (s.from > 0 && qs.length !== s.from) problems.push(`${qs.length} questions written, ${s.from} wanted`)
  const totals = qs.map((q) => q.parts.reduce((a, p) => a + (p.marks || 0), 0))
  if (s.style === 'multiple_choice') {
    if (qs.some((q) => q.parts.length !== 1 || q.parts[0].type !== 'mcq' || q.parts[0].marks !== 1)) problems.push('a multiple-choice item is not a single 1-mark question')
  } else if (s.from > 0 && s.answer > 0 && s.answer < s.from) {
    // A choice ("answer 2 of 3"): each question the candidate might choose
    // carries the same marks. Where every question is answered, they differ
    // as on the real paper (2, 4, 6, then a 12-mark one) and only the total counts.
    const each = s.marks / s.answer
    totals.forEach((t, i) => {
      if (Math.abs(t - each) > 0.01) problems.push(`question ${qs[i].number} totals ${t} marks, ${each} wanted`)
    })
  } else {
    const sum = totals.reduce((a, b) => a + b, 0)
    if (sum !== s.marks) problems.push(`section totals ${sum} marks, ${s.marks} wanted`)
  }
  for (const q of qs) {
    const f = readFigure(q.figure)
    if (f.error) problems.push(`question ${q.number}: ${f.error}`)
    else if (f.figure.kind !== 'none')
      problems.push(
        ...checkFigure(f.figure, `${q.stimulus} ${q.parts.map((p) => p.prompt).join(' ')}`)
          // A case study's table of data is part of the case, as on the real
          // papers, whether or not a sentence points at it.
          .filter((p) => !(f.figure.kind === 'table' && /never refers to/.test(p)))
          .map((p) => `question ${q.number}: ${p}`)
      )
    q.figure = f.figure || { kind: 'none', alt: '' }
    for (const p of q.parts) {
      const where = `question ${q.number}${p.label ? ` (${p.label})` : ''}`
      if (p.type === 'mcq') {
        const ids = (p.options || []).map((o) => o.id)
        if (ids.length !== 4 || !ids.includes(p.correct_answer)) problems.push(`${where}: needs 4 options including the answer`)
      }
      if (p.type === 'numeric') {
        const first = parseNumber(p.accepted_answers?.[0])
        if (first == null) problems.push(`${where}: numeric answer missing`)
        else p.accepted_answers = p.accepted_answers.filter((a, i) => i === 0 || sameValue(parseNumber(a), first))
      }
      const ms = p.markscheme || {}
      const analytic = (ms.points || []).reduce((a, x) => a + (x.marks || 0), 0)
      if (p.type !== 'mcq' && analytic < p.marks && !String(ms.markbands || '').trim()) problems.push(`${where}: markscheme covers ${analytic} of ${p.marks} marks`)
    }
  }
  return problems
}

const BLIND = {
  type: 'object',
  additionalProperties: false,
  required: ['answers'],
  properties: {
    answers: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['id', 'answer', 'confident'], properties: { id: { type: 'string' }, answer: { type: 'string' }, confident: { type: 'boolean' } } },
    },
  },
}

/** Every multiple-choice and numeric part, with what it stands on. */
function objectiveParts(key, data) {
  const out = []
  for (const q of data.questions) {
    q.parts.forEach((p, pi) => {
      if (p.type !== 'mcq' && p.type !== 'numeric') return
      out.push({ id: `${key}|${q.number}|${pi}`, q, p })
    })
  }
  return out
}

function agrees(p, answer) {
  const a = String(answer ?? '').trim()
  if (p.type === 'mcq') return a.toLowerCase().replace(/[^a-d]/g, '').startsWith(p.correct_answer)
  const n = parseNumber(a)
  const want = parseNumber(p.accepted_answers?.[0])
  // A match in size with only the sign different is agreement: the numbers
  // are right and the sign is a convention (PED, "a fall of").
  return sameValue(n, want) || (n != null && want != null && sameValue(Math.abs(n), Math.abs(want)))
}

/* ---------------------------------------------------------------- stages --- */

async function write(round = 1) {
  // Only what is missing or failed: a section that passed is never rewritten.
  const todo = units().filter((u) => !['written', 'checked'].includes(state.sections[u.key]?.status) && (state.sections[u.key]?.round || 0) < round)
  if (!todo.length) return log(`write: nothing to write in round ${round}`)
  const syllabi = {}
  for (const level of new Set(todo.map((u) => u.level))) syllabi[level] = await syllabusFor(level)
  log(`write round ${round}: ${todo.length} sections`)
  const requests = todo.map((u) => {
    const retry = state.sections[u.key]?.problems?.length
      ? `\n\nA previous version of this section failed these checks, so avoid them:\n${state.sections[u.key].problems.map((p) => `- ${p}`).join('\n')}`
      : ''
    return {
      custom_id: `${u.key}-r${round}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      meta: u,
      params: claudeParams({
        model: 'claude-sonnet-5-5',
        system: [RULES],
        user: sectionPrompt(u, syllabi[u.level], emphasis(syllabi[u.level], u.version)) + retry,
        schema: SECTION_SCHEMA,
        maxTokens: 48000,
      }),
    }
  })
  const out = await claude(requests, `write-${round}`)
  for (const r of requests) {
    const res = out[r.custom_id]
    const u = r.meta
    const problems = res?.data ? checkSection(u, res.data) : [res?.error || 'not written']
    state.sections[u.key] = { round, data: res?.data || null, problems, status: problems.length ? 'failed' : 'written', cost: res?.cost || 0 }
  }
  save()
  log(`  ${todo.filter((u) => state.sections[u.key].status === 'written').length}/${todo.length} passed the structure checks`)
}

async function check(round = 1) {
  const todo = units().filter((u) => state.sections[u.key]?.status === 'written' && state.sections[u.key].round === round)
  const items = todo.flatMap((u) => objectiveParts(u.key, state.sections[u.key].data))
  if (!items.length) {
    for (const u of todo) state.sections[u.key].status = 'checked'
    save()
    return log('check: no multiple-choice or numeric parts to solve')
  }
  const requests = []
  for (let i = 0; i < items.length; i += 12) {
    const part = items.slice(i, i + 12)
    requests.push({
      custom_id: `b${round}_${i}`,
      meta: part.map((x) => x.id),
      params: claudeParams({
        model: 'claude-haiku-5-5',
        system: ['You solve exam questions carefully and independently.'],
        user: `Solve each independently. Multiple choice: the option letter. Numeric: the bare number. If ambiguous or unanswerable, confident false.\n\n${part
          .map((x) => `[${x.id}]\n${x.q.stimulus ? `Context: ${x.q.stimulus}\n` : ''}${x.q.figure?.kind !== 'none' ? `Figure: ${JSON.stringify(x.q.figure)}\n` : ''}${x.p.prompt}${x.p.type === 'mcq' ? '\n' + x.p.options.map((o) => `  ${o.id}) ${o.text}`).join('\n') : ''}`)
          .join('\n\n')}`,
        schema: BLIND,
        maxTokens: 24000,
      }),
    })
  }
  log(`check: ${items.length} objective parts solved blind`)
  const out = await claude(requests, `blind-${round}`)
  const answers = new Map(Object.values(out).flatMap((o) => o.data?.answers || []).map((a) => [a.id, a]))
  for (const u of todo) {
    const sec = state.sections[u.key]
    const wrong = objectiveParts(u.key, sec.data).filter((x) => {
      const a = answers.get(x.id)
      return !(a && a.confident && agrees(x.p, a.answer))
    })
    if (wrong.length) {
      sec.problems = wrong.map((x) => `question ${x.q.number} part ${x.p.label}: an independent solve gave ${answers.get(x.id)?.answer ?? 'nothing'}${answers.get(x.id)?.confident === false ? ' (not confident)' : ''}, the markscheme says ${x.p.type === 'mcq' ? x.p.correct_answer : x.p.accepted_answers?.[0]}`)
      sec.status = 'failed'
    } else sec.status = 'checked'
  }
  save()
  log(`  ${todo.filter((u) => state.sections[u.key].status === 'checked').length}/${todo.length} sections agreed`)
}

const AUDIT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['publish', 'fix', 'reject'] },
    format_matches: { type: 'boolean' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'format_matches', 'problems'],
}

async function audit() {
  const papers = new Map()
  for (const u of units()) {
    const id = `${u.level}-${u.paper.id}-v${u.version}`
    if (!papers.has(id)) papers.set(id, { id, level: u.level, paper: u.paper, version: u.version, units: [] })
    papers.get(id).units.push(u)
  }
  state.audits ||= {}
  for (const p of papers.values()) {
    if (state.audits[p.id]) continue
    if (!p.units.every((u) => state.sections[u.key]?.status === 'checked')) continue
    if (p.version > AUDIT_VERSIONS) continue
    const content = p.units.map((u) => ({ section: u.section.name, questions: state.sections[u.key].data.questions }))
    let res
    try {
      res = await askGemini(
      [
        {
          text: `You are checking a predicted IB exam paper before students sit it. The official format is below, from the IB subject guide. Check that the paper follows it exactly, that every question, answer and markscheme is correct, and that it reads like a real IB paper (command terms, demand, marks). Be strict and specific.

OFFICIAL FORMAT: ${JSON.stringify(p.paper)}

THE PAPER (IB ${COURSE} ${p.level}, version ${p.version}): ${JSON.stringify(content)}`,
        },
      ],
      AUDIT,
      { cap: GEMINI_CAP, note: `${slug} audit` }
    )
    } catch (e) {
      if (!(e instanceof OverBudget)) throw e
      log('  Gemini credit is used up: the remaining papers are not audited')
      break
    }
    state.audits[p.id] = res
    if (res.verdict === 'reject') {
      for (const u of p.units) state.sections[u.key] = { ...state.sections[u.key], status: 'failed', problems: res.problems }
      // Already published: students stop seeing it (only verified papers are readable).
      const subject = R.language !== 'English' || /^\w+ (A:|B|ab initio)/.test(COURSE) ? `${COURSE} ${p.level}` : `${R.base} ${p.level}`
      const db = await connect({ quiet: true })
      await db.query(`update exam_papers set verified = false where subject = $1 and paper = $2 and version = $3`, [subject, p.paper.id, p.version])
      await db.end()
    }
    save()
    log(`  ${p.id}: ${res.verdict}${res.problems.length ? ` — ${res.problems.slice(0, 2).join(' | ').slice(0, 220)}` : ''}`)
  }
}

async function publish() {
  const db = await connect({ quiet: true })
  let n = 0
  const papers = new Map()
  for (const u of units()) {
    const id = `${u.level}-${u.paper.id}-v${u.version}`
    if (!papers.has(id)) papers.set(id, { level: u.level, paper: u.paper, version: u.version, units: [] })
    papers.get(id).units.push(u)
  }
  for (const [id, p] of papers) {
    if (!p.units.every((u) => state.sections[u.key]?.status === 'checked') || state.audits?.[id]?.verdict === 'reject') continue
    const subject = R.language !== 'English' || /^\w+ (A:|B|ab initio)/.test(COURSE) ? `${COURSE} ${p.level}` : `${R.base} ${p.level}`
    const content = {
      instructions: p.paper.sections.map((s) => s.instructions).join(' '),
      calculator: p.paper.calculator,
      skipped: p.paper.sections.filter((s) => /listening/i.test(s.name)).map((s) => s.name),
      sections: p.units.map((u) => ({
        name: u.section.name,
        instructions: u.section.instructions,
        answer: u.section.answer,
        from: u.section.from,
        marks: u.section.marks,
        marking: u.section.marking,
        questions: state.sections[u.key].data.questions,
      })),
    }
    const marks = content.sections.reduce((a, s) => a + s.marks, 0)
    await db.query(
      `insert into exam_papers (subject, paper, version, exam_from, name, minutes, marks, content, verified, generator)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,true,'claude-sonnet-5-5/normal')
       on conflict (subject, paper, version, coalesce(exam_from, 0)) do update set name = excluded.name, minutes = excluded.minutes,
         marks = excluded.marks, content = excluded.content, verified = true`,
      [subject, p.paper.id, p.version, R.examFrom, p.paper.name, p.paper.minutes, marks, JSON.stringify(content)]
    )
    n++
  }
  await db.end()
  log(`publish: ${n} papers`)
}

function report() {
  const spend = Object.values(state.sections).reduce((a, s) => a + (s.cost || 0), 0)
  const by = Object.values(state.sections).reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {})
  log(`\n${COURSE}: sections ${JSON.stringify(by)}; writing cost $${spend.toFixed(3)}`)
}

try {
  if (STAGE === 'all') {
    for (const round of [1, 2]) {
      await write(round)
      await check(round)
    }
    await audit()
    // A paper Gemini rejected gets one more go.
    if (Object.values(state.sections).some((s) => s.status === 'failed' && s.round < 3)) {
      await write(3)
      await check(3)
      await audit()
    }
    log('\nChecked and waiting. Review, then --stage publish.')
  } else if (STAGE === 'check') {
    // Failed sections are checked again against the current rules (not
    // waved through), except those a Gemini audit rejected.
    for (const u of units()) {
      const sec = state.sections[u.key]
      if (!sec?.data || sec.status !== 'failed' || state.audits?.[`${u.level}-${u.paper.id}-v${u.version}`]?.verdict === 'reject') continue
      sec.problems = checkSection(u, sec.data)
      if (!sec.problems.length) sec.status = 'written'
    }
    save()
    // Every round written so far, not only the first three: rewrites go on to round 4, 5…
    const rounds = [...new Set(Object.values(state.sections).map((x) => x.round || 1))].sort((a, b) => a - b)
    for (const round of rounds) await check(round)
    await audit()
  } else if (STAGE === 'rewrite') {
    // One more go for the sections still failing, and only those.
    const round = Math.max(0, ...Object.values(state.sections).map((s) => s.round || 0)) + 1
    await write(round)
    await check(round)
    await audit()
  } else if (STAGE === 'publish') await publish()
  else if (STAGE === 'audit') await audit()
  else throw new Error(`No stage "${STAGE}".`)
} catch (e) {
  if (e instanceof OverBudget) log(`Stopped: ${e.message}`)
  else throw e
} finally {
  report()
}
