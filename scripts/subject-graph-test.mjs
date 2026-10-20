// Run with: node scripts/subject-graph-test.mjs
// Builds the map's tree from the real syllabus (read only) and checks it.
import assert from 'node:assert/strict'
import { loadEnv, connect } from './db.mjs'
import { buildGraph, pathTo, search, related, recommended, leavesOf, scoreOf, needsWork } from '../lib/subject-graph.js'
import { progressKey } from '../lib/progress.js'
import { radialLayout, NODE_W, NODE_H, HUB } from '../lib/map-layout.js'

let n = 0
const check = (label, fn) => { fn(); n++; console.log('  ok ', label) }

loadEnv()
const c = await connect({ quiet: true })
const { rows } = await c.query("select * from syllabus_content where subject = 'Economics HL' order by position")
const subjects = await c.query('select subject, count(*)::int as n from syllabus_content group by subject')
const all = await c.query('select * from syllabus_content')
await c.end()

const sub = rows[0]
const k = progressKey('Economics HL', rows[5].subtopic)
const k2 = progressKey('Economics HL', rows[9].subtopic)
const g = buildGraph({
  subject: 'Economics HL',
  rows,
  details: { [k]: { status: 'mastered', points: 12, updatedAt: '2026-10-01' }, [k2]: { status: 'in_progress', points: 3 } },
  effective: { [k]: 'mastered', [k2]: 'in_progress' },
  key: progressKey,
})

check('every syllabus row becomes exactly one subtopic', () => {
  assert.equal(leavesOf(g, 'root').length, new Set(rows.map((r) => `${r.topic}::${r.unit}::${r.subtopic}`)).size)
})
check('the overview is the topics, not hundreds of nodes', () => {
  const root = g.nodes.get('root')
  assert.ok(root.childIds.length >= 3 && root.childIds.length <= 12, `${root.childIds.length} topics`)
})
check('every node knows its parent and appears among its children', () => {
  for (const node of g.nodes.values()) if (node.parentId) assert.ok(g.nodes.get(node.parentId).childIds.includes(node.id))
})
check('untested has no score; tested is scored out of 100', () => {
  assert.equal(scoreOf('not_started', 0), null)
  assert.equal(scoreOf('mastered', 12), 100)
  assert.equal(scoreOf('in_progress', 3), 30)
})
check('branches summarise what is under them', () => {
  const root = g.nodes.get('root')
  assert.equal(root.tally.assessed, 2)
  assert.equal(root.tally.weak, 1)
  assert.equal(root.status, 'in_progress')
  assert.ok(needsWork(root))
})
check('a path runs from the subject down', () => {
  const leaf = leavesOf(g, 'root')[0]
  const p = pathTo(g, leaf.id)
  assert.equal(p[0].id, 'root')
  assert.equal(p.at(-1).id, leaf.id)
})
check('search finds elasticity', () => {
  const hits = search(g, 'elastic')
  assert.ok(hits.length > 0)
  assert.ok(hits.every((h) => /elastic/i.test(h.title)))
})
check('related subtopics share a term and sit in another unit', () => {
  const pedNode = search(g, 'price elasticity of demand')[0]
  const rel = related(g, pedNode.id)
  assert.ok(rel.length > 0)
  for (const r of rel) assert.notEqual(r.node.parentId, pedNode.parentId)
})
check('recommended puts the weak one first', () => {
  assert.equal(recommended(g)[0].status, 'in_progress')
})
check('every subject in the database builds without error', () => {
  let built = 0
  for (const { subject } of subjects.rows) {
    const gg = buildGraph({ subject, rows: all.rows.filter((r) => r.subject === subject), key: progressKey })
    assert.ok(gg.nodes.get('root').childIds.length > 0, subject)
    built++
  }
  console.log(`       (${built} subjects)`)
})
check('no two cards touch on any level of any subject', () => {
  let levels = 0
  for (const { subject } of subjects.rows) {
    const gg = buildGraph({ subject, rows: all.rows.filter((r) => r.subject === subject), key: progressKey })
    for (const node of gg.nodes.values()) {
      if (!node.childIds.length) continue
      levels++
      const L = radialLayout(gg, node.id).nodes.filter((p) => p.role === 'child')
      for (const p of L) assert.ok(Math.abs(p.x) >= (HUB + NODE_W) / 2 || Math.abs(p.y) >= (HUB + NODE_H) / 2, `${subject} › ${node.title}: on the hub`)
      for (let i = 0; i < L.length; i++)
        for (let j = i + 1; j < L.length; j++)
          assert.ok(Math.abs(L[i].x - L[j].x) >= NODE_W || Math.abs(L[i].y - L[j].y) >= NODE_H, `${subject} › ${node.title}`)
    }
  }
  console.log(`       (${levels} levels)`)
})
console.log(`\n${n} checks passed`)
