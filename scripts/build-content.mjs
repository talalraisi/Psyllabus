/**
 * The second question bank, lessons and flashcards, one course at a time.
 *
 * Stages, each saved to content-runs/<course>.json so a run can stop and
 * carry on without paying twice:
 *
 *   plan       subtopics, their IB guide sections and teaching hours, and
 *              how many questions each gets at each heat
 *   questions  each tier writes its heats; free code checks; one rewrite
 *              for anything that fails them
 *   blind      Haiku solves every question without seeing the answer
 *   rule       where Haiku disagreed: Haiku-written questions are dropped,
 *              Sonnet-written ones go to Gemini Pro, also blind, and stay
 *              only if Gemini agrees with the writer
 *   audit      Gemini Pro audits a random sample: subtopic, IB style, heat,
 *              feedback; rejects are dropped and rates are reported per tier
 *   lessons    a lesson and its flashcards per subtopic, code-checked, then
 *              Haiku answers every check question blind and reviews the facts
 *   publish    written to every course that has the subtopic (SL and HL),
 *              with --retire-old switching off the first bank in the same
 *              subtopics
 *
 * Usage:
 *   node scripts/build-content.mjs --course Physics --codes A.1,A.2,A.3
 *   node scripts/build-content.mjs --course Physics --stage publish --retire-old
 *
 * Options: --stage <name|all>  --direct (full price, no batch wait)
 *          --claude-cap 60  --gemini-cap 25  --audit 40  --limit <subtopics>
 *          --run <name> (a separate state file, for trial runs)
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadEnv, connect } from './db.mjs'
import { guideSection, hoursIn } from './content/guide.mjs'
import { groupOf, planCounts, TIER_OF_HEAT, TIERS, HEAT_DIFFICULTY, HEAT_WORDS, HEAT_ORDER } from './content/formats.mjs'
import { RULES, subjectBlock, slotsFor, questionPrompt, lessonPrompt3, blindPrompt } from './content/prompts.mjs'
import { QUESTIONS, LESSON3, BLIND } from './content/schemas.mjs'
import { checkQuestion, sameValue, readFigure, repairQuestion, readLesson3 } from './content/checks.mjs'
import { runClaude, claudeParams, askGemini, ledger, RUNS, OverBudget } from './content/models.mjs'
import { parseNumber } from '../lib/grading.js'
import { checkWritten } from '../lib/flashcard-modes.js'

loadEnv()

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = process.argv[i + 1]
  return v === undefined || v.startsWith('--') ? true : v
}
const COURSE = arg('course')
if (!COURSE) {
  console.error('Name a course: --course Physics')
  process.exit(1)
}
const STAGE = arg('stage', 'all')
const DIRECT = Boolean(arg('direct', false))
const CLAUDE_CAP = Number(arg('claude-cap', 60))
const GEMINI_CAP = Number(arg('gemini-cap', 25))
const AUDIT_N = Number(arg('audit', 40))
const CODES = arg('codes') ? String(arg('codes')).split(',').map((s) => s.trim()) : null
const LIMIT = arg('limit') ? Number(arg('limit')) : null
const CHUNK = { basic: 8, middle: 6, hard: 4 }

const slug = String(arg('run', COURSE)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const STATE_FILE = path.join(RUNS, `${slug}.json`)
fs.mkdirSync(RUNS, { recursive: true })
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { course: COURSE, batches: {} }
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1))
const log = (...a) => console.log(...a)

const spend = (what, out) => {
  state.spend ||= {}
  state.spend[what] = (state.spend[what] || 0) + Object.values(out).reduce((a, r) => a + (r.cost || 0), 0)
}

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

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9.\-]+/g, ' ').trim()

/* ------------------------------------------------------------------ plan --- */

