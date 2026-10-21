/**
 * Where study time went, for the analytics page.
 *
 * Time comes from two places that overlap on purpose: the session timer,
 * which runs while you study, and quizzes, which are often taken while it
 * runs. lib/study-time.js merges them to count each minute once for the
 * streak. This goes one step further and gives each minute to exactly one
 * subject, so the subjects add up to the total rather than past it:
 *
 *   a quiz says what it was about, so it wins over the timer it sat inside;
 *   a timer run that names a subject wins over one that does not;
 *   otherwise the minute is "Unassigned" (the timer, with no subject set).
 *
 * Minutes are split at the student's local midnight and counted by local
 * day, hour and weekday. Pure: tested by scripts/study-analytics-test.mjs.
 */

import { dayKey } from './study-time.js'

export const UNASSIGNED = 'Unassigned'

const RANK = { quiz: 2, timer: 1 }

/** Every quiz and timer run as a stretch of time with what it was about. */
export function intervalsFrom({ attempts = [], sessions = [] }) {
  const out = []
  for (const a of attempts) {
    if (!a?.completed_at || !(a.elapsed_seconds > 0)) continue
    const end = Date.parse(a.completed_at)
    if (!Number.isFinite(end)) continue
    out.push({ start: end - a.elapsed_seconds * 1000, end, subject: a.subject || null, subtopic: a.subtopic || null, kind: 'quiz' })
  }
  for (const s of sessions) {
    const start = Date.parse(s?.started_at)
    const end = Date.parse(s?.ended_at)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) out.push({ start, end, subject: s.subject || null, subtopic: s.subtopic || null, kind: 'timer' })
  }
  return out
}

const weight = (iv) => RANK[iv.kind] * 2 + (iv.subject ? 1 : 0)

/**
 * The timeline cut into pieces each owned by one interval, by the rules
 * above. A sweep over every start and end: O(n log n) and exact.
 */
export function attribute(intervals) {
  const points = [...new Set(intervals.flatMap((i) => [i.start, i.end]))].sort((a, b) => a - b)
  const byStart = [...intervals].sort((a, b) => a.start - b.start)
  const active = []
  const out = []
  let next = 0
  for (let p = 0; p < points.length - 1; p++) {
    const a = points[p]
    const b = points[p + 1]
    while (next < byStart.length && byStart[next].start <= a) active.push(byStart[next++])
    for (let i = active.length - 1; i >= 0; i--) if (active[i].end <= a) active.splice(i, 1)
    if (!active.length) continue
    let best = active[0]
    for (const iv of active) if (weight(iv) > weight(best) || (weight(iv) === weight(best) && iv.start > best.start)) best = iv
    const last = out[out.length - 1]
    if (last && last.end === a && last.src === best) last.end = b
    else out.push({ start: a, end: b, subject: best.subject, subtopic: best.subtopic, kind: best.kind, src: best })
  }
  return out.map(({ src, ...piece }) => piece)
}

/** Pieces cut at local midnight, so each belongs to one day. */
function byLocalDay(pieces) {
  const out = []
  for (const p of pieces) {
    let at = p.start
    while (at < p.end) {
      const d = new Date(at)
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
      const end = Math.min(p.end, midnight)
      out.push({ ...p, start: at, end })
      at = end
    }
  }
  return out
}

/** The ranges the page offers, and how each is bucketed. */
export const RANGES = [
  { key: '1w', label: '1W', days: 7, bucket: 'day' },
  { key: '1m', label: '1M', days: 30, bucket: 'day' },
  { key: '3m', label: '3M', days: 91, bucket: 'week' },
  { key: '6m', label: '6M', days: 182, bucket: 'week' },
  { key: '1y', label: '1Y', days: 365, bucket: 'month' },
]

const startOfDay = (t) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
const addDays = (t, n) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime()
}

