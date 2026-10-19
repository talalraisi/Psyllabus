// Run with: TZ=Asia/Muscat node scripts/study-plan-test.mjs
//
// The study plan engine (lib/study-plan.js), checked against what it promises:
// it values work by how far it moves a grade towards its target, never books
// more than the student has, mixes or focuses subjects as asked, puts dated
// things on their dates, and lets the student's own edits win.

import assert from 'node:assert/strict'
import {
  resolveSettings,
  studyMinutesFor,
  subjectWeight,
  buildCandidates,
  buildPlan,
  stepsFor,
  nextDeadline,
  dateKey,
} from '../lib/study-plan.js'

let n = 0
const check = (label, fn) => {
  fn()
  n++
  console.log('  ok ', label)
}

// Sunday 18 October 2026, early evening in Muscat.
const NOW = new Date(2026, 9, 18, 18, 0)
const day = (offset) => dateKey(new Date(2026, 9, 18 + offset))

const profile = {
  curriculum: 'IB',
  grad_year: 2027,
  plan: 'premium',
  subjects: ['Physics HL', 'Economics SL', 'History SL'],
  target_grades: { 'Physics HL': '7', 'Economics SL': '5', 'History SL': '6' },
  session_minutes: 60,
  plan_settings: { week: { 0: 90, 1: 90, 2: 90, 3: 90, 4: 90, 5: 0, 6: 120 } },
}

// Six topics per subject, three subtopics each, in syllabus order.
function syllabus(statusOf = () => 'not_started') {
  const rows = []
  let position = 0
  for (const subject of profile.subjects) {
    for (let t = 1; t <= 6; t++) {
      for (let s = 1; s <= 3; s++) {
        rows.push({ subject, topic: `Topic ${t}`, subtopic: `${subject} ${t}.${s}`, position: position++, status: statusOf(subject, t, s) })
      }
    }
  }
  return rows
}
const sizes = { 'Physics HL': 18, 'Economics SL': 18, 'History SL': 18 }
// Physics two grades under target, Economics on target, History one under.
const predicted = { 'Physics HL': '5', 'Economics SL': '5', 'History SL': '5' }

const settings = resolveSettings(profile)
const candidates = (opts = {}) =>
  buildCandidates({ items: syllabus(opts.statusOf), profile, settings: opts.settings || settings, predicted, subjectSizes: sizes, events: opts.events || [], covered: opts.covered || null, details: opts.details || {}, now: NOW })

console.log('settings')
check('Friday is off and Saturday is half as much again, by default', () => {
  const s = resolveSettings({ session_minutes: 60 })
  assert.equal(s.week[5], 0)
  assert.equal(s.week[6], 90)
  assert.equal(s.week[0], 60)
})
check('saved minutes win, and a rhythm that does not exist falls back', () => {
  const s = resolveSettings({ plan_settings: { week: { 2: 45 }, style: { rhythm: 'nonsense', mix: 'focus' } } })
  assert.equal(s.week[2], 45)
  assert.equal(s.style.rhythm, '25')
  assert.equal(s.style.mix, 'focus')
})
check('breaks come out of the evening, not on top of it', () => {
  assert.equal(studyMinutesFor(60, '25'), 50)
  assert.equal(studyMinutesFor(60, '50'), 50)
  assert.equal(studyMinutesFor(60, 'long'), 60)
})