async function plan() {
  const db = await connect({ quiet: true })
  const { rows } = await db.query(
    `select subject, topic, subtopic, code, unit, position from syllabus_content
     where curriculum = 'IB' and subject in ($1, $1 || ' SL', $1 || ' HL')
     order by position`,
    [COURSE]
  )
  await db.end()
  if (!rows.length) throw new Error(`No syllabus rows for "${COURSE}".`)

  const byKey = new Map()
  for (const r of rows) {
    const key = `${r.topic}|${r.subtopic}`
    if (!byKey.has(key)) byKey.set(key, { topic: r.topic, subtopic: r.subtopic, code: r.code, unit: r.unit, courses: [] })
    byKey.get(key).courses.push(r.subject)
  }
  let subtopics = [...byKey.values()]
  if (CODES) subtopics = subtopics.filter((s) => CODES.includes(s.code))
  if (LIMIT) subtopics = subtopics.slice(0, LIMIT)

  const group = groupOf(rows[0].subject)
  const siblings = {}
  for (const s of subtopics) siblings[s.code] = (siblings[s.code] || 0) + 1
  for (const s of subtopics) {
    const g = guideSection({ subject: s.courses[0], code: s.code, unit: s.unit, topic: s.topic })
    s.guide = g?.text || null
    s.guideHow = g?.how || 'not found'
    s.hours = hoursIn(g?.text)
    s.siblings = siblings[s.code]
  }
  state.group = group
  state.courses = [...new Set(rows.map((r) => r.subject))]
  state.subtopics = planCounts(subtopics, group)
  state.questions = state.questions || []
  save()

  const total = state.subtopics.reduce((a, s) => a + s.total, 0)
  const found = state.subtopics.filter((s) => s.guide).length
  log(`${COURSE}: ${state.subtopics.length} subtopics (${state.courses.join(', ')}), group ${group}`)
  log(`  guide sections found for ${found}/${state.subtopics.length}; ${total} questions planned`)
  for (const h of ['low', 'medium', 'hot', 'extreme', 'burning']) {
    log(`  ${h.padEnd(8)} ${state.subtopics.reduce((a, s) => a + s.heats[h], 0)}`)
  }
}

/* ------------------------------------------------------------- questions --- */

function systemFor() {
  return [RULES, subjectBlock(COURSE, state.group)]
}

function requestsFor(work, round) {
  // work: [{sub, tier, slots}] — slots carry their own ids
  return work.map((w, i) => {
    const s = state.subtopics[w.sub]
    const numbered = w.slots.map((sl, k) => ({ ...sl, slot: k + 1 }))
    const retry = w.problems?.length
      ? `\n\nA previous attempt at these slots failed these checks, so avoid them:\n${w.problems.map((p) => `- ${p}`).join('\n')}`
      : ''
    const avoid = state.questions.filter((q) => q.sub === w.sub && q.status !== 'failed').map((q) => q.q.stem.slice(0, 160))
    const neighbours = state.subtopics.filter((o, k) => k !== w.sub && o.code === s.code).map((o) => o.subtopic)
    const tier = TIERS[w.tier]
    return {
      custom_id: `q_${w.sub}_${w.tier}_${i}_${round}`,
      meta: { ...w, numbered },
      params: claudeParams({
        model: tier.model,
        effort: tier.effort,
        system: systemFor(),
        user: questionPrompt({ topic: s.topic, subtopic: s.subtopic, guide: s.guide, slots: numbered, avoid, neighbours }) + retry,
        schema: QUESTIONS,
      }),
    }
  })
}

function take(results, requests, round) {
  const missing = []
  for (const r of requests) {
    const res = results[r.custom_id]
    const { sub, tier, numbered } = r.meta
    state.spend ||= {}
    state.spend[`write-${tier}`] = (state.spend[`write-${tier}`] || 0) + (res?.cost || 0)
    const got = new Map((res?.data?.questions || []).map((q) => [q.slot, q]))
    for (const sl of numbered) {
      const q = got.get(sl.slot)
      // Mend what is safe to mend first, so one stray accepted variant does
      // not send a good question back to be rewritten.
      const repairs = q ? repairQuestion(q) : []
      const problems = q ? checkQuestion(q, sl) : [res?.error ? `request failed: ${res.error}` : 'not written']
      // Figures arrive as JSON text; from here on they are data.
      if (q) q.figure = readFigure(q.figure).figure || { kind: 'none', alt: '' }
      const key = `${sub}-${sl.id}`
      state.questions = state.questions.filter((x) => x.key !== key)
      if (q) {
        state.questions.push({ key, sub, tier, slot: sl, q, problems, repairs, round, status: problems.length ? 'failed' : 'checked' })
      }
      if (problems.length) missing.push({ sub, tier, slot: sl, problems })
    }
  }
  save()
  return missing
}

