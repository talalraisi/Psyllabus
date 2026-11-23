/**
 * What the daily reminders would send today, without sending anything.
 *
 *   node scripts/reminders-preview.mjs           counts from the real database
 *   node scripts/reminders-preview.mjs --emails  also writes one sample email of
 *                                                each kind (made-up student) to
 *                                                outputs/reminder-emails/
 *
 * Counts only: no names, addresses or anything a student wrote.
 * Needs scripts/107-reminders.sql applied.
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnv, connect } from './db.mjs'
import { pickReminder, reminderEmail } from '../lib/reminders.js'

loadEnv()
const now = new Date()

if (process.argv.includes('--emails')) {
  const dir = path.join(process.cwd(), 'outputs', 'reminder-emails')
  fs.mkdirSync(dir, { recursive: true })
  const sunday = new Date(now)
  sunday.setUTCDate(now.getUTCDate() + ((7 - now.getUTCDay()) % 7))
  sunday.setUTCHours(14, 0, 0, 0)
  const weekday = new Date(sunday.getTime() + 864e5)
  const base = {
    user_id: '00000000-0000-0000-0000-000000000000', email: 'sample@example.com', first_name: 'Sara',
    free_subject: 'Biology HL', subjects: ['Biology HL', 'Chemistry SL'], grad_year: '2027', exam_session: 'M27',
    email_reminders: true, push_reminders: true, push_subs: [], last_email_at: null, last_push_at: null, nudges_since_active: 0,
    cards_due: 0, mistakes_due: 0, week_minutes: 0, prev_week_minutes: 0, week_questions: 0,
  }
  const samples = {
    start: [weekday, (ago) => ({ created_at: ago(1.2), ever_studied: false, last_active: null })],
    due: [weekday, (ago) => ({ created_at: ago(20), ever_studied: true, last_active: ago(1.5), cards_due: 18 })],
    comeback: [weekday, (ago) => ({ created_at: ago(20), ever_studied: true, last_active: ago(4), weak_subject: 'Biology HL', weak_topic: 'Cell biology', weak_subtopic: 'Membrane transport' })],
    weekly: [sunday, (ago) => ({ created_at: ago(20), ever_studied: true, last_active: ago(1), week_minutes: 140, prev_week_minutes: 95, week_questions: 62, weak_subtopic: 'Membrane transport' })],
  }
  for (const [kind, [at, make]] of Object.entries(samples)) {
    const ago = (d) => new Date(at - d * 864e5).toISOString()
    const r = pickReminder({ ...base, ...make(ago) }, at)
    if (!r) {
      console.log(`${kind}: no reminder for the sample`)
      continue
    }
    const e = reminderEmail(r, { unsubscribeUrl: 'https://www.psyllabus.app/api/reminders/unsubscribe?u=sample' })
    fs.writeFileSync(path.join(dir, `${kind}.html`), e.html)
    console.log(`${kind}.html  —  ${e.subject}`)
  }
  console.log(`\nWritten to ${dir}\n`)
}

const db = await connect()
const { rows } = await db.query('select * from public.reminder_candidates()')
await db.end()

const tally = {}
let email = 0
let push = 0
for (const c of rows) {
  const r = pickReminder(c, now)
  if (!r) continue
  tally[r.kind] = (tally[r.kind] || 0) + 1
  if (r.email) email++
  if (r.sendPush) push++
}
console.log({
  students: rows.length,
  withPushOn: rows.filter((c) => c.push_subs?.length).length,
  emailsOff: rows.filter((c) => !c.email_reminders).length,
  nudgesToday: tally,
  emails: email,
  pushes: push,
})
