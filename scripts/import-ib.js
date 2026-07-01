#!/usr/bin/env node
/**
 * Import IB syllabus topics from CSV into Supabase.
 * Usage: node scripts/import-ib.js [--sql-only]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Or use --sql-only to print SQL for the Supabase SQL editor.
 */

const fs = require('fs')
const path = require('path')

const CSV_PATH =
  process.argv.find((a) => a.endsWith('.csv')) ||
  path.join(__dirname, '../data/PSyllabus - IB DP.csv')

const TARGET_SUBJECTS = [
  // Group 1 - Studies in Language and Literature
  'English A: Literature (SL/HL)',
  'English A: Language and Literature (SL/HL)',
  'Literature and Performance (SL only)',
  'Spanish A: Language and Literature (SL/HL)',
  'French A: Language and Literature (SL/HL)',
  'Arabic A: Language and Literature (SL/HL)',
  'Mandarin A: Language and Literature (SL/HL)',
  // Group 2 - Language Acquisition
  'Spanish B (SL/HL)',
  'Spanish ab initio (SL)',
  'French B (SL/HL)',
  'French ab initio (SL)',
  'Arabic B (SL/HL)',
  'Arabic ab initio (SL)',
  'English B (SL/HL)',
  'English ab initio (SL)',
  'Mandarin B (SL/HL)',
  'Mandarin ab initio (SL)',
  'Classical Languages: Latin (SL/HL)',
  'Classical Languages: Classical Greek (SL/HL)',
  // Group 3 - Individuals and Societies
  'Business Management (SL/HL)',
  'Digital Society (SL/HL)',
  'Economics (SL/HL)',
  'Geography (SL/HL)',
  'Global Politics (SL/HL)',
  'History (SL/HL)',
  'Philosophy (SL/HL)',
  'Psychology (SL/HL)',
  'Social and Cultural Anthropology (SL/HL)',
  'World Religions (SL only)',
  // Group 4 - Sciences
  'Biology (SL/HL)',
  'Chemistry (SL/HL)',
  'Physics (SL/HL)',
  'Computer Science (SL/HL)',
  'Environmental Systems and Societies (SL/HL)',
  'Sports, Exercise, and Health Science (SL/HL)',
  'Design Technology (SL/HL)',
  // Group 5 - Mathematics
  'Mathematics: Analysis and Approaches (SL/HL)',
  'Mathematics: Applications and Interpretation (SL/HL)',
  // Group 6 - The Arts
  'Dance (SL/HL)',
  'Film (SL/HL)',
  'Music (SL/HL)',
  'Theatre (SL/HL)',
  'Visual Arts (SL/HL)',
  // DP Core
  'Theory of Knowledge (TOK)',
  'Extended Essay (EE)',
  'Creativity, Activity, Service (CAS)',
]

const SQL_ONLY = process.argv.includes('--sql-only')

function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local')
  if (!fs.existsSync(envPath)) return {}
  const env = {}
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) env[m[1].trim()] = m[2].trim()
    })
  return env
}