console.log('what is worth doing')
check('a subject under target outweighs one on target; further under, more', () => {
  assert.equal(subjectWeight('5', '5', 'IB'), 0.4)
  assert.equal(subjectWeight('6', '7', 'IB'), 2)
  assert.equal(subjectWeight('5', '7', 'IB'), 3)
  assert.equal(subjectWeight(null, 'A', 'A-Level'), 5) // E is four under A
  assert.equal(subjectWeight('5', undefined, 'IB'), 1)
})
check('the same weak subtopic ranks Physics (2 under) above History (1 under) above Economics (on target)', () => {
  const c = candidates({ statusOf: (s, t, i) => (t === 3 && i === 1 ? 'in_progress' : 'mastered') })
  assert.deepEqual(c.map((x) => x.subject), ['Physics HL', 'History SL', 'Economics SL'])
})
check('fading near its drop to Weak is worth more than fading that has just begun', () => {
  const lastCorrect = (days) => new Date(NOW.getTime() - days * 86400000).toISOString()
  const c = buildCandidates({
    items: [
      { subject: 'History SL', topic: 'Topic 4', subtopic: 'old', position: 1, status: 'decaying' },
      { subject: 'History SL', topic: 'Topic 4', subtopic: 'new', position: 2, status: 'decaying' },
    ],
    details: { 'History SL::old': { updatedAt: lastCorrect(32) }, 'History SL::new': { updatedAt: lastCorrect(15) } },
    profile, settings, predicted, subjectSizes: sizes, now: NOW,
  })
  assert.equal(c[0].subtopic, 'old')
  assert.match(c[0].reasons[0].label, /drops to Weak in 3 days/)
})
check('a test in the calendar pulls its subject up, and says so', () => {
  const statusOf = (s, t, i) => (t === 3 && i === 1 ? 'in_progress' : 'mastered')
  const events = [{ subject: 'Economics SL', title: 'Econ mock', due_at: new Date(2026, 9, 20).toISOString() }]
  const c = candidates({ statusOf, events })
  const econ = c.find((x) => x.subject === 'Economics SL')
  assert.equal(c[0].subject, 'Economics SL', 'a test in two days outranks everything undated')
  // A week out it sits among the subjects furthest from target, not above them all.
  const weekOut = candidates({ statusOf, events: [{ ...events[0], due_at: new Date(2026, 9, 25).toISOString() }] })
  assert.deepEqual(weekOut.map((x) => x.subject), ['Physics HL', 'Economics SL', 'History SL'])
  assert.ok(econ.reasons.some((r) => r.label === 'Econ mock in 2 days'))
})
check('topics the class has not reached are left out', () => {
  const s = resolveSettings({ ...profile, plan_settings: { ...profile.plan_settings, taught: { 'Physics HL': 'Topic 2' } } })
  const c = candidates({ settings: s })
  const physicsTopics = new Set(c.filter((x) => x.subject === 'Physics HL').map((x) => x.topic))
  assert.deepEqual([...physicsTopics].sort(), ['Topic 1', 'Topic 2'])
  assert.ok(c.some((x) => x.subject === 'History SL' && x.topic === 'Topic 6'), 'other subjects untouched')
})
check('no questions yet: still planned, but after things that can be quizzed, and learned without a quiz', () => {
  const covered = new Set(['Physics HL::Physics HL 4.1'])
  const c = candidates({ covered })
  const quizzable = c.find((x) => x.quizzable)
  assert.ok(c.indexOf(quizzable) === 0)
  const notYet = c.find((x) => !x.quizzable)
  assert.deepEqual(stepsFor(notYet).map((s) => s.kind), ['read', 'recall'])
})

console.log('the days')
const statusMix = (s, t, i) => (i === 1 ? 'in_progress' : i === 2 ? 'confident' : 'not_started')
const plan = (opts = {}) =>
  buildPlan({ candidates: opts.candidates || candidates({ statusOf: statusMix, settings: opts.settings }), settings: opts.settings || settings, mistakes: opts.mistakes || [], adjustments: opts.adjustments || [], keepToday: opts.keepToday || null, now: NOW })