async function questions() {
  const work = []
  state.subtopics.forEach((s, sub) => {
    for (const tier of ['basic', 'middle', 'hard']) {
      const heats = Object.fromEntries(Object.entries(s.heats).map(([h, n]) => [h, TIER_OF_HEAT[h] === tier ? n : 0]))
      const slots = slotsFor(heats, state.group, sub * 3).map((sl, k) => ({ ...sl, id: `${tier}${k}` }))
      const todo = slots.filter((sl) => !state.questions.some((q) => q.key === `${sub}-${sl.id}` && q.status !== 'failed'))
      for (let i = 0; i < todo.length; i += CHUNK[tier]) work.push({ sub, tier, slots: todo.slice(i, i + CHUNK[tier]) })
    }
  })
  if (!work.length) return log('questions: nothing left to write')
  log(`questions: ${work.reduce((a, w) => a + w.slots.length, 0)} to write in ${work.length} requests`)

  const first = requestsFor(work, 1)
  const failed = take(await claude(first, 'questions-1'), first, 1)
  log(`  round 1: ${failed.length} failed the code checks`)
  if (!failed.length) return

  // One rewrite, grouped back into requests, with the reasons attached.
  const retryWork = []
  for (const tier of ['basic', 'middle', 'hard']) {
    const bySub = {}
    for (const f of failed.filter((f) => f.tier === tier)) (bySub[f.sub] ||= []).push(f)
    for (const [sub, list] of Object.entries(bySub)) {
      for (let i = 0; i < list.length; i += CHUNK[tier]) {
        const part = list.slice(i, i + CHUNK[tier])
        retryWork.push({ sub: Number(sub), tier, slots: part.map((f) => f.slot), problems: [...new Set(part.flatMap((f) => f.problems))] })
      }
    }
  }
  const second = requestsFor(retryWork, 2)
  const still = take(await claude(second, 'questions-2'), second, 2)
  log(`  round 2: ${still.length} still failing, dropped`)
}

/**
 * Questions dropped by the code checks alone get the repairs and the checks
 * again. Costs nothing; used when the checks improve after a run has finished.
 */
async function repair() {
  let revived = 0
  for (const x of state.questions) {
    if (x.status !== 'failed' || x.ruling || x.audit) continue
    const repairs = repairQuestion(x.q)
    const problems = checkQuestion(x.q, x.slot)
    x.repairs = [...(x.repairs || []), ...repairs]
    x.problems = problems
    if (!problems.length) {
      x.status = 'checked'
      revived++
    }
  }
  save()
  log(`repair: ${revived} questions revived; ${state.questions.filter((x) => x.status === 'failed').length} still failing`)
}

/* ----------------------------------------------------------------- blind --- */

/** The subtopics of the unit a subtopic belongs to: the choices for "which does it test?". */
const unitOf = (sub) => state.subtopics.filter((o) => o.code === state.subtopics[sub].code).map((o) => o.subtopic)

function agrees(q, answer) {
  const a = String(answer ?? '').trim()
  if (!a) return false
  if (q.type === 'mcq') return a.toLowerCase().replace(/[^a-d]/g, '').startsWith(q.correct_answer)
  const accepted = q.accepted_answers || []
  if (q.answer_kind === 'numeric') {
    const n = parseNumber(a)
    const want = parseNumber(accepted[0])
    // Same size, other sign: the numbers agree and the sign is a convention.
    return sameValue(n, want) || (n != null && want != null && sameValue(Math.abs(n), Math.abs(want)))
  }
  return accepted.some((x) => norm(x) === norm(a)) || checkWritten(a, accepted.join(' / '), q.stem).correct
}

async function blind() {
  const todo = state.questions.filter((x) => x.status === 'checked' && !x.blind)
  if (!todo.length) return log('blind: nothing to check')
  const requests = []
  for (let i = 0; i < todo.length; i += 12) {
    const part = todo.slice(i, i + 12)
    requests.push({
      custom_id: `b_${i}`,
      meta: part.map((x) => x.key),
      params: claudeParams({
        model: 'claude-haiku-5-5',
        system: ['You solve IB exam questions carefully and independently.'],
        user: blindPrompt(part.map((x) => ({ id: x.key, q: x.q, choices: unitOf(x.sub) }))),
        schema: BLIND,
        maxTokens: 24000,
      }),
    })
  }
  log(`blind: ${todo.length} questions in ${requests.length} requests`)
  const out = await claude(requests, 'blind')
  spend('blind', out)
  for (const r of requests) {
    const answers = new Map((out[r.custom_id]?.data?.answers || []).map((a) => [a.id, a]))
    for (const key of r.meta) {
      const x = state.questions.find((q) => q.key === key)
      const a = answers.get(key)
      x.blind = a
        ? { answer: a.answer, confident: a.confident, agrees: a.confident && agrees(x.q, a.answer), steps: a.steps, heat: a.heat }
        : { agrees: false, answer: null }
      // A second opinion on the heat, trusted in one direction only. In
      // testing Haiku rated questions harder than the writer did while Gemini
      // judged the same questions easier, so an upward move is noise; a
      // question the solver found two levels easier than labelled is not.
      if (a?.heat && HEAT_ORDER.indexOf(x.q.heat) - HEAT_ORDER.indexOf(a.heat) >= 2) {
        x.q.heat_written = x.q.heat
        x.q.heat = a.heat
      }
      // Which subtopic it really tests. A question about a neighbour moves
      // there rather than being wasted.
      const home = a?.tests ? state.subtopics.findIndex((o) => o.subtopic === a.tests) : -1
      if (Number.isInteger(home) && home >= 0 && home !== x.sub) {
        x.moved = { from: state.subtopics[x.sub].subtopic, to: a.tests }
        x.sub = home
      }
    }
  }
  save()
  const n = state.questions.filter((x) => x.blind && !x.blind.agrees).length
  const relabelled = todo.filter((x) => x.q.heat_written).length
  const moved = todo.filter((x) => x.moved).length
  log(`  Haiku disagreed with ${n} of ${todo.length}; heat lowered on ${relabelled}; ${moved} moved to the subtopic they really test`)
}

