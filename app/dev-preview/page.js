'use client'

/**
 * A harness for looking at screens before they ship.
 *
 * Most of this app's interface lives behind a session and a database, which
 * meant interface changes were being deployed and then judged from a phone.
 * Components that take all their data as props can be rendered here with made
 * up data instead, and looked at properly first.
 *
 * It never exists in production. The check is a build-time constant, so the
 * whole page is dropped rather than hidden behind a redirect somebody could
 * get past.
 */

import { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader } from '@/components/PageShell'
import TestBuilder from '@/components/TestBuilder'

const PROFILE = {
  id: 'p',
  full_name: 'Talal Al-Raisi',
  curriculum: 'IB',
  grad_year: 2028,
  plan: 'premium',
  subjects: ['Economics HL', 'Math Analysis & Approaches HL', 'Physics SL'],
}
const TOPICS = [
  'Unit 1 - Introduction to economics',
  'Unit 2 - Microeconomics',
  'Unit 3 - Macroeconomics',
  'Unit 4 - The global economy',
]
const SUBTOPICS = {
  'Unit 3 - Macroeconomics': {
    'Aggregate demand and aggregate supply': 40,
    'Fiscal policy': 11,
    'Macroeconomic objectives': 12,
    'Monetary policy': 10,
    'Supply-side policy': 14,
  },
}
const COUNTS = {
  'Unit 1 - Introduction to economics': 23,
  'Unit 2 - Microeconomics': 46,
  'Unit 3 - Macroeconomics': 87,
  'Unit 4 - The global economy': 2,
}
const LEVELS = [
  { key: 'all', label: 'Everything', hint: 'Core and HL extension together' },
  { key: 'core', label: 'Core only', hint: 'The content SL students also sit' },
  { key: 'hl', label: 'HL extension only', hint: 'Only the higher level content' },
]
const FOCUS_MODES = [
  { key: 'weak', label: 'Target my weak spots', hint: 'Draws from subtopics you got wrong, plus anything decaying.' },
  { key: 'untested', label: 'Cover new ground', hint: 'Only subtopics you have never been tested on.' },
  { key: 'all', label: 'Everything', hint: 'A full mixed paper across the topics you pick.' },
]
const DIFFICULTIES = [
  { key: 'mixed', label: 'Any heat' },
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'hot', label: 'Hot' },
  { key: 'extreme', label: 'Extremely hot' },
  { key: 'burning', label: 'Burning' },
]
const QUESTION_TYPES = [
  { key: 'all', label: 'Any kind', hint: 'Mixed.' },
  { key: 'mcq', label: 'Multiple choice', hint: 'Four options, one right.' },
  { key: 'short_answer', label: 'Written answer', hint: 'You type it.' },
]
const ORDERS = [
  { key: 'mixed', label: 'Mixed', hint: 'Shuffled.' },
  { key: 'rising', label: 'Easiest first', hint: 'Warm up, then climb.' },
  { key: 'falling', label: 'Hardest first', hint: 'Hard ones while fresh.' },
]
const LENGTH_PRESETS = {
  questions: [10, 20, 30, 45],
  marks: [20, 40, 60, 80],
  minutes: [15, 30, 45, 60],
}
const LENGTH_UNIT = { questions: 'questions', marks: 'marks', minutes: 'min' }
const DIFF_COUNTS = { mixed: 158, low: 31, medium: 44, hot: 39, extreme: 28, burning: 16 }
const TYPE_COUNTS = { all: 158, mcq: 96, short_answer: 62 }

/** Build-time constant, so the body is dropped from a production bundle. */
const ENABLED = process.env.NODE_ENV !== 'production'

