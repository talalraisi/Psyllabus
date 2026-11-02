/**
 * The full assessment criteria, band descriptors and clarifications for
 * each piece Syllabi marks, cut out of the IB subject guides, into the
 * private marking_rubrics table (091-marking-rubrics.sql).
 *
 * The guide text is the IB's, so it never enters this repository: it is read
 * from the guides on this machine and written straight to the database,
 * where only the marking route can read it. This file holds only where each
 * section starts and ends.
 *
 *   node scripts/marking-rubrics.mjs            # show what would be cut
 *   node scripts/marking-rubrics.mjs --write    # store it
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'

loadEnv()
const GUIDES = process.env.IB_GUIDES_DIR || path.join(process.env.HOME, 'Desktop/IB Subject Guides')
const WRITE = process.argv.includes('--write')

// key: the id lib/criteria.js names. from/to: the first line of the section
// and the first line after it (a regex, and which occurrence counts).
const PIECES = [
  { key: 'science-ia:Biology', guide: 'Biology Guide', from: /^Internal assessment criteria—SL and HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'science-ia:Chemistry', guide: 'Chemistry Guide', from: /^Internal assessment criteria—SL and HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'science-ia:Physics', guide: 'Physics Guide', from: /^Internal assessment criteria—SL and HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'maths-ia:AA', guide: 'Mathematics Analysis and Approaches', from: /^Internal assessment criteria—SL and HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'maths-ia:AI', guide: 'Mathematics Applications and Interpretation', from: /^Internal assessment criteria—SL and HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'econ-ia', guide: 'Economics Guide', from: /^Internal assessment criteria—SL and HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'business-ia', guide: 'Business Management Guide', from: /^Internal assessment criteria$/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'geography-ia', guide: 'Geography Guide', from: /^Internal assessment criteria—SL\/HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'history-ia', guide: 'History Guide 2028', from: /^Internal assessment criteria—SL and HL/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'cs-ia', guide: 'Computer Science Guide 2027', from: /^Criterion A: Problem specification/, to: /^(Appendices|Glossary of command terms)/, back: 30 },
  { key: 'psychology-ia', guide: 'Psychology Guide 2027', from: /^Internal assessment criteria/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'langlit-p1-sl', guide: 'Language A - Language and Literature', from: /^External assessment criteria—SL/, to: /^Paper 2:? Comparative essay$/ },
  { key: 'langlit-p2', guide: 'Language A - Language and Literature', from: /^Paper 2:? Comparative essay$/, nth: 1, to: /^(Paper 1|Higher level essay|Individual oral|Paper 1 and paper 2)/ },
  { key: 'langlit-p1-hl', guide: 'Language A - Language and Literature', from: /^External assessment criteria—HL/, to: /^Paper 2:? Comparative essay$/ },
  { key: 'langlit-hl-essay', guide: 'Language A - Language and Literature', from: /^Higher level essay$/, nth: 1, to: /^Individual oral$/ },
  { key: 'langlit-io', guide: 'Language A - Language and Literature', from: /^Internal assessment criteria/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'lit-p1-sl', guide: 'Language A - Literature', from: /^External assessment criteria—SL/, to: /^Paper 2:? Comparative essay$/ },
  { key: 'lit-p2', guide: 'Language A - Literature', from: /^Paper 2:? Comparative essay$/, nth: 1, to: /^(Paper 1|Higher level essay|Individual oral|Paper 1 and paper 2)/ },
  { key: 'lit-p1-hl', guide: 'Language A - Literature', from: /^External assessment criteria—HL/, to: /^Paper 2:? Comparative essay$/ },
  { key: 'lit-hl-essay', guide: 'Language A - Literature', from: /^Higher level essay$/, nth: 1, to: /^Individual oral$/ },
  { key: 'lit-io', guide: 'Language A - Literature', from: /^Internal assessment criteria/, to: /^(Appendices|Glossary of command terms)/ },
  { key: 'ee', guide: 'Extended Essay Guide 2027', from: /^Assessment criteria$/, to: /^(Appendices|Glossary)/, nth: 1 },
  { key: 'tok-essay', guide: 'Theory Of Knowledge Guide', from: /^TOK essay assessment instrument/, to: /^(Appendices|Glossary|TOK exhibition)/ },
]

const RUNNING = /^\s*(\d+\s+)?[A-Z][\w ,&:—–-]*guide\s+\d*\s*$|^\s*\d+\s*$|^\s*(Internal|External) assessment\s*$/

function text(file) {
  return execFileSync('pdftotext', ['-layout', file, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString()
}

const files = fs.readdirSync(GUIDES).filter((f) => f.endsWith('.pdf'))
const out = []
for (const p of PIECES) {
  const file = files.find((f) => f.startsWith(p.guide))
  if (!file) {
    console.log(`${p.key}: no guide matching "${p.guide}"`)
    continue
  }
  const lines = text(path.join(GUIDES, file)).split('\n')
  const starts = lines.map((l, i) => (p.from.test(l.trim()) ? i : -1)).filter((i) => i >= 0)
  const start = starts[p.nth ?? 0]
  if (start == null) {
    console.log(`${p.key}: section not found in ${file}`)
    continue
  }
  const s = Math.max(0, start - (p.back || 0))
  let end = lines.findIndex((l, i) => i > start + 3 && p.to.test(l.trim()))
  if (end < 0 || end - s > 900) end = Math.min(lines.length, s + 600)
  const body = lines
    .slice(s, end)
    .filter((l) => !RUNNING.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  out.push({ key: p.key, source: file.replace(/\.pdf$/, ''), body })
  const ls = body.split('\n')
  console.log(`${p.key.padEnd(20)} ${String(ls.length).padStart(4)} lines ${String(body.length).padStart(6)} chars | ${ls[0].trim().slice(0, 60)} … ${ls.at(-1).trim().slice(0, 50)}`)
}

if (process.argv.includes('--criteria')) {
  for (const r of out) {
    const crit = r.body.split('\n').map((l) => l.trim()).filter((l) => /^Criterion [A-H]\b/.test(l) || /\b\d+ marks?\b/.test(l) && /^Criterion|^[A-H]\s/.test(l))
    console.log(`\n== ${r.key}\n` + [...new Set(crit)].slice(0, 14).join('\n'))
  }
}

if (WRITE) {
  const db = await connect({ quiet: true })
  for (const r of out) {
    await db.query(
      `insert into marking_rubrics (key, source, body, updated_at) values ($1, $2, $3, now())
       on conflict (key) do update set source = excluded.source, body = excluded.body, updated_at = now()`,
      [r.key, r.source, r.body]
    )
  }
  console.log(`stored ${out.length}`)
  await db.end()
}