/* ------------------------------------------------------------------ rule --- */

const GEMINI_BLIND = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, answer: { type: 'string' }, confident: { type: 'boolean' } },
        required: ['id', 'answer', 'confident'],
      },
    },
  },
  required: ['answers'],
}

async function rule() {
  const disputed = state.questions.filter((x) => x.status === 'checked' && x.blind && !x.blind.agrees && !x.ruling)
  for (const x of disputed.filter((x) => x.tier === 'basic')) {
    x.ruling = 'dropped: Haiku-written and the blind check disagreed'
    x.status = 'failed'
  }
  const toGemini = disputed.filter((x) => x.tier !== 'basic')
  log(`rule: ${disputed.length - toGemini.length} Haiku questions dropped, ${toGemini.length} Sonnet questions to Gemini`)
  for (let i = 0; i < toGemini.length; i += 10) {
    const part = toGemini.slice(i, i + 10)
    const res = await askGemini([{ text: blindPrompt(part.map((x) => ({ id: x.key, q: x.q }))) }], GEMINI_BLIND, {
      cap: GEMINI_CAP,
      note: `${slug} rule`,
    })
    const answers = new Map((res.answers || []).map((a) => [a.id, a]))
    for (const x of part) {
      const a = answers.get(x.key)
      const ok = a && a.confident && agrees(x.q, a.answer)
      x.ruling = ok ? `kept: Gemini agreed with the writer (${a.answer})` : `dropped: Gemini said ${a?.answer ?? 'nothing'}`
      if (!ok) x.status = 'failed'
    }
    save()
  }
  for (const x of state.questions) if (x.status === 'checked' && (x.blind?.agrees || x.ruling?.startsWith('kept'))) x.status = 'passed'
  save()
  log(`  ${state.questions.filter((x) => x.status === 'passed').length} questions passed so far`)
}

/* ----------------------------------------------------------------- audit --- */

const AUDIT = {
  type: 'object',
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          in_subtopic: { type: 'boolean' },
          ib_style: { type: 'integer' },
          heat_right: { type: 'boolean' },
          feedback_ok: { type: 'boolean' },
          verdict: { type: 'string', enum: ['publish', 'fix', 'reject'] },
          problems: { type: 'string' },
        },
        required: ['id', 'in_subtopic', 'ib_style', 'heat_right', 'feedback_ok', 'verdict', 'problems'],
      },
    },
  },
  required: ['reviews'],
}