export default function DevPreview() {
  const [subject, setSubject] = useState('Economics HL')
  const [selected, setSelected] = useState(['Unit 3 - Macroeconomics'])
  const [picked, setPicked] = useState({})
  const [openTopic, setOpenTopic] = useState(null)
  const [level, setLevel] = useState('all')
  const [focusMode, setFocusMode] = useState('weak')
  const [difficulty, setDifficulty] = useState('mixed')
  const [qtype, setQtype] = useState('all')
  const [order, setOrder] = useState('mixed')
  const [lengthMetric, setLengthMetric] = useState('questions')
  const [length, setLength] = useState(20)
  const [customLength, setCustomLength] = useState('')
  const [timed, setTimed] = useState(true)
  const [customMinutes, setCustomMinutes] = useState('')
  const [review, setReview] = useState('exam')
  const [hintsAllowed, setHintsAllowed] = useState(true)

  // After the hooks, never before: an early return above them would make this
  // a component whose hook order changes between environments.
  if (!ENABLED) return null

  return (
    <DashboardLayout profile={PROFILE}>
      <Page width="default">
        <PageHeader eyebrow="Test builder" title="Build a Test" />
        <TestBuilder
          subject={subject}
          subjects={PROFILE.subjects}
          onSubject={setSubject}
          freeNote={null}
          levels={LEVELS}
          level={level}
          onLevel={setLevel}
          showLevel
          hlCount={9}
          focusModes={FOCUS_MODES}
          focusMode={focusMode}
          onFocusMode={setFocusMode}
          topics={TOPICS}
          selected={selected}
          onToggleTopic={(t) =>
            setSelected((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
          }
          onSelectAll={() => setSelected(selected.length === TOPICS.length ? [] : TOPICS)}
          perTopicCounts={COUNTS}
          subtopicsByTopic={SUBTOPICS}
          pickedSubtopics={picked}
          onToggleSubtopic={(topic, name) =>
            setPicked((prev) => {
              const cur = prev[topic] || []
              return {
                ...prev,
                [topic]: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name],
              }
            })
          }
          openTopic={openTopic}
          onOpenTopic={setOpenTopic}
          loadingPool={false}
          difficulties={DIFFICULTIES}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          difficultyCount={(d) => DIFF_COUNTS[d.key] ?? 0}
          questionTypes={QUESTION_TYPES}
          qtype={qtype}
          onQtype={setQtype}
          qtypeCount={(t) => TYPE_COUNTS[t.key] ?? 0}
          orders={ORDERS}
          order={order}
          onOrder={setOrder}
          lengthMetric={lengthMetric}
          onLengthMetric={setLengthMetric}
          lengthPresets={LENGTH_PRESETS}
          lengthUnit={LENGTH_UNIT}
          length={length}
          onLength={(n) => {
            setLength(n)
            setCustomLength('')
          }}
          customLength={customLength}
          onCustomLength={setCustomLength}
          timed={timed}
          onTimed={setTimed}
          customMinutes={customMinutes}
          onCustomMinutes={setCustomMinutes}
          budgetMinutes={31}
          review={review}
          onReview={setReview}
          hintsAllowed={hintsAllowed}
          onHintsAllowed={setHintsAllowed}
          paper={{
            canStart: selected.length > 0,
            actualLength: 20,
            totalMarks: 34,
            estMinutes: 31,
            eligibleCount: 133,
            short: false,
            scopeLabel: '1 of 4 topics · Target my weak spots',
            composition: [
              { key: 'low', label: 'Low', count: 3, share: 0.15, color: 'var(--heat-low)' },
              { key: 'medium', label: 'Medium', count: 6, share: 0.3, color: 'var(--heat-medium)' },
              { key: 'hot', label: 'Hot', count: 7, share: 0.35, color: 'var(--heat-hot)' },
              { key: 'extreme', label: 'Extremely hot', count: 3, share: 0.15, color: 'var(--heat-extreme)' },
              { key: 'burning', label: 'Burning', count: 1, share: 0.05, color: 'var(--heat-burning)' },
            ],
          }}
          onStart={() => {}}
        />
      </Page>
    </DashboardLayout>
  )
}
