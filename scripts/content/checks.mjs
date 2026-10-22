/**
 * Checks that cost nothing, run on every question before any model sees it.
 *
 * Each one is a mistake a model has actually made here. The Gemini audit of
 * the test questions missed several of them (an accepted "60 kJ" for an
 * answer of 60 000 J, which would have marked a student's "60" right), so
 * they are code rather than a request to be careful.
 *
 * Every function returns a list of problems; an empty list passes.
 */

import { parseNumber } from '../../lib/grading.js'
import { figureIsUsable } from '../../lib/figures.js'

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9.\-]+/g, ' ').trim()

/** Significant figures a typed number was written to: "0.280" → 3, "8900" → 2, "8.9 × 10^3" → 2. */
function sigFigsOf(text) {
  const t = String(text).replace(/[\u2212]/g, '-').trim().replace(/^[+-]/, '')
  const sci = /^(\d+)(?:\.(\d+))?\s*[x×*]\s*10/i.exec(t)
  const digits = sci ? `${sci[1]}${sci[2] ? '.' + sci[2] : ''}` : (/^\d*(?:\.\d+)?/.exec(t)?.[0] || '')
  if (!digits) return 0
  if (digits.includes('.')) return digits.replace('.', '').replace(/^0+/, '').length || 1
  return digits.replace(/^0+/, '').replace(/0+$/, '').length || 1
}

/**
 * Is `variant` a correct rounding of the precise value? 0.3 and 0.28 of
 * 0.280 are; 12 of 11.49 is not, and neither is 8.9 written as "8.9 kN" for
 * 8 900 N, which reads as 8.9.
 */
export function roundsTo(precise, variant, variantText) {
  if (precise == null || variant == null) return false
  if (precise === 0 || variant === 0) return precise === variant
  // The writer may list both signs where the convention allows either (a PED
  // of -0.6 or 0.6); the size is what has to round.
  precise = Math.abs(precise)
  variant = Math.abs(variant)
  // The variant stands for every value that rounds to it: half a unit in its
  // last significant figure either way. 1.835 is inside "1.84"; 11.49 is not
  // inside "12".
  const sf = Math.max(1, sigFigsOf(variantText))
  const unit = Math.pow(10, Math.floor(Math.log10(Math.abs(variant))) - sf + 1)
  return Math.abs(precise - variant) <= (unit / 2) * (1 + 1e-9)
}

/**
 * Mend what can be mended without asking a model again, and say what was
 * changed. A bad accepted variant is dropped rather than failing the whole
 * question: the correct answer is still there, and rewriting a good question
 * over a stray "8.9 kN" costs money for nothing.
 */
export function repairQuestion(q) {
  const repairs = []
  if (q.type === 'short_answer') {
    const accepted = (q.accepted_answers || []).map((a) => String(a).trim()).filter(Boolean)
    if (q.answer_kind === 'numeric') {
      const parsed = accepted.map((a) => ({ a, n: parseNumber(a) })).filter((x) => x.n != null)
      // The most precise value is the answer; every other form must round to it.
      const best = parsed.sort((x, y) => sigFigsOf(y.a) - sigFigsOf(x.a))[0]
      if (best) {
        const keep = [best.a, ...accepted.filter((a) => a !== best.a && roundsTo(best.n, parseNumber(a), a))]
        const dropped = accepted.filter((a) => !keep.includes(a))
        if (dropped.length) repairs.push(`dropped accepted ${dropped.map((d) => `"${d}"`).join(', ')}`)
        q.accepted_answers = [...new Set(keep)]
      }
    } else {
      const keep = accepted.filter((a) => a.length <= 60 && !/[;]|not accepted/i.test(a))
      if (keep.length !== accepted.length) repairs.push('dropped notes from the accepted answers')
      q.accepted_answers = keep
    }
    const right = q.accepted_answers || []
    const wrong = (q.wrong_answers || []).filter((w) => {
      const n = parseNumber(w.answer)
      return q.answer_kind === 'numeric' ? !right.some((a) => roundsTo(parseNumber(right[0]), n, w.answer) || sameValue(n, parseNumber(a))) : !right.some((a) => norm(a) === norm(w.answer))
    })
    if (wrong.length !== (q.wrong_answers || []).length) repairs.push('dropped a "wrong" answer that is right')
    q.wrong_answers = wrong
  }
  if (q.type === 'mcq') {
    q.marks = 1
    const ms = q.markscheme
    if (ms?.points?.length > 1) {
      q.markscheme = { ...ms, points: [{ point: `${q.correct_answer?.toUpperCase()}. ${ms.points.map((p) => p.point).join('; ')}`, marks: 1 }] }
      repairs.push('folded a multi-point markscheme into the one mark')
    }
    for (const o of q.options || []) {
      if (o.id === q.correct_answer && String(o.why_wrong || '').trim()) {
        o.why_wrong = ''
        repairs.push('cleared feedback on the correct option')
      }
    }
  }
  return repairs
}