async function audit() {
  const passed = state.questions.filter((x) => x.status === 'passed' && !x.audit)
  if (!passed.length) return log('audit: nothing to audit')
  // A sample from every tier and heat, not whichever came first.
  const shuffled = [...passed].sort((a, b) => crypto.createHash('md5').update(a.key).digest('hex').localeCompare(crypto.createHash('md5').update(b.key).digest('hex')))
  const picked = []
  for (const tier of ['basic', 'middle', 'hard']) picked.push(...shuffled.filter((x) => x.tier === tier).slice(0, Math.ceil(AUDIT_N / 3)))
  log(`audit: ${picked.length} questions sampled for Gemini`)
  for (let i = 0; i < picked.length; i += 10) {
    const part = picked.slice(i, i + 10)
    const text = `You check IB exam questions before students see them. Be strict and specific. For each item:
- in_subtopic: does it test the subtopic named, rather than a neighbouring one?
- ib_style: 1-5, would it look normal on an IB paper (command term, marks matching demand, realistic context, exactly the data needed)?
- heat_right: is the stated heat right? ${Object.values(HEAT_WORDS).join(' ')}
- feedback_ok: does each wrong option's or wrong typed answer's stated mistake really produce it (recompute), and do accepted answers contain only the correct value?
- verdict: publish, fix (usable but flawed) or reject (wrong, off-topic or misleading).

${part.map((x) => `[${x.key}] Subtopic "${state.subtopics[x.sub].subtopic}", heat ${x.q.heat}\n${JSON.stringify(x.q)}`).join('\n\n')}`
    const res = await askGemini([{ text }], AUDIT, { cap: GEMINI_CAP, note: `${slug} audit` })
    const reviews = new Map((res.reviews || []).map((r) => [r.id, r]))
    for (const x of part) {
      x.audit = reviews.get(x.key) || { verdict: 'none' }
      if (x.audit.verdict === 'reject') x.status = 'failed'
    }
    save()
  }
  for (const tier of ['basic', 'middle', 'hard']) {
    const a = picked.filter((x) => x.tier === tier && x.audit)
    const count = (v) => a.filter((x) => x.audit.verdict === v).length
    log(`  ${tier.padEnd(6)} ${a.length} audited: ${count('publish')} publish, ${count('fix')} fix, ${count('reject')} reject; heat wrong ${a.filter((x) => x.audit.heat_right === false).length}`)
  }
}

/* --------------------------------------------------------------- lessons --- */

const LESSON_REVIEW = {
  type: 'object',
  additionalProperties: false,
  required: ['answers', 'errors', 'bad_cards'],
  properties: {
    answers: BLIND.properties.answers,
    errors: { type: 'array', items: { type: 'string' }, description: 'Every factual error or statement that goes beyond or contradicts the guide.' },
    bad_cards: { type: 'array', items: { type: 'integer' }, description: 'Indexes (from 0) of flashcards whose back is wrong or does not answer the front.' },
  },
}

/** A lesson interaction as a question the blind solver and agrees() understand. */
function asQuestion(c, figure) {
  if (c.kind === 'mcq') return { type: 'mcq', stem: c.prompt, options: c.options.map((o) => ({ id: o.id, text: o.text })), correct_answer: c.answer, figure }
  if (c.kind === 'truefalse') {
    return { type: 'mcq', stem: `True or false: ${c.statement}`, options: [{ id: 'a', text: 'True' }, { id: 'b', text: 'False' }], correct_answer: c.answer ? 'a' : 'b', figure }
  }
  if (c.kind === 'numeric') return { type: 'short_answer', answer_kind: 'numeric', stem: c.prompt, accepted_answers: c.accepted, answer_hint: c.unit ? `in ${c.unit}` : '', figure }
  return { type: 'short_answer', answer_kind: 'text', stem: c.prompt, accepted_answers: c.accepted || [], figure }
}

/** The checks a solver can answer blind: everything but match, order, sort and gap, which the reviewer reads. */
function lessonChecks(lesson) {
  const out = []
  lesson.screens.forEach((sc, si) =>
    sc.blocks.forEach((f, bi) => {
      if (f.type === 'check' && ['mcq', 'truefalse', 'numeric', 'short'].includes(f.data?.kind)) out.push({ id: `s${si}b${bi}`, q: asQuestion(f.data, f.figure) })
    })
  )
  lesson.outcomes.forEach((o, i) => out.push({ id: `o${i}`, q: asQuestion(o.check, undefined) }))
  return out
}

