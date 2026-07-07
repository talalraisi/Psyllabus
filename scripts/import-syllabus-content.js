#!/usr/bin/env node
/**
 * Import IB syllabus into syllabus_content table (onboarding subject names).
 * Usage: node scripts/import-syllabus-content.js [--sql-only]
 */

const fs = require('fs')
const path = require('path')

const CSV_PATH =
  process.argv.find((a) => a.endsWith('.csv')) ||
  path.join(__dirname, '../data/PSyllabus - IB DP.csv')

const SQL_ONLY = process.argv.includes('--sql-only')

const SUBJECT_MAP = {
  'English A: Literature HL': 'English A: Literature (SL/HL)',
  'English A: Literature SL': 'English A: Literature (SL/HL)',
  'English A: Language & Literature HL': 'English A: Language and Literature (SL/HL)',
  'English A: Language & Literature SL': 'English A: Language and Literature (SL/HL)',
  'Literature and Performance SL': 'Literature and Performance (SL only)',
  'Spanish A: Language & Literature HL': 'Spanish A: Language and Literature (SL/HL)',
  'Spanish A: Language & Literature SL': 'Spanish A: Language and Literature (SL/HL)',
  'French A: Language & Literature HL': 'French A: Language and Literature (SL/HL)',
  'French A: Language & Literature SL': 'French A: Language and Literature (SL/HL)',
  'Arabic A: Language & Literature HL': 'Arabic A: Language and Literature (SL/HL)',
  'Arabic A: Language & Literature SL': 'Arabic A: Language and Literature (SL/HL)',
  'Arabic A: Literature HL': 'Arabic A: Language and Literature (SL/HL)',
  'Arabic A: Literature SL': 'Arabic A: Language and Literature (SL/HL)',
  'French A: Literature HL': 'French A: Language and Literature (SL/HL)',
  'French A: Literature SL': 'French A: Language and Literature (SL/HL)',
  'Spanish A: Literature HL': 'Spanish A: Language and Literature (SL/HL)',
  'Spanish A: Literature SL': 'Spanish A: Language and Literature (SL/HL)',
  'Mandarin A: Language & Literature HL': 'Mandarin A: Language and Literature (SL/HL)',
  'Mandarin A: Language & Literature SL': 'Mandarin A: Language and Literature (SL/HL)',
  'Spanish B HL': 'Spanish B (SL/HL)',
  'Spanish B SL': 'Spanish B (SL/HL)',
  'Spanish ab initio SL': 'Spanish ab initio (SL)',
  'French B HL': 'French B (SL/HL)',
  'French B SL': 'French B (SL/HL)',
  'French ab initio SL': 'French ab initio (SL)',
  'Arabic B HL': 'Arabic B (SL/HL)',
  'Arabic B SL': 'Arabic B (SL/HL)',
  'Arabic ab initio SL': 'Arabic ab initio (SL)',
  'English B HL': 'English B (SL/HL)',
  'English B SL': 'English B (SL/HL)',
  'English ab initio SL': 'English ab initio (SL)',
  'Mandarin B HL': 'Mandarin B (SL/HL)',
  'Mandarin B SL': 'Mandarin B (SL/HL)',
  'Mandarin ab initio SL': 'Mandarin ab initio (SL)',
  'Classical Languages: Latin HL': 'Classical Languages: Latin (SL/HL)',
  'Classical Languages: Latin SL': 'Classical Languages: Latin (SL/HL)',
  'Classical Languages: Classical Greek HL': 'Classical Languages: Classical Greek (SL/HL)',
  'Classical Languages: Classical Greek SL': 'Classical Languages: Classical Greek (SL/HL)',
  'Business Management HL': 'Business Management (SL/HL)',
  'Business Management SL': 'Business Management (SL/HL)',
  'Digital Society HL': 'Digital Society (SL/HL)',
  'Digital Society SL': 'Digital Society (SL/HL)',
  'Economics HL': 'Economics (SL/HL)',
  'Economics SL': 'Economics (SL/HL)',
  'Geography HL': 'Geography (SL/HL)',
  'Geography SL': 'Geography (SL/HL)',
  'Global Politics HL': 'Global Politics (SL/HL)',
  'Global Politics SL': 'Global Politics (SL/HL)',
  'History HL': 'History (SL/HL)',
  'History SL': 'History (SL/HL)',
  'Philosophy HL': 'Philosophy (SL/HL)',
  'Philosophy SL': 'Philosophy (SL/HL)',
  'Psychology HL': 'Psychology (SL/HL)',
  'Psychology SL': 'Psychology (SL/HL)',
  'Social and Cultural Anthropology HL': 'Social and Cultural Anthropology (SL/HL)',
  'Social and Cultural Anthropology SL': 'Social and Cultural Anthropology (SL/HL)',
  'World Religions SL': 'World Religions (SL only)',
  'Biology HL': 'Biology (SL/HL)',
  'Biology SL': 'Biology (SL/HL)',
  'Chemistry HL': 'Chemistry (SL/HL)',
  'Chemistry SL': 'Chemistry (SL/HL)',
  'Physics HL': 'Physics (SL/HL)',
  'Physics SL': 'Physics (SL/HL)',
  'Computer Science HL': 'Computer Science (SL/HL)',
  'Computer Science SL': 'Computer Science (SL/HL)',
  'Environmental Systems and Societies HL': 'Environmental Systems and Societies (SL/HL)',
  'Environmental Systems and Societies SL': 'Environmental Systems and Societies (SL/HL)',
  'Environmental Systems & Societies SL': 'Environmental Systems and Societies (SL/HL)',
  'Sports, Exercise, and Health Science HL': 'Sports, Exercise, and Health Science (SL/HL)',
  'Sports, Exercise, and Health Science SL': 'Sports, Exercise, and Health Science (SL/HL)',
  'Sports Exercise & Health Science HL': 'Sports, Exercise, and Health Science (SL/HL)',
  'Sports Exercise & Health Science SL': 'Sports, Exercise, and Health Science (SL/HL)',
  'Design Technology HL': 'Design Technology (SL/HL)',
  'Design Technology SL': 'Design Technology (SL/HL)',
  'Math Analysis & Approaches HL': 'Mathematics: Analysis and Approaches (SL/HL)',
  'Math Analysis & Approaches SL': 'Mathematics: Analysis and Approaches (SL/HL)',
  'Math Applications & Interpretation HL': 'Mathematics: Applications and Interpretation (SL/HL)',
  'Math Applications & Interpretation SL': 'Mathematics: Applications and Interpretation (SL/HL)',
  'Dance HL': 'Dance (SL/HL)',
  'Dance SL': 'Dance (SL/HL)',
  'Film HL': 'Film (SL/HL)',
  'Film SL': 'Film (SL/HL)',
  'Music HL': 'Music (SL/HL)',
  'Music SL': 'Music (SL/HL)',
  'Theatre HL': 'Theatre (SL/HL)',
  'Theatre SL': 'Theatre (SL/HL)',
  'Visual Arts HL': 'Visual Arts (SL/HL)',
  'Visual Arts SL': 'Visual Arts (SL/HL)',
  'Theory of Knowledge (TOK)': 'Theory of Knowledge (TOK)',
  'Extended Essay (EE)': 'Extended Essay (EE)',
  'Creativity, Activity, Service (CAS)': 'Creativity, Activity, Service (CAS)',
}

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