function parseCSV(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function classifyTopic(cell) {
  const trimmed = cell.trim()
  if (!trimmed) return null
  if (/^Topic\s+\d+/i.test(trimmed)) return { type: 'topic', title: trimmed }
  if (/^subtopic\s/i.test(trimmed)) return { type: 'subtopic', title: trimmed }
  if (/^\d+\.\d+\s/.test(trimmed)) return { type: 'subtopic', title: trimmed }
  return null
}

function extractSubject(rows, colIndex) {
  const subjectName = rows[2][colIndex]?.trim()
  if (!subjectName) return null

  const items = []
  let currentTopic = null
  let topicOrder = 0
  let subtopicOrder = 0

  for (let r = 3; r < rows.length; r++) {
    const cell = rows[r][colIndex]?.trim()
    if (!cell) continue

    const parsed = classifyTopic(cell)
    if (!parsed) continue

    if (parsed.type === 'topic') {
      topicOrder++
      subtopicOrder = 0
      currentTopic = parsed.title
      items.push({
        type: 'topic',
        title: parsed.title,
        sort_order: topicOrder,
        parent_title: null,
      })
    } else if (parsed.type === 'subtopic' && currentTopic) {
      subtopicOrder++
      items.push({
        type: 'subtopic',
        title: parsed.title,
        sort_order: subtopicOrder,
        parent_title: currentTopic,
      })
    }
  }

  return { name: subjectName, items }
}

function escapeSql(str) {
  // Use dollar-quoted strings to handle special characters like colons
  return `$$${str}$$`
}

function generateSQL(subjects, syllabusYear) {
  const lines = ['BEGIN;', '']

  for (const subject of subjects) {
    const name = escapeSql(subject.name)
    lines.push(
      `INSERT INTO subjects (curriculum, name, syllabus_year) VALUES ('IB', ${name}, '${syllabusYear}') ON CONFLICT (curriculum, name, syllabus_year) DO UPDATE SET name = EXCLUDED.name;`
    )
    lines.push('')
    lines.push(
      `DELETE FROM topics WHERE subject_id = (SELECT id FROM subjects WHERE curriculum = 'IB' AND name = ${name} AND syllabus_year = '${syllabusYear}');`
    )
    lines.push('')

    for (const item of subject.items) {
      const title = escapeSql(item.title)
      if (item.type === 'topic') {
        lines.push(
          `INSERT INTO topics (subject_id, parent_id, title, topic_type, sort_order) SELECT s.id, NULL, ${title}, 'topic', ${item.sort_order} FROM subjects s WHERE s.curriculum = 'IB' AND s.name = ${name} AND s.syllabus_year = '${syllabusYear}';`
        )
      } else {
        const parent = escapeSql(item.parent_title)
        lines.push(
          `INSERT INTO topics (subject_id, parent_id, title, topic_type, sort_order) SELECT s.id, p.id, ${title}, 'subtopic', ${item.sort_order} FROM subjects s JOIN topics p ON p.subject_id = s.id AND p.title = ${parent} AND p.parent_id IS NULL WHERE s.curriculum = 'IB' AND s.name = ${name} AND s.syllabus_year = '${syllabusYear}';`
        )
      }
    }
    lines.push('')
  }

  lines.push('COMMIT;')
  return lines.join('\n')
}

async function importToSupabase(subjects, syllabusYear, env) {
  const { createClient } = await import('@supabase/supabase-js')
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase credentials in .env.local')
  }

  const supabase = createClient(url, key)

  for (const subject of subjects) {
    const { data: sub, error: subErr } = await supabase
      .from('subjects')
      .upsert(
        { curriculum: 'IB', name: subject.name, syllabus_year: syllabusYear },
        { onConflict: 'curriculum,name,syllabus_year' }
      )
      .select('id')
      .single()

    if (subErr) throw new Error(`Subject ${subject.name}: ${subErr.message}`)

    await supabase.from('topics').delete().eq('subject_id', sub.id)

    const topicIdByTitle = {}

    for (const item of subject.items) {
      if (item.type === 'topic') {
        const { data, error } = await supabase
          .from('topics')
          .insert({
            subject_id: sub.id,
            parent_id: null,
            title: item.title,
            topic_type: 'topic',
            sort_order: item.sort_order,
          })
          .select('id')
          .single()
        if (error) throw new Error(`Topic ${item.title}: ${error.message}`)
        topicIdByTitle[item.title] = data.id
      } else {
        const parentId = topicIdByTitle[item.parent_title]
        if (!parentId) continue
        const { error } = await supabase.from('topics').insert({
          subject_id: sub.id,
          parent_id: parentId,
          title: item.title,
          topic_type: 'subtopic',
          sort_order: item.sort_order,
        })
        if (error) throw new Error(`Subtopic ${item.title}: ${error.message}`)
      }
    }

    const topics = subject.items.filter((i) => i.type === 'topic').length
    const subtopics = subject.items.filter((i) => i.type === 'subtopic').length
    console.log(`✓ ${subject.name}: ${topics} topics, ${subtopics} subtopics`)
  }
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV not found:', CSV_PATH)
    process.exit(1)
  }

  const text = fs.readFileSync(CSV_PATH, 'utf8')
  const rows = parseCSV(text)
  const syllabusYear = (rows[0][0]?.match(/(\d{2}\/\d{2})/) || ['26/27'])[0]

  const headerRow = rows[2]
  const colByName = {}
  headerRow.forEach((cell, i) => {
    const name = cell?.trim()
    if (name && TARGET_SUBJECTS.includes(name)) colByName[name] = i
  })

  const subjects = TARGET_SUBJECTS.map((name) => {
    const col = colByName[name]
    if (col === undefined) {
      console.warn(`Column not found for: ${name}`)
      return null
    }
    return extractSubject(rows, col)
  }).filter(Boolean)

  if (SQL_ONLY) {
    console.log(generateSQL(subjects, syllabusYear))
    return
  }

  const env = loadEnv()
  const outPath = path.join(__dirname, 'generated-syllabus.sql')
  fs.writeFileSync(outPath, generateSQL(subjects, syllabusYear))
  console.log(`SQL written to ${outPath}`)

  if (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      await importToSupabase(subjects, syllabusYear, env)
      console.log('Import complete.')
    } catch (err) {
      console.error('Supabase import failed:', err.message)
      console.error('Run the generated SQL in Supabase SQL Editor instead.')
      process.exit(1)
    }
  }
}

main()