async function reviewLessons(review, round) {
  if (review.length) {
    const reqs = review.map((i) => {
      const l = state.lessons[i].lesson
      return {
        custom_id: `lr_${i}_${round}`,
        meta: i,
        params: claudeParams({
          model: 'claude-haiku-5-5',
          system: ['You check IB lessons for accuracy before students see them.'],
          user: `Guide section:\n${state.subtopics[i].guide || '(not available)'}\n\nLesson (screens of blocks; a block's figure is shown with it):\n${JSON.stringify({ ...l, screens: l.screens.map((sc) => ({ title: sc.title, blocks: sc.blocks.map((f) => ({ ...f, figure: f.figure?.kind !== 'none' ? f.figure : undefined })) })), outcomes: l.outcomes.map((o) => o.statement), cards: l.cards.map((c, k) => ({ k, ...c })) })}\n\n1. List every factual error in the lesson (including in match, order, sort and gap activities: is every pairing, order and grouping right?), anything that contradicts the guide, any section whose main teaching is a different subtopic instead of "${state.subtopics[i].subtopic}", and any reference to a table, graph or diagram that is not given as that section's figure. Standard IB terms and ordinary depth are not errors: do not list something only because the guide does not spell it out.\n2. List the indexes of flashcards whose back is wrong or does not answer the front.\n3. Then solve these check questions independently:\n\n${blindPrompt(lessonChecks(l))}`,
          schema: LESSON_REVIEW,
          maxTokens: 24000,
        }),
      }
    })
    const res = await claude(reqs, `lesson-review-${round}`)
    spend('lesson-review', res)
    for (const r of reqs) {
      const entry = state.lessons[r.meta]
      const data = res[r.custom_id]?.data
      if (!data) {
        entry.problems = ['review failed']
        continue
      }
      const answers = new Map(data.answers.map((a) => [a.id, a]))
      const wrong = lessonChecks(entry.lesson).filter((c) => {
        const a = answers.get(c.id)
        return !(a && a.confident && agrees({ ...c.q, type: c.q.type }, a.answer))
      })
      entry.problems = [...data.errors, ...wrong.map((c) => `check ${c.id} ("${c.q.stem.slice(0, 60)}") did not agree when solved independently`)]
      entry.badCards = data.bad_cards || []
      entry.status = entry.problems.length ? 'failed' : 'passed'
    }
  }
  for (const i of review) state.lessons[i].reviewed = true
  save()
}

async function lessons() {
  state.lessons = state.lessons || {}
  const lessonTier = ['languages', 'arts'].includes(state.group) ? TIERS.basic : TIERS.middle
  // Lessons in an older format are written again as screens.
  for (const [i, e] of Object.entries(state.lessons)) if (e.v !== 3) delete state.lessons[i]
  // Lessons that failed only the free checks get them again (the checks
  // improve), and go to review if they now pass; only the rest are rewritten.
  const recheck = []
  for (const [i, e] of Object.entries(state.lessons)) {
    if (e.status !== 'failed' || !e.raw || e.reviewed) continue
    const read = readLesson3(e.raw)
    e.lesson = read.lesson
    e.problems = read.problems
    if (!e.problems.length) {
      e.status = 'written'
      recheck.push(Number(i))
    }
  }
  if (recheck.length) log(`lessons: ${recheck.length} pass the checks now; reviewing them`)
  if (recheck.length) await reviewLessons(recheck, 'r')

  for (const round of [1, 2, 3, 4]) {
    const todo = state.subtopics.map((s, i) => i).filter((i) => state.lessons[i]?.status !== 'passed' && (state.lessons[i]?.round || 0) < round)
    if (!todo.length) continue
    log(`lessons round ${round}: ${todo.length} to write`)
    const requests = todo.map((i) => {
      const s = state.subtopics[i]
      const retry = state.lessons[i]?.problems?.length ? `\n\nA previous version failed these checks, so fix them:\n${state.lessons[i].problems.map((p) => `- ${p}`).join('\n')}` : ''
      return {
        custom_id: `l_${i}_${round}`,
        meta: i,
        params: claudeParams({
          model: lessonTier.model,
          effort: lessonTier.effort,
          system: systemFor(),
          user:
            lessonPrompt3({
              subject: COURSE,
              topic: s.topic,
              subtopic: s.subtopic,
              guide: s.guide,
              neighbours: state.subtopics.filter((o) => o !== s && o.code === s.code).map((o) => o.subtopic),
            }) + retry,
          schema: LESSON3,
        }),
      }
    })
    const out = await claude(requests, `lessons-${round}`)
    spend('lessons', out)
    for (const r of requests) {
      const data = out[r.custom_id]?.data
      const read = data ? readLesson3(data) : null
      state.lessons[r.meta] = data
        ? { v: 3, round, raw: data, lesson: read.lesson, problems: read.problems, status: 'written' }
        : { v: 3, round, problems: [out[r.custom_id]?.error || 'not written'], status: 'failed' }
    }
    save()

    await reviewLessons(todo.filter((i) => state.lessons[i].status === 'written' && !state.lessons[i].problems.length), round)
    for (const i of todo) if (state.lessons[i].status === 'written') state.lessons[i].status = 'failed'
    save()
    log(`  ${Object.values(state.lessons).filter((l) => l.status === 'passed').length}/${state.subtopics.length} lessons passed`)
  }
}