/** Two numbers that are the same answer written to different precision. */
export function sameValue(a, b) {
  if (a == null || b == null) return false
  if (a === b) return true
  const scale = Math.max(Math.abs(a), Math.abs(b))
  return scale > 0 && Math.abs(a - b) / scale <= 0.03
}

const MENTIONS_FIGURE = /\b(diagram|graph|table|figure|circuit|chart|shown|shows|below)\b/i

/** A figure written as JSON text: {figure} parsed, or {error}. */
export function readFigure(value) {
  if (value && typeof value === 'object') return { figure: value }
  const text = String(value ?? '').trim()
  if (!text || /^"?none"?$/i.test(text)) return { figure: { kind: 'none', alt: '' } }
  // Forgiving about the usual slips: a code fence around it, typographic
  // quotes, a trailing comma, words before or after the object.
  const attempts = [text]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    const body = text.slice(start, end + 1)
    attempts.push(body, body.replace(/[\u201c\u201d]/g, '"').replace(/,\s*([}\]])/g, '$1'))
  }
  for (const attempt of attempts) {
    try {
      const figure = JSON.parse(attempt)
      if (figure && typeof figure === 'object') return { figure }
    } catch {
      // try the next repair
    }
  }
  return { error: `figure is not valid JSON: ${text.slice(0, 80)}` }
}

export function checkFigure(raw, stem) {
  const problems = []
  const { figure, error } = readFigure(raw)
  if (error) return [error]
  const kind = figure?.kind || 'none'
  if (kind === 'none') return problems
  if (!MENTIONS_FIGURE.test(stem)) problems.push('has a figure the stem never refers to')
  if (!String(figure.alt || '').trim()) problems.push('figure has no alt text')

  if (kind === 'circuit') {
    const series = figure.series || []
    const branches = (figure.parallel || []).filter((b) => b?.length)
    if (!String(figure.source || '').trim()) problems.push('circuit has no supply')
    if (!series.length && branches.length < 2) problems.push('circuit has no components')
    if (branches.length === 1) problems.push('circuit has a single "parallel" branch')
    if (branches.length > 3) problems.push('circuit has more than 3 parallel branches')
  } else if (kind === 'forces') {
    const forces = figure.forces || []
    if (!forces.length) problems.push('forces diagram has no forces')
    if (forces.length > 6) problems.push('forces diagram has more than 6 forces')
    if (figure.surface === 'incline' && !(figure.angle_deg >= 10 && figure.angle_deg <= 60)) {
      problems.push('incline angle missing or outside 10-60°')
    }
    for (const f of forces) {
      if (!Number.isFinite(f.direction_deg)) problems.push(`force "${f.label}" has no direction`)
      if (!(f.size >= 0.3 && f.size <= 1)) problems.push(`force "${f.label}" size outside 0.3-1`)
    }
  } else if (!figureIsUsable(figure)) {
    problems.push(`${kind} figure has too little data to draw`)
  }
  return problems
}