function cleanTopic(title) {
  return title
    .replace(/^Topic\s+/i, 'Topic ')
    .replace(/\s*\(HL only\)\s*$/i, '')
    .trim()
}

function cleanSubtopic(title) {
  return title
    .replace(/^subtopic\s+\d+\.\d+\s*[-–—]\s*/i, '')
    .replace(/^\d+\.\d+\s+/, '')
    .trim()
}

function isHlOnly(title) {
  return /\(HL only\)/i.test(title) || /\(HL only\)/i.test(title) || /HL only\)/i.test(title)
}

function isHlSubject(onboardingName) {
  return onboardingName.endsWith(' HL') || onboardingName.includes('(HL')
}

function classifyTopic(cell) {
  const trimmed = cell.trim()
  if (!trimmed) return null
  if (/^Topic\s+\d+/i.test(trimmed)) return { type: 'topic', title: cleanTopic(trimmed) }
  if (/^subtopic\s/i.test(trimmed)) return { type: 'subtopic', title: trimmed }
  if (/^\d+\.\d+\s/.test(trimmed)) return { type: 'subtopic', title: trimmed }
  return null
}

function extractSubject(rows, colIndex) {
  const items = []
  let currentTopic = null

  for (let r = 3; r < rows.length; r++) {
    const cell = rows[r][colIndex]?.trim()
    if (!cell) continue

    const parsed = classifyTopic(cell)
    if (!parsed) continue

    if (parsed.type === 'topic') {
      currentTopic = parsed.title
    } else if (parsed.type === 'subtopic' && currentTopic) {
      const rawTitle = parsed.title
      items.push({
        topic: currentTopic,
        subtopic: cleanSubtopic(rawTitle),
        hl_only: isHlOnly(rawTitle) || isHlOnly(currentTopic),
      })
    }
  }

  return items
}