/* --------------------------------------------------------------- publish --- */

function rowFor(x, subject) {
  const s = state.subtopics[x.sub]
  const q = x.q
  const mcq = q.type === 'mcq'
  return {
    subject,
    topic: s.topic,
    subtopic: s.subtopic,
    question_type: mcq ? 'mcq' : 'short_answer',
    stem: q.stem,
    options: mcq ? q.options.map((o) => ({ id: o.id, text: o.text })) : null,
    correct_answer: mcq ? q.correct_answer : q.accepted_answers[0],
    accepted_answers: mcq ? null : q.accepted_answers,
    answer_kind: mcq ? null : q.answer_kind,
    answer_hint: mcq ? null : q.answer_hint || null,
    explanation: q.explanation,
    hint: q.hint,
    option_feedback: mcq ? Object.fromEntries(q.options.filter((o) => o.id !== q.correct_answer).map((o) => [o.id, o.why_wrong])) : null,
    wrong_answer_feedback: mcq ? null : q.wrong_answers,
    figure: q.figure?.kind && q.figure.kind !== 'none' ? q.figure : null,
    stimulus: q.stimulus || null,
    markscheme: q.markscheme,
    marks: q.marks,
    time_budget_seconds: q.marks * 72,
    difficulty: HEAT_DIFFICULTY[q.heat],
    generator: TIERS[x.tier].label,
  }
}

const fingerprint = (s) => crypto.createHash('sha1').update(norm(s)).digest('hex').slice(0, 20)

async function publish() {
  const db = await connect({ quiet: true })
  const started = new Date()
  const ready = state.questions.filter((x) => x.status === 'passed')
  let qIn = 0
  let qDup = 0
  for (const x of ready) {
    for (const subject of state.subtopics[x.sub].courses) {
      const r = rowFor(x, subject)
      const res = await db.query(
        `insert into questions (curriculum, subject, topic, subtopic, question_type, stem, options, correct_answer,
           accepted_answers, answer_kind, answer_hint, explanation, hint, option_feedback, wrong_answer_feedback,
           figure, stimulus, markscheme, marks, time_budget_seconds, difficulty, source, verified, generator)
         values ('IB',$1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17::jsonb,$18,$19,$20,'ai-generated',true,$21)
         on conflict do nothing`,
        [
          r.subject, r.topic, r.subtopic, r.question_type, r.stem, r.options && JSON.stringify(r.options), r.correct_answer,
          r.accepted_answers && JSON.stringify(r.accepted_answers), r.answer_kind, r.answer_hint, r.explanation, r.hint,
          r.option_feedback && JSON.stringify(r.option_feedback), r.wrong_answer_feedback && JSON.stringify(r.wrong_answer_feedback),
          r.figure && JSON.stringify(r.figure), r.stimulus, JSON.stringify(r.markscheme), r.marks, r.time_budget_seconds,
          r.difficulty, r.generator,
        ]
      )
      res.rowCount ? qIn++ : qDup++
    }
    x.status = 'published'
  }
  save()

  let lIn = 0
  let cIn = 0
  const lessonTier = ['languages', 'arts'].includes(state.group) ? TIERS.basic : TIERS.middle
  for (const [i, entry] of Object.entries(state.lessons || {})) {
    if (entry.status !== 'passed') continue
    const s = state.subtopics[i]
    const { outcomes, cards, overview, hook, screens, key_terms } = entry.lesson
    const body = { version: 3, hook, overview, screens, key_terms }
    const minutes = overview?.minutes
    for (const subject of s.courses) {
      await db.query(
        `insert into lessons (subject, topic, subtopic, body, outcomes, minutes, verified, generator)
         values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,true,$7)
         on conflict (subject, subtopic) do update set topic = excluded.topic, body = excluded.body, outcomes = excluded.outcomes,
           minutes = excluded.minutes, verified = true, generator = excluded.generator, updated_at = now()`,
        [subject, s.topic, s.subtopic, JSON.stringify(body), JSON.stringify(outcomes), minutes || 10, lessonTier.label]
      )
      lIn++
      const good = cards.filter((c, k) => !(entry.badCards || []).includes(k))
      for (const [k, c] of good.entries()) {
        const res = await db.query(
          `insert into flashcard_presets (curriculum, subject, topic, subtopic, front, back, position, verified, source, front_fingerprint)
           values ('IB',$1,$2,$3,$4,$5,$6,true,'ai-generated',$7)
           on conflict (subject, subtopic, front_fingerprint) where front_fingerprint is not null do nothing`,
          [subject, s.topic, s.subtopic, c.front.trim(), c.back.trim(), k, fingerprint(c.front)]
        )
        cIn += res.rowCount
      }
    }
    entry.status = 'published'
  }
  save()

  let retiredQ = 0
  let retiredC = 0
  if (arg('retire-old')) {
    const done = state.subtopics.filter((s, i) => state.questions.some((x) => x.sub === i && x.status === 'published'))
    for (const s of done) {
      const q = await db.query(
        `update questions set verified = false, retired_at = now()
         where subject = any($1) and subtopic = $2 and generator is null and retired_at is null`,
        [s.courses, s.subtopic]
      )
      retiredQ += q.rowCount
      const c = await db.query(
        `update flashcard_presets set verified = false where subject = any($1) and subtopic = $2 and created_at < $3 and verified`,
        [s.courses, s.subtopic, started]
      )
      retiredC += c.rowCount
    }
  }
  await db.end()
  log(`publish: ${qIn} question rows (${qDup} duplicates skipped), ${lIn} lessons, ${cIn} flashcards; retired ${retiredQ} old questions and ${retiredC} old flashcards`)
}