export function checkQuestion(q, slot) {
  const problems = []
  const stem = String(q.stem || '')
  if (stem.trim().length < 15) problems.push('stem too short')
  if (slot && q.heat !== slot.heat) problems.push(`heat ${q.heat} but the slot asked for ${slot.heat}`)
  if (slot && q.type !== slot.type) problems.push(`type ${q.type} but the slot asked for ${slot.type}`)
  if (/\$\d[\d,.]*\$/.test(`${stem} ${q.explanation}`)) problems.push('currency amount inside maths dollars')
  if (!String(q.hint || '').trim()) problems.push('no hint')
  if (!String(q.explanation || '').trim()) problems.push('no explanation')

  const ms = q.markscheme
  const msMarks = (ms?.points || []).reduce((a, p) => a + (p.marks || 0), 0)
  if (!ms?.command_term || !ms.points?.length) problems.push('no markscheme')
  // More points than marks is how IB writes "any two of"; fewer is a gap.
  else if (msMarks < q.marks) problems.push(`markscheme gives ${msMarks} marks for a ${q.marks}-mark question`)

  if (q.type === 'mcq') {
    const ids = (q.options || []).map((o) => o.id)
    if (q.marks !== 1) problems.push(`multiple choice worth ${q.marks} marks (IB multiple choice is always 1)`)
    if (ids.length !== 4 || new Set(ids).size !== 4) problems.push('needs exactly 4 options a-d')
    if (!ids.includes(q.correct_answer)) problems.push('correct answer is not one of the options')
    const texts = (q.options || []).map((o) => norm(o.text))
    if (new Set(texts).size !== texts.length) problems.push('two options say the same thing')
    for (const o of q.options || []) {
      const right = o.id === q.correct_answer
      if (!right && !String(o.why_wrong || '').trim()) problems.push(`option ${o.id} has no feedback`)
      if (right && String(o.why_wrong || '').trim()) problems.push('the correct option carries wrong-answer feedback')
    }
    const answerText = (q.options || []).find((o) => o.id === q.correct_answer)?.text
    if (answerText && norm(answerText).length > 3 && norm(q.hint).includes(norm(answerText))) {
      problems.push('hint contains the answer')
    }
  } else {
    const accepted = (q.accepted_answers || []).filter((a) => String(a).trim())
    if (!accepted.length) problems.push('no accepted answer')
    if (q.marks < 1 || q.marks > 6) problems.push(`marks ${q.marks} out of range`)
    if (q.answer_kind === 'numeric') {
      const first = parseNumber(accepted[0])
      if (first == null) problems.push(`first accepted answer "${accepted[0]}" is not a number`)
      for (const a of accepted.slice(1)) {
        const n = parseNumber(a)
        if (n == null || !roundsTo(first, n, a)) problems.push(`accepted answer "${a}" is a different value from "${accepted[0]}"`)
      }
      if (first != null && Math.abs(first) >= 10 && new RegExp(`(^|[^\\d.])${String(accepted[0]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\d]|$)`).test(q.hint || '')) {
        problems.push('hint contains the answer')
      }
    }
    const wrong = q.wrong_answers || []
    if (wrong.length < 2) problems.push('fewer than 2 wrong typed answers with feedback')
    for (const w of wrong) {
      if (!String(w.feedback || '').trim()) problems.push(`wrong answer "${w.answer}" has no feedback`)
      const n = parseNumber(w.answer)
      const clash =
        q.answer_kind === 'numeric'
          ? n != null && sameValue(n, parseNumber(accepted[0]))
          : accepted.some((a) => norm(a) === norm(w.answer))
      if (clash) problems.push(`wrong answer "${w.answer}" is actually the right answer`)
    }
  }

  problems.push(...checkFigure(q.figure, stem))
  return problems
}

/** Mend a lesson check question the way a question is mended: bad answer variants go. */
export function repairCheck(c) {
  if (!c || c.type === 'mcq') return []
  const q = { type: 'short_answer', answer_kind: c.answer_kind, accepted_answers: c.accepted_answers, wrong_answers: [] }
  const repairs = repairQuestion(q)
  c.accepted_answers = q.accepted_answers
  return repairs
}

/** A lesson check question: the same rules, lighter. */
export function checkCheck(c, where) {
  const problems = []
  if (!String(c?.stem || '').trim()) return [`${where}: no question`]
  if (c.type === 'mcq') {
    const ids = (c.options || []).map((o) => o.id)
    if (ids.length !== 4 || new Set(ids).size !== 4) problems.push(`${where}: needs 4 options`)
    if (!ids.includes(c.correct_answer)) problems.push(`${where}: answer is not an option`)
  } else {
    const accepted = (c.accepted_answers || []).filter((a) => String(a).trim())
    if (!accepted.length) problems.push(`${where}: no accepted answer`)
    if (c.answer_kind === 'numeric') {
      const first = parseNumber(accepted[0])
      for (const a of accepted.slice(1)) if (!roundsTo(first, parseNumber(a), a)) problems.push(`${where}: accepted "${a}" differs`)
    }
  }
  if (!String(c.feedback_wrong || '').trim()) problems.push(`${where}: no feedback for a wrong answer`)
  return problems
}

