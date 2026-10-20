/**
 * A subject as a tree, for the subject map.
 *
 *   subject → topic → unit → subtopic
 *
 * Built from the real syllabus rows and the student's own progress, never
 * from invented results: a subtopic nobody has been tested on is "Untested",
 * not a failure, and has no score. Everything the map shows (the canvas, the
 * outline, breadcrumbs, search, the inspector, weak-area filtering) reads this
 * one structure, so they cannot disagree.
 *
 * Units are skipped where a topic has none of its own (or only one, named the
 * same as the topic), so no level is ever a single node standing in for its
 * parent.
 *
 * Pure: no React, no database. Tested by scripts/subject-graph-test.mjs.
 */

import { displaySubtopic, STATUS_LABELS, MASTERY_TARGET } from './progress.js'

/** Statuses that say "come back to this". */
export const NEEDS_WORK = new Set(['in_progress', 'decaying'])
const ASSESSED = (s) => s && s !== 'not_started'

/** Order to revise in: what is slipping, then what is weak, then the new. */
const URGENCY = { decaying: 0, in_progress: 1, not_started: 2, confident: 3, proficient: 4, mastered: 5 }

/** 0-100 from mastery points, only once there is evidence. */
export function scoreOf(status, points) {
  if (!ASSESSED(status)) return null
  return Math.max(0, Math.min(100, Math.round((Number(points) / MASTERY_TARGET) * 100)))
}

export const statusLabel = (s) => STATUS_LABELS[s] || 'Untested'

/** "1.1 What is economics?" from code and name, without repeating the code. */
const titled = (code, name) => (code && !String(name).startsWith(code) ? `${code} ${name}` : name)

/**
 * rows: syllabus rows for one subject ({ topic, unit, code, subtopic, position }).
 * details: progressKey → { status, points, updatedAt } (lib/decay.js).
 * effective: progressKey → status with fading applied.
 * key: (subject, subtopic) → progressKey.
 */