/** The buckets for a range ending today: their start, end and label. */
export function bucketsFor(range, today) {
  const end = addDays(startOfDay(today), 1)
  const from = addDays(end, -range.days)
  const out = []
  if (range.bucket === 'day') {
    for (let t = from; t < end; t = addDays(t, 1)) out.push({ start: t, end: addDays(t, 1), label: new Date(t).toLocaleDateString(undefined, range.days <= 7 ? { weekday: 'short' } : { day: 'numeric' }) })
  } else if (range.bucket === 'week') {
    for (let t = from; t < end; t = addDays(t, 7)) out.push({ start: t, end: Math.min(end, addDays(t, 7)), label: new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) })
  } else {
    let d = new Date(from)
    d = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    while (d < end) {
      const n = new Date(d)
      const next = new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime()
      out.push({ start: Math.max(d, from), end: Math.min(next, end), label: n.toLocaleDateString(undefined, { month: 'short' }) })
      d = next
    }
  }
  return { from, end, buckets: out }
}

/**
 * Everything the page draws, for one range (and optionally one subject).
 * `attempts` and `sessions` are the raw rows; `now` is read once by the page.
 */
export function analyse({ attempts = [], sessions = [], range, subject = null, now }) {
  const { from, end, buckets } = bucketsFor(range, now)
  const prevFrom = from - (end - from)
  const all = byLocalDay(attribute(intervalsFrom({ attempts, sessions })))
  const keep = (p) => !subject || (p.subject || UNASSIGNED) === subject
  const pieces = all.filter((p) => p.end > from && p.start < end && keep(p))
  const prevMinutes = all.filter((p) => p.end > prevFrom && p.start < from && keep(p)).reduce((n, p) => n + (Math.min(p.end, from) - Math.max(p.start, prevFrom)) / 60000, 0)

  const bySubject = new Map()
  const bySubtopic = new Map()
  const perBucket = buckets.map(() => new Map())
  const days = new Map()
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  let total = 0

  for (const p of pieces) {
    const s = Math.max(p.start, from)
    const e = Math.min(p.end, end)
    const mins = (e - s) / 60000
    if (mins <= 0) continue
    const subj = p.subject || UNASSIGNED
    total += mins
    bySubject.set(subj, (bySubject.get(subj) || 0) + mins)
    if (p.subtopic) {
      const k = `${subj}|||${p.subtopic}`
      bySubtopic.set(k, (bySubtopic.get(k) || 0) + mins)
    }
    const b = buckets.findIndex((x) => s >= x.start && s < x.end)
    if (b >= 0) perBucket[b].set(subj, (perBucket[b].get(subj) || 0) + mins)
    const dk = dayKey(new Date(s))
    days.set(dk, (days.get(dk) || 0) + mins)
    // Hour by hour, for when in the week study happens.
    for (let t = s; t < e; ) {
      const d = new Date(t)
      const hourEnd = Math.min(e, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime())
      grid[d.getDay()][d.getHours()] += (hourEnd - t) / 60000
      t = hourEnd
    }
  }

  // Timer runs in range, for focus sessions.
  const runs = sessions
    .map((x) => ({ start: Date.parse(x.started_at), end: Date.parse(x.ended_at), subject: x.subject || UNASSIGNED, subtopic: x.subtopic }))
    .filter((x) => Number.isFinite(x.start) && x.end > x.start && x.start >= from && x.start < end && (!subject || x.subject === subject))
    .map((x) => ({ ...x, minutes: (x.end - x.start) / 60000 }))
  const lengths = [
    { label: 'Under 15 min', n: runs.filter((r) => r.minutes < 15).length },
    { label: '15 to 30', n: runs.filter((r) => r.minutes >= 15 && r.minutes < 30).length },
    { label: '30 to 60', n: runs.filter((r) => r.minutes >= 30 && r.minutes < 60).length },
    { label: 'Over an hour', n: runs.filter((r) => r.minutes >= 60).length },
  ]

  // Quizzes in range.
  const quizzes = attempts.filter((a) => {
    const t = Date.parse(a.completed_at)
    return Number.isFinite(t) && t >= from && t < end && (!subject || (a.subject || UNASSIGNED) === subject)
  })
  const answered = quizzes.reduce((n, a) => n + (a.total_questions || 0), 0)
  const right = quizzes.reduce((n, a) => n + (a.score || 0), 0)
  const accuracyByBucket = buckets.map((b) => {
    const qs = quizzes.filter((a) => {
      const t = Date.parse(a.completed_at)
      return t >= b.start && t < b.end
    })
    const q = qs.reduce((n, a) => n + (a.total_questions || 0), 0)
    return q ? qs.reduce((n, a) => n + (a.score || 0), 0) / q : null
  })
  const accuracyBySubject = new Map()
  for (const a of quizzes) {
    const s = a.subject || UNASSIGNED
    const cur = accuracyBySubject.get(s) || { right: 0, total: 0, quizzes: 0 }
    cur.right += a.score || 0
    cur.total += a.total_questions || 0
    cur.quizzes++
    accuracyBySubject.set(s, cur)
  }
  const quizzesBySubtopic = new Map()
  for (const a of quizzes) {
    if (!a.subtopic) continue
    const k = `${a.subject || UNASSIGNED}|||${a.subtopic}`
    const cur = quizzesBySubtopic.get(k) || { right: 0, total: 0, n: 0 }
    cur.right += a.score || 0
    cur.total += a.total_questions || 0
    cur.n++
    quizzesBySubtopic.set(k, cur)
  }
  const subtopicKeys = new Set([...bySubtopic.keys(), ...quizzesBySubtopic.keys()])

  const studiedDays = [...days.values()].filter((m) => m >= 1).length
  const rangeDays = Math.round((end - from) / 86400000)

  // The busiest hour band, said in words.
  let best = null
  for (let d = 0; d < 7; d++)
    for (let h = 0; h < 24; h++) {
      const v = grid[d][h] + (grid[d][h + 1] || 0)
      if (v > 0 && (!best || v > best.v)) best = { d, h, v }
    }

  return {
    from,
    end,
    buckets: buckets.map((b, i) => ({ ...b, bySubject: Object.fromEntries(perBucket[i]), total: [...perBucket[i].values()].reduce((n, v) => n + v, 0), accuracy: accuracyByBucket[i] })),
    total,
    previous: prevMinutes,
    change: prevMinutes > 0 ? (total - prevMinutes) / prevMinutes : null,
    perDay: total / rangeDays,
    studiedDays,
    rangeDays,
    subjects: [...bySubject.entries()].sort((a, b) => b[1] - a[1]).map(([name, minutes]) => ({ name, minutes, share: total ? minutes / total : 0 })),
    subtopics: [...subtopicKeys]
      .map((k) => {
        const [s, t] = k.split('|||')
        const q = quizzesBySubtopic.get(k)
        return { subject: s, subtopic: t, minutes: bySubtopic.get(k) || 0, quizzes: q?.n || 0, accuracy: q?.total ? q.right / q.total : null }
      })
      .sort((a, b) => b.minutes - a.minutes || b.quizzes - a.quizzes),
    days: Object.fromEntries(days),
    grid,
    bestTime: best,
    focus: {
      count: runs.length,
      average: runs.length ? runs.reduce((n, r) => n + r.minutes, 0) / runs.length : 0,
      longest: runs.reduce((m, r) => Math.max(m, r.minutes), 0),
      lengths,
      recent: [...runs].sort((a, b) => b.start - a.start).slice(0, 6),
    },
    quizzes: { count: quizzes.length, answered, accuracy: answered ? right / answered : null, bySubject: [...accuracyBySubject.entries()].map(([name, v]) => ({ name, ...v, accuracy: v.total ? v.right / v.total : null })).sort((a, b) => b.total - a.total) },
  }
}

/** "1h 25m", "40m", "0m". */
export function hm(minutes) {
  const m = Math.round(minutes)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}