export function checkLesson(l) {
  const problems = []
  const sections = l.sections || []
  if (sections.length < 3 || sections.length > 5) problems.push(`${sections.length} sections (3-5 wanted)`)
  // Pointing at something on the page, not talking about graphs in general:
  // "the table below", "the graph shows", "in the diagram".
  const REFERS = /\b(the|this) (table|graph|diagram|figure|circuit|chart) (below|above|opposite|shows|gives|here)\b|\bshown (below|above)\b|\b(in|from|using) the (table|graph|diagram|figure|chart)\b/i
  sections.forEach((s, i) => {
    if (String(s.body || '').split(/\s+/).length < 40) problems.push(`section ${i + 1} too short`)
    problems.push(...checkCheck(s.check, `section ${i + 1} check`))
    const { figure, error } = readFigure(s.figure)
    if (error) problems.push(`section ${i + 1}: ${error}`)
    else if (figure.kind !== 'none') {
      // A lesson's figure illustrates the section; it need not be named in the text.
      problems.push(...checkFigure(figure, 'the figure').map((p) => `section ${i + 1}: ${p}`))
    } else if (REFERS.test(`${s.body} ${s.check?.stem}`)) {
      problems.push(`section ${i + 1} refers to a table, graph or diagram that is not there`)
    }
  })
  const outcomes = l.outcomes || []
  if (outcomes.length < 3 || outcomes.length > 5) problems.push(`${outcomes.length} outcomes (3-5 wanted)`)
  outcomes.forEach((o, i) => {
    problems.push(...checkCheck(o.check, `outcome ${i + 1}`))
    if (REFERS.test(o.check?.stem || '')) problems.push(`outcome ${i + 1} check refers to a figure it does not have`)
  })
  if (!l.worked_example?.steps?.length) problems.push('no worked example')
  const cards = l.cards || []
  if (cards.length < 10) problems.push(`only ${cards.length} flashcards`)
  for (const c of cards) {
    if (!String(c.front).trim() || !String(c.back).trim()) problems.push('an empty flashcard')
    if (String(c.front).length > 300 || String(c.back).length > 1000) problems.push('a flashcard too long to store')
  }
  return problems
}

/* -------------------------------------------------------- lessons, v2 --- */

function parseJson(text) {
  if (text && typeof text === 'object') return { value: text }
  const t = String(text ?? '').trim()
  if (!t) return { value: {} }
  const attempts = [t]
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a !== -1 && b > a) attempts.push(t.slice(a, b + 1), t.slice(a, b + 1).replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'))
  for (const x of attempts) {
    try {
      return { value: JSON.parse(x) }
    } catch {
      // next
    }
  }
  return { error: 'not valid JSON' }
}

const nonEmpty = (s) => String(s ?? '').trim().length > 0