/* ---------------------------------------------------------------- report --- */

function report() {
  const qs = state.questions || []
  const by = (f) => qs.reduce((acc, x) => ((acc[f(x)] = (acc[f(x)] || 0) + 1), acc), {})
  const l = ledger()
  const lines = [
    `# ${COURSE}: content run`,
    '',
    `Subtopics: ${state.subtopics?.length}. Questions by status: ${JSON.stringify(by((x) => x.status))}`,
    `By tier: ${JSON.stringify(by((x) => `${x.tier}:${x.status}`))}`,
    `Lessons: ${JSON.stringify(Object.values(state.lessons || {}).reduce((a, e) => ((a[e.status] = (a[e.status] || 0) + 1), a), {}))}`,
    `Spend so far (all runs): Claude $${l.claude.toFixed(2)}, Gemini $${l.gemini.toFixed(2)}`,
    `This run, by purpose: ${Object.entries(state.spend || {}).map(([k, v]) => `${k} $${v.toFixed(3)}`).join(', ')}`,
    `Per written question: ${['basic', 'middle', 'hard'].map((t) => { const n = qs.filter((x) => x.tier === t).length; return `${t} ${n ? '$' + ((state.spend?.[`write-${t}`] || 0) / n).toFixed(4) : '-'}` }).join(', ')}`,
    '',
    '## Dropped questions and why',
    ...qs.filter((x) => x.status === 'failed').map((x) => `- [${x.tier}/${x.q?.heat}] ${state.subtopics[x.sub]?.subtopic ?? '?'}: ${x.ruling || (x.problems || []).join('; ') || x.audit?.problems}`),
    '',
    '## Audit findings',
    ...qs.filter((x) => x.audit && x.audit.verdict !== 'publish').map((x) => `- ${x.audit.verdict} [${x.tier}/${x.q.heat}] ${x.q.stem.slice(0, 90)}… — ${x.audit.problems}`),
    '',
    '## Lessons that failed',
    ...Object.entries(state.lessons || {}).filter(([, e]) => e.status === 'failed').map(([i, e]) => `- ${state.subtopics[i].subtopic}: ${e.problems.join('; ')}`),
  ]
  fs.writeFileSync(path.join(RUNS, `${slug}-report.md`), lines.join('\n'))
  log(`report: content-runs/${slug}-report.md`)
}

/* ------------------------------------------------------------------- run --- */

const STAGES = { plan, questions, repair, blind, rule, audit, lessons, publish }
try {
  if (STAGE === 'all') {
    // Planning again would renumber the slots under work already paid for.
    if (!state.subtopics) await plan()
    for (const name of ['questions', 'blind', 'rule', 'audit', 'lessons']) await STAGES[name]()
    log('\nEverything is checked and waiting. Review the report, then run --stage publish.')
  } else if (STAGE === 'report') {
    /* report only */
  } else {
    if (!STAGES[STAGE]) throw new Error(`No stage "${STAGE}".`)
    if (STAGE !== 'plan' && !state.subtopics) await plan()
    await STAGES[STAGE]()
  }
} catch (e) {
  if (e instanceof OverBudget) log(`\nStopped: ${e.message}`)
  else throw e
} finally {
  if (state.subtopics) report()
}
