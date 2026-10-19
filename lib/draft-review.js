/**
 * A marked draft: making the model's review safe to show, and finding the
 * passages it quotes in the student's text.
 *
 * Quotes are matched loosely (case, runs of whitespace and curly quotes are
 * ignored), the same way on the server, which drops any quote it cannot
 * find, and in the browser, which highlights the ones that are left.
 */

/** Text with whitespace collapsed and quotes straightened, and where each character came from. */
export function index(text) {
  let norm = ''
  const at = []
  for (let i = 0; i < text.length; i++) {
    let ch = text[i].toLowerCase()
    if (/\s/.test(ch)) {
      if (norm.endsWith(' ') || !norm) continue
      ch = ' '
    } else if (ch === '‘' || ch === '’') ch = "'"
    else if (ch === '“' || ch === '”') ch = '"'
    norm += ch
    at.push(i)
  }
  return { norm, at }
}

export const loose = (s) => index(s).norm.trim()

/** The draft cut into plain runs and highlighted runs, in order, never overlapping. */
export function segments(text, highlights) {
  const { norm, at } = index(text)
  const found = []
  highlights.forEach((h, n) => {
    const q = loose(h.quote)
    const pos = q ? norm.indexOf(q) : -1
    if (pos < 0) return
    found.push({ start: at[pos], end: at[pos + q.length - 1] + 1, n })
  })
  found.sort((a, b) => a.start - b.start)
  const out = []
  let cursor = 0
  for (const f of found) {
    if (f.start < cursor) continue
    if (f.start > cursor) out.push({ text: text.slice(cursor, f.start) })
    out.push({ text: text.slice(f.start, f.end), n: f.n })
    cursor = f.end
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) })
  return out
}


/**
 * The model's review, made safe to show: marks inside their range and
 * matching the real criteria where we know them, and only highlights whose
 * quote is really in the draft.
 */
export function cleanReview(json, text, rubric) {
  let r
  try {
    r = JSON.parse(json)
  } catch {
    return null
  }
  if (!r || !Array.isArray(r.criteria)) return null
  const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
  const known = rubric ? new Map(rubric.criteria.map((c) => [c.id, c])) : null
  const criteria = (known ? rubric.criteria : r.criteria.slice(0, 8)).map((c) => {
    const said = known ? r.criteria.find((x) => String(x.id).trim().toUpperCase() === c.id) || {} : c
    const max = known ? c.max : Math.max(1, Math.min(40, Math.round(Number(c.max) || 0)))
    return {
      id: str(c.id, 4),
      name: str(c.name, 80),
      max,
      score: Math.max(0, Math.min(max, Math.round(Number(said.score) || 0))),
      comment: str(said.comment, 600),
    }
  })
  const draft = loose(text)
  const ids = new Set(criteria.map((c) => c.id))
  const highlights = (Array.isArray(r.highlights) ? r.highlights : [])
    .map((h) => ({
      quote: str(h.quote, 400),
      criterion: ids.has(str(h.criterion, 4)) ? str(h.criterion, 4) : '',
      kind: ['strength', 'issue', 'question'].includes(h.kind) ? h.kind : 'issue',
      comment: str(h.comment, 500),
    }))
    .filter((h) => h.quote.length >= 8 && draft.includes(loose(h.quote)))
    .slice(0, 12)
  const list = (v, n) => (Array.isArray(v) ? v.map((x) => str(x, 400)).filter(Boolean).slice(0, n) : [])
  return {
    criteria,
    known: Boolean(rubric),
    scale: rubric?.scale || null,
    grade_estimate: str(r.grade_estimate, 4),
    grade_note: str(r.grade_note, 400),
    highlights,
    strengths: list(r.strengths, 4),
    questions: list(r.questions, 5),
    next_step: str(r.next_step, 400),
  }
}