check('no day is booked past what it holds once breaks are taken out', () => {
  for (const d of plan().days) {
    const own = d.tasks.filter((t) => !t.fixed).reduce((n, t) => n + t.minutes, 0)
    assert.ok(own <= d.study, `${d.date}: ${own} > ${d.study}`)
  }
})
check('Friday, with no minutes, gets nothing', () => {
  const friday = plan().days.find((d) => d.weekday === 5)
  assert.equal(friday.tasks.length, 0)
})
check('mixed: what the plan picks by value never gives one subject more than half a day, and nothing sits back to back when it need not', () => {
  // Retests that are due and the furthest-behind subject's one guaranteed
  // lesson are exempt by design; everything chosen by value is not.
  for (const d of plan().days) {
    const bySubject = {}
    for (const t of d.tasks) if (!t.fixed && !t.first) bySubject[t.subject] = (bySubject[t.subject] || 0) + t.minutes
    for (const [s, m] of Object.entries(bySubject)) assert.ok(m <= Math.max(40, d.study * 0.5), `${d.date} ${s} has ${m} of ${d.study}`)
    for (let i = 1; i < d.tasks.length; i++) {
      // A subject's mistakes, then its lesson, is a pairing rather than a repeat.
      if (d.tasks[i - 1].kind === 'review') continue
      if (d.tasks[i].subject === d.tasks[i - 1].subject) {
        const others = d.tasks.slice(i).some((t) => t.subject !== d.tasks[i].subject)
        assert.ok(!others, `${d.date} back to back when it need not be`)
      }
    }
  }
})
check('focus: at most two subjects a day', () => {
  const s = resolveSettings({ ...profile, plan_settings: { ...profile.plan_settings, style: { mix: 'focus' } } })
  for (const d of plan({ settings: s, candidates: candidates({ statusOf: statusMix, settings: s }) }).days) {
    const subjects = new Set(d.tasks.filter((t) => t.kind !== 'retest').map((t) => t.subject))
    assert.ok(subjects.size <= 2, `${d.date}: ${[...subjects]}`)
  }
})
check('something learned today is retested three days later, skipping a day off', () => {
  const p = plan()
  const learned = p.days[0].tasks.find((t) => t.kind === 'learn')
  const retest = p.days.flatMap((d) => d.tasks.map((t) => ({ ...t, date: d.date }))).find((t) => t.id === `retest::${learned.key}`)
  assert.ok(retest, 'retest exists')
  assert.equal(retest.date, day(3))
  // Learned on Tuesday (+2): three days later is Friday, which is off, so Saturday.
  const tue = p.days[2].tasks.find((t) => t.kind === 'learn')
  const tueRetest = p.days.flatMap((d) => d.tasks.map((t) => ({ ...t, date: d.date }))).find((t) => t.id === `retest::${tue.key}`)
  assert.equal(tueRetest.date, day(6))
})
check('mistakes due back are on their day, first, one review per subject', () => {
  const mistakes = [
    { subject: 'Physics HL', next_review_at: new Date(2026, 9, 16).toISOString() },
    { subject: 'Physics HL', next_review_at: new Date(2026, 9, 18).toISOString() },
    { subject: 'History SL', next_review_at: new Date(2026, 9, 19).toISOString() },
  ]
  const p = plan({ mistakes })
  assert.equal(p.days[0].tasks[0].kind, 'review')
  assert.equal(p.days[0].tasks[0].reasons[0].label, '2 mistakes due back')
  assert.equal(p.days[1].tasks[0].subject, 'History SL')
})
check('skip today: gone from today, back on a later day', () => {
  const first = plan().days[0].tasks.find((t) => t.kind === 'learn')
  const p = plan({ adjustments: [{ kind: 'skip', task_id: first.id, on_date: day(0) }] })
  assert.ok(!p.days[0].tasks.some((t) => t.id === first.id))
  assert.ok(p.days.slice(1).some((d) => d.tasks.some((t) => t.id === first.id)))
})
check('move to Thursday: it is on Thursday and nowhere earlier', () => {
  const first = plan().days[0].tasks.find((t) => t.kind === 'learn')
  const p = plan({ adjustments: [{ kind: 'move', task_id: first.id, to_date: day(4) }] })
  const where = p.days.filter((d) => d.tasks.some((t) => t.id === first.id)).map((d) => d.date)
  assert.deepEqual(where, [day(4)])
})
check('marked done today: shown done today, not planned again this week', () => {
  const first = plan().days[0].tasks.find((t) => t.kind === 'learn')
  const p = plan({ keepToday: plan().days[0], adjustments: [{ kind: 'done', task_id: first.id, on_date: day(0) }] })
  assert.ok(p.days[0].tasks.find((t) => t.id === first.id).done)
  assert.ok(!p.days.slice(1, 7).some((d) => d.tasks.some((t) => t.id === first.id)))
})
check('today stays as it was shown, even after a quiz changes what is weak', () => {
  const shown = plan().days[0]
  const after = plan({ keepToday: shown, candidates: candidates({ statusOf: () => 'proficient' }) })
  assert.deepEqual(after.days[0].tasks.map((t) => t.id), shown.tasks.map((t) => t.id))
})