function escapeSql(str) {
  return `$$${str}$$`
}

function buildRowsForOnboarding(onboardingName, dbName, csvItems) {
  const isHl = isHlSubject(onboardingName)
  return csvItems
    .filter((item) => isHl || !item.hl_only)
    .map((item) => ({
      curriculum: 'IB',
      subject: onboardingName,
      topic: item.topic,
      subtopic: item.subtopic,
      hl_only: item.hl_only,
    }))
}

function generateSQL(allRows) {
  const lines = ['BEGIN;', '']
  lines.push(`DELETE FROM syllabus_content WHERE curriculum = 'IB';`)
  lines.push('')

  for (const row of allRows) {
    lines.push(
      `INSERT INTO syllabus_content (curriculum, subject, topic, subtopic, hl_only) VALUES ('IB', ${escapeSql(row.subject)}, ${escapeSql(row.topic)}, ${escapeSql(row.subtopic)}, ${row.hl_only});`
    )
  }

  lines.push('')
  lines.push('COMMIT;')
  return lines.join('\n')
}

async function importToSupabase(allRows, env) {
  const { createClient } = await import('@supabase/supabase-js')
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase credentials in .env.local')
  }

  const supabase = createClient(url, key)

  await supabase.from('syllabus_content').delete().eq('curriculum', 'IB')

  const BATCH = 500
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH)
    const { error } = await supabase.from('syllabus_content').insert(batch)
    if (error) throw new Error(`Insert batch ${i}: ${error.message}`)
  }

  const bySubject = {}
  for (const row of allRows) {
    bySubject[row.subject] = (bySubject[row.subject] || 0) + 1
  }
  for (const [name, count] of Object.entries(bySubject).sort()) {
    console.log(`✓ ${name}: ${count} subtopics`)
  }
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV not found:', CSV_PATH)
    process.exit(1)
  }

  const text = fs.readFileSync(CSV_PATH, 'utf8')
  const rows = parseCSV(text)
  const headerRow = rows[2]

  const colByDbName = {}
  headerRow.forEach((cell, i) => {
    const name = cell?.trim()
    if (name) colByDbName[name] = i
  })

  const cacheByDbName = {}
  const allRows = []

  for (const [onboardingName, dbName] of Object.entries(SUBJECT_MAP)) {
    const col = colByDbName[dbName]
    if (col === undefined) {
      console.warn(`Column not found for: ${dbName} (${onboardingName})`)
      continue
    }

    if (!cacheByDbName[dbName]) {
      cacheByDbName[dbName] = extractSubject(rows, col)
    }

    const subjectRows = buildRowsForOnboarding(onboardingName, dbName, cacheByDbName[dbName])
    allRows.push(...subjectRows)
  }

  console.log(`Total rows: ${allRows.length} across ${Object.keys(SUBJECT_MAP).length} onboarding subjects`)

  if (SQL_ONLY) {
    console.log(generateSQL(allRows))
    return
  }

  const outPath = path.join(__dirname, 'seed-syllabus-content.sql')
  fs.writeFileSync(outPath, generateSQL(allRows))
  console.log(`SQL written to ${outPath}`)

  const env = loadEnv()
  if (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      await importToSupabase(allRows, env)
      console.log('Import complete.')
    } catch (err) {
      console.error('Supabase import failed:', err.message)
      console.error('Run the generated SQL in Supabase SQL Editor instead.')
      process.exit(1)
    }
  }
}

main()