/** One interaction: does it have what the player needs, and is it self-consistent? */
export function checkInteraction(c, where) {
  const p = []
  if (!c || typeof c !== 'object') return [`${where}: no interaction`]
  if (!nonEmpty(c.wrong)) p.push(`${where}: no feedback for a wrong answer`)
  switch (c.kind) {
    case 'mcq': {
      const ids = (c.options || []).map((o) => o.id)
      if (ids.length < 3 || ids.length > 4 || new Set(ids).size !== ids.length) p.push(`${where}: multiple choice needs 3 or 4 distinct options`)
      if (!ids.includes(c.answer)) p.push(`${where}: the answer is not an option`)
      break
    }
    case 'truefalse':
      if (typeof c.answer !== 'boolean' || !nonEmpty(c.statement)) p.push(`${where}: true/false needs a statement and a true or false answer`)
      break
    case 'match': {
      const pairs = c.pairs || []
      if (pairs.length < 3 || pairs.length > 5) p.push(`${where}: match needs 3 to 5 pairs`)
      if (new Set(pairs.map((x) => norm(x.left))).size !== pairs.length || new Set(pairs.map((x) => norm(x.right))).size !== pairs.length) p.push(`${where}: match pairs repeat`)
      break
    }
    case 'order':
      if ((c.items || []).length < 3 || (c.items || []).length > 6) p.push(`${where}: order needs 3 to 6 items`)
      break
    case 'sort': {
      const groups = c.groups || []
      const items = groups.flatMap((g) => g.items || [])
      if (groups.length < 2 || groups.length > 3) p.push(`${where}: sort needs 2 or 3 groups`)
      if (items.length < 4 || items.length > 9) p.push(`${where}: sort needs 4 to 9 items`)
      if (new Set(items.map(norm)).size !== items.length) p.push(`${where}: an item is in two groups`)
      break
    }
    case 'gap': {
      const blanks = (String(c.text || '').match(/___/g) || []).length
      if (!blanks || blanks !== (c.answers || []).length) p.push(`${where}: gaps and answers do not line up`)
      for (const a of c.answers || []) if (!(c.bank || []).some((w) => norm(w) === norm(a))) p.push(`${where}: answer "${a}" is not in the word bank`)
      if ((c.bank || []).length <= (c.answers || []).length) p.push(`${where}: the word bank needs a distractor`)
      break
    }
    case 'numeric': {
      const first = parseNumber(c.answer ?? c.accepted?.[0])
      if (first == null) p.push(`${where}: numeric answer missing`)
      c.accepted = [String(c.answer), ...(c.accepted || [])].filter((a, i, all) => a && all.indexOf(a) === i && roundsTo(first, parseNumber(a), a))
      break
    }
    case 'short':
      if (!(c.accepted || []).some(nonEmpty)) p.push(`${where}: no accepted answer`)
      break
    default:
      p.push(`${where}: unknown interaction "${c.kind}"`)
  }
  return p
}

const POINTS_AT = /\b(the|this) (table|graph|diagram|figure|circuit|chart) (below|above|opposite|shows|gives|here)\b|\bshown (below|above)\b|\b(in|from|using) the (table|graph|diagram|figure|chart)\b/i

/**
 * Parse and check a v2 lesson. Returns {lesson, problems}: the lesson with
 * every frame's data and figure as objects, ready to store and to play.
 */
export function readLesson2(raw) {
  const problems = []
  const lesson = JSON.parse(JSON.stringify(raw || {}))
  const frames = lesson.frames || []
  if (frames.length < 12 || frames.length > 26) problems.push(`${frames.length} frames (14 to 22 wanted)`)
  frames.forEach((f, i) => {
    const where = `frame ${i + 1} (${f.type})`
    const d = parseJson(f.data)
    if (d.error) problems.push(`${where}: data ${d.error}`)
    f.data = d.value || {}
    const fig = readFigure(f.figure)
    if (fig.error) problems.push(`${where}: ${fig.error}`)
    f.figure = fig.figure || { kind: 'none', alt: '' }
    if (f.figure.kind !== 'none') problems.push(...checkFigure(f.figure, 'the figure').map((x) => `${where}: ${x}`))
    else if (POINTS_AT.test(`${f.text} ${JSON.stringify(f.data)}`)) problems.push(`${where}: refers to a table, graph or diagram it does not have`)
    if (String(f.text || '').split(/\s+/).length > 90) problems.push(`${where}: too much text for one screen`)
    const x = f.data
    if (f.type === 'check') problems.push(...checkInteraction(x, where))
    if (f.type === 'formula' && (!nonEmpty(x.expression) || !(x.symbols || []).length)) problems.push(`${where}: formula needs an expression and its symbols`)
    if (f.type === 'example' && !(x.steps || []).length) problems.push(`${where}: example needs steps`)
    if (f.type === 'mistake' && !(nonEmpty(x.wrong) && nonEmpty(x.right))) problems.push(`${where}: mistake needs wrong and right`)
    if (f.type === 'reveal' && !(x.items || []).length) problems.push(`${where}: reveal needs items`)
    if (f.type === 'cards' && ((x.cards || []).length < 2 || (x.cards || []).length > 6)) problems.push(`${where}: cards frame needs 2 to 6 cards`)
    if (f.type === 'diagram' && f.figure.kind === 'none') problems.push(`${where}: a diagram frame without a figure`)
  })
  const types = new Set(frames.map((f) => f.type))
  for (const t of ['analogy', 'key_point', 'example', 'mistake', 'cards']) if (!types.has(t)) problems.push(`no ${t} frame`)
  const kinds = new Set(frames.filter((f) => f.type === 'check').map((f) => f.data?.kind))
  if (kinds.size < 3) problems.push(`checks use ${kinds.size} kind(s); at least 3 wanted`)
  // Something to do at least every few screens.
  let gap = 0
  for (const f of frames) {
    // Tapping through a formula's symbols or a worked example step by step is doing something too.
    gap = ['check', 'reveal', 'cards', 'formula', 'example'].includes(f.type) ? 0 : gap + 1
    if (gap > 4) {
      problems.push('more than four screens in a row with nothing to do')
      break
    }
  }
  lesson.outcomes = (lesson.outcomes || []).map((o, i) => {
    const c = parseJson(o.check)
    if (c.error) problems.push(`outcome ${i + 1}: check ${c.error}`)
    const check = c.value || {}
    problems.push(...checkInteraction(check, `outcome ${i + 1}`))
    if (!['mcq', 'truefalse', 'numeric', 'short'].includes(check.kind)) problems.push(`outcome ${i + 1}: check must be mcq, truefalse, numeric or short`)
    if (POINTS_AT.test(JSON.stringify(check))) problems.push(`outcome ${i + 1}: refers to a figure it does not have`)
    return { statement: o.statement, check }
  })
  if (lesson.outcomes.length < 3 || lesson.outcomes.length > 5) problems.push(`${lesson.outcomes.length} outcomes (3 to 5 wanted)`)
  if ((lesson.cards || []).length < 8) problems.push(`only ${(lesson.cards || []).length} deck flashcards`)
  for (const c of lesson.cards || []) if (String(c.front).length > 300 || String(c.back).length > 1000) problems.push('a flashcard too long to store')
  return { lesson, problems }
}