check('today as shown still loses what the student skips or moves away', () => {
  const shown = plan().days[0]
  const [a, b] = shown.tasks.filter((t) => t.kind === 'learn')
  const p = plan({ keepToday: shown, adjustments: [{ kind: 'skip', task_id: a.id, on_date: day(0) }, { kind: 'move', task_id: b.id, to_date: day(2) }] })
  assert.ok(!p.days[0].tasks.some((t) => t.id === a.id || t.id === b.id))
  assert.ok(p.days[2].tasks.some((t) => t.id === b.id))
})

check('the subject furthest from target gets real learning every study day, not just cheap upkeep', () => {
  // Physics two grades under with weak topics; the others full of quick, valuable fading retests.
  const lastCorrect = new Date(NOW.getTime() - 33 * 86400000).toISOString()
  const statusOf = (s, t, i) => (s === 'Physics HL' ? 'in_progress' : 'decaying')
  const details = Object.fromEntries(
    syllabus(statusOf).filter((r) => r.status === 'decaying').map((r) => [`${r.subject}::${r.subtopic}`, { updatedAt: lastCorrect }])
  )
  const p = plan({ candidates: candidates({ statusOf, details }) })
  for (const d of p.days.filter((d) => d.study >= 40)) {
    assert.ok(
      d.tasks.some((t) => t.subject === 'Physics HL' && t.kind === 'learn'),
      `${d.date}: no Physics learning — ${d.tasks.map((t) => t.subject + ':' + t.kind).join(', ')}`
    )
  }
})

check('the day runs: mistakes due, then the main piece of learning, then the rest', () => {
  const mistakes = [{ subject: 'History SL', next_review_at: NOW.toISOString() }]
  const d = plan({ mistakes }).days[0]
  assert.equal(d.tasks[0].kind, 'review')
  assert.ok(d.tasks[1].first && d.tasks[1].kind === 'learn')
})

console.log('steps')
check('steps always add up to the task, in the order the student likes', () => {
  const task = { kind: 'learn', status: 'confident', minutes: 25, quizzable: true }
  for (const order of ['auto', 'questions', 'reading']) {
    const steps = stepsFor(task, { order, cards: true })
    assert.equal(steps.reduce((m, s) => m + s.minutes, 0), 25)
  }
  assert.equal(stepsFor(task, { order: 'questions' })[0].kind, 'quiz')
  assert.equal(stepsFor(task, { order: 'reading' })[0].kind, 'read')
})
check('topping up uses flashcards only for those who want them', () => {
  const task = { kind: 'topup', minutes: 20, quizzable: true }
  assert.deepEqual(stepsFor(task, { cards: true }).map((s) => s.kind), ['quiz', 'cards'])
  assert.deepEqual(stepsFor(task, { cards: false }).map((s) => s.kind), ['quiz'])
})

console.log('countdown')
check('the soonest of a test and an exam', () => {
  const events = [{ title: 'Physics test', subject: 'Physics HL', due_at: new Date(2026, 9, 27).toISOString() }]
  const next = nextDeadline({ events, profile, settings, subjects: profile.subjects, now: NOW })
  assert.equal(next.title, 'Physics test')
  assert.equal(next.days, 9)
  const noTests = nextDeadline({ events: [], profile, settings, subjects: profile.subjects, now: NOW })
  assert.equal(noTests.kind, 'exam')
})

console.log(`\n${n} checks passed`)
