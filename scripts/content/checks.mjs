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
  try {
    const figure = JSON.parse(text)
    return figure && typeof figure === 'object' ? { figure } : { error: 'figure is not a JSON object' }
  } catch {
    return { error: 'figure is not valid JSON' }
  }
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
  else if (msMarks !== q.marks) problems.push(`markscheme gives ${msMarks} marks for a ${q.marks}-mark question`)

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
        if (n == null || !sameValue(n, first)) problems.push(`accepted answer "${a}" is a different value from "${accepted[0]}"`)
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
      for (const a of accepted.slice(1)) if (!sameValue(parseNumber(a), first)) problems.push(`${where}: accepted "${a}" differs`)
    }
  }
  if (!String(c.feedback_wrong || '').trim()) problems.push(`${where}: no feedback for a wrong answer`)
  return problems
}

export function checkLesson(l) {
  const problems = []
  const sections = l.sections || []
  if (sections.length < 3 || sections.length > 5) problems.push(`${sections.length} sections (3-5 wanted)`)
  sections.forEach((s, i) => {
    if (String(s.body || '').split(/\s+/).length < 40) problems.push(`section ${i + 1} too short`)
    problems.push(...checkCheck(s.check, `section ${i + 1} check`))
    problems.push(...checkFigure(s.figure, `${s.heading} ${s.body}`).map((p) => `section ${i + 1}: ${p}`))
  })
  const outcomes = l.outcomes || []
  if (outcomes.length < 3 || outcomes.length > 5) problems.push(`${outcomes.length} outcomes (3-5 wanted)`)
  outcomes.forEach((o, i) => problems.push(...checkCheck(o.check, `outcome ${i + 1}`)))
  if (!l.worked_example?.steps?.length) problems.push('no worked example')
  const cards = l.cards || []
  if (cards.length < 10) problems.push(`only ${cards.length} flashcards`)
  for (const c of cards) {
    if (!String(c.front).trim() || !String(c.back).trim()) problems.push('an empty flashcard')
    if (String(c.front).length > 300 || String(c.back).length > 1000) problems.push('a flashcard too long to store')
  }
  return problems
}