/* -------------------------------------------------------- lessons, v3 --- */

const TEACHING = new Set(['explain', 'key_point', 'note', 'analogy', 'diagram', 'formula', 'example', 'mistake'])
const DOING = new Set(['check', 'reveal', 'cards'])

/**
 * Parse and check a v3 lesson: screens of blocks. Every block is checked as a
 * v2 frame is; on top, a screen must teach properly (a real explanation, not
 * a sentence) and the lesson must ask the student to do enough, in enough
 * different ways.
 */
export function readLesson3(raw) {
  const screens = (raw?.screens || []).map((s) => ({ title: s.title, blocks: s.blocks || [] }))
  // Reuse the frame checks by laying the blocks out as frames, then put them back.
  const flat = screens.flatMap((s) => s.blocks)
  const asV2 = readLesson2({ ...raw, frames: flat })
  const drop = /^\d+ frames|more than four screens|frame \d+ \(explain\): too much text/
  const problems = asV2.problems.filter((p) => !drop.test(p)).map((p) => p.replace(/^frame (\d+)/, (m, n) => `block ${n}`))
  let k = 0
  const parsed = screens.map((s) => ({ title: s.title, blocks: s.blocks.map(() => asV2.lesson.frames[k++]) }))

  if (parsed.length < 6 || parsed.length > 12) problems.push(`${parsed.length} screens (7 to 10 wanted)`)
  parsed.forEach((s, i) => {
    if (s.blocks.length < 1 || s.blocks.length > 5) problems.push(`screen ${i + 1} has ${s.blocks.length} blocks (2 to 4 wanted)`)
    const words = s.blocks.filter((b) => b.type === 'explain').reduce((a, b) => a + String(b.text || '').split(/\s+/).filter(Boolean).length, 0)
    const teaches = s.blocks.some((b) => TEACHING.has(b.type))
    if (teaches && words < 50 && !s.blocks.some((b) => ['example', 'diagram', 'formula'].includes(b.type))) problems.push(`screen ${i + 1} is thin: ${words} words of explanation`)
  })
  const checks = flat.filter((b) => b.type === 'check').length
  if (checks < 4) problems.push(`only ${checks} checks (5 to 8 wanted)`)
  const doing = parsed.filter((s) => s.blocks.some((b) => DOING.has(b.type))).length
  if (doing < Math.ceil(parsed.length * 0.6)) problems.push(`only ${doing} of ${parsed.length} screens ask the student to do something`)
  return { lesson: { ...asV2.lesson, frames: undefined, screens: parsed }, problems }
}
