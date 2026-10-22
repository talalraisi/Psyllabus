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