export function buildGraph({ subject, rows = [], details = {}, effective = {}, key }) {
  const nodes = new Map()
  const root = { id: 'root', kind: 'subject', title: subject, parentId: null, childIds: [], depth: 0 }
  nodes.set(root.id, root)

  const sorted = [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  // Which topics have units worth a level of their own.
  const unitsOf = new Map()
  for (const r of sorted) {
    if (!unitsOf.has(r.topic)) unitsOf.set(r.topic, new Set())
    if (r.unit) unitsOf.get(r.topic).add(r.unit)
  }
  const hasUnits = (topic) => {
    const u = unitsOf.get(topic)
    return u && (u.size > 1 || (u.size === 1 && ![...u][0].includes(topic) && !topic.includes([...u][0])))
  }

  const add = (node) => {
    nodes.set(node.id, node)
    nodes.get(node.parentId).childIds.push(node.id)
    return node
  }

  let order = 0
  for (const r of sorted) {
    const tId = `t:${r.topic}`
    if (!nodes.has(tId)) add({ id: tId, kind: 'topic', title: r.topic, parentId: 'root', childIds: [], depth: 1 })
    let parentId = tId
    if (hasUnits(r.topic) && r.unit) {
      const uId = `u:${r.topic}::${r.unit}`
      if (!nodes.has(uId)) add({ id: uId, kind: 'unit', title: titled(r.code, r.unit), code: r.code || null, parentId: tId, childIds: [], depth: 2 })
      parentId = uId
    }
    const id = `s:${r.topic}::${r.unit || ''}::${r.subtopic}`
    if (nodes.has(id)) continue
    const k = key(subject, r.subtopic)
    const detail = details[k] || {}
    const status = effective[k] || 'not_started'
    add({
      id,
      kind: 'subtopic',
      title: displaySubtopic(r.subtopic),
      row: r,
      parentId,
      childIds: [],
      depth: nodes.get(parentId).depth + 1,
      order: order++,
      status,
      score: scoreOf(status, detail.points),
      points: Number(detail.points) || 0,
      studiedAt: detail.updatedAt || null,
      hl: Boolean(r.hl_only || r.hl_extension),
    })
  }

  // Branch summaries, bottom up.
  const sum = (id) => {
    const n = nodes.get(id)
    if (n.kind === 'subtopic') {
      n.tally = { total: 1, assessed: ASSESSED(n.status) ? 1 : 0, proved: ['mastered', 'proficient'].includes(n.status) ? 1 : 0, weak: n.status === 'in_progress' ? 1 : 0, fading: n.status === 'decaying' ? 1 : 0 }
      return n.tally
    }
    const t = { total: 0, assessed: 0, proved: 0, weak: 0, fading: 0 }
    let scoreSum = 0
    let scored = 0
    for (const c of n.childIds) {
      const ct = sum(c)
      for (const k2 of Object.keys(t)) t[k2] += ct[k2]
      const child = nodes.get(c)
      if (child.score != null) {
        scoreSum += child.score * (child.tally?.assessed || 1)
        scored += child.tally?.assessed || 1
      }
    }
    n.tally = t
    // A branch's score is the average over what has been tested in it, and
    // only exists once something has.
    n.score = scored ? Math.round(scoreSum / scored) : null
    n.status = branchStatus(t)
    return t
  }
  sum('root')

  return { subject, nodes, rootId: 'root' }
}

/**
 * One word for a branch, from what is inside it, in proportion: one fading
 * subtopic in forty does not make a whole topic "Fading". A third or more of
 * what has been tested being weak or fading does. The Weak areas filter
 * still finds a branch with any weak or fading subtopic in it (needsWork).
 */
function branchStatus(t) {
  if (!t.assessed) return 'not_started'
  if ((t.weak + t.fading) / t.assessed >= 1 / 3) return t.fading > t.weak ? 'decaying' : 'in_progress'
  const proved = t.proved / t.total
  if (proved >= 0.9) return 'mastered'
  if (proved >= 0.5) return 'proficient'
  return 'confident'
}

/** The chain from the root down to id, inclusive. */
export function pathTo(graph, id) {
  const out = []
  let n = graph.nodes.get(id)
  while (n) {
    out.unshift(n)
    n = n.parentId ? graph.nodes.get(n.parentId) : null
  }
  return out
}

/** Does a branch hold anything that needs work? */
export const needsWork = (n) => Boolean(n && (n.kind === 'subtopic' ? NEEDS_WORK.has(n.status) : n.tally.weak + n.tally.fading > 0))

/** Every subtopic under a node, in syllabus order. */
export function leavesOf(graph, id) {
  const out = []
  const walk = (nid) => {
    const n = graph.nodes.get(nid)
    if (n.kind === 'subtopic') out.push(n)
    else n.childIds.forEach(walk)
  }
  walk(id)
  return out.sort((a, b) => a.order - b.order)
}

/** What to study next in this subject (or under one branch of it). */
export function recommended(graph, id = graph.rootId, limit = 5) {
  return leavesOf(graph, id)
    .filter((n) => n.status !== 'mastered')
    .sort((a, b) => URGENCY[a.status] - URGENCY[b.status] || a.order - b.order)
    .slice(0, limit)
}

/* ---------- Search ---------- */

const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

/** Titles that match every word typed, best matches first. */
export function search(graph, query, limit = 20) {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const out = []
  for (const n of graph.nodes.values()) {
    if (n.kind === 'subject') continue
    const hay = norm(`${n.title} ${n.code || ''}`)
    if (!words.every((w) => hay.includes(w))) continue
    const starts = hay.startsWith(words[0]) ? 0 : 1
    out.push({ node: n, rank: starts * 10 + n.depth })
  }
  return out.sort((a, b) => a.rank - b.rank || a.node.title.length - b.node.title.length).slice(0, limit).map((r) => r.node)
}

/* ---------- Connections ---------- */

const STOP = new Set(
  'about after against among analysis and applications approach between both case cases change changes concept concepts different during effect effects factors from including into introduction issues level levels market models nature other over role structure such their theory through types under using with within'.split(' ')
)

/** The words in a title worth matching on: long enough, and not filler. */
function terms(title) {
  return new Set(
    norm(title)
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length >= 5 && !STOP.has(w))
      .map((w) => w.replace(/(ies)$/, 'y').replace(/(s)$/, ''))
  )
}

/**
 * Subtopics elsewhere in the subject that share a key term with this one:
 * "Price elasticity of demand" and "Elasticity and tax incidence". Said as
 * exactly that in the interface, a shared term, because the syllabus does not
 * record prerequisites and this does not pretend to know them.
 */
export function related(graph, id, limit = 6) {
  const me = graph.nodes.get(id)
  if (!me || me.kind !== 'subtopic') return []
  const mine = terms(me.title)
  if (!mine.size) return []
  const out = []
  for (const n of graph.nodes.values()) {
    if (n.kind !== 'subtopic' || n.id === id || n.parentId === me.parentId) continue
    const shared = [...terms(n.title)].filter((w) => mine.has(w))
    if (shared.length) out.push({ node: n, shared })
  }
  return out.sort((a, b) => b.shared.length - a.shared.length || a.node.order - b.node.order).slice(0, limit)
}

/** The subtopics just before and after this one in the syllabus order. */
export function neighbours(graph, id) {
  const me = graph.nodes.get(id)
  if (!me || me.kind !== 'subtopic') return { before: null, after: null }
  const all = leavesOf(graph, graph.rootId)
  const i = all.findIndex((n) => n.id === id)
  return { before: all[i - 1] || null, after: all[i + 1] || null }
}
