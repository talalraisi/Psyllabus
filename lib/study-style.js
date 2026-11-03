/**
 * "How you study": nine questions about habits, and a study type.
 *
 * Each of the ten types is a mix of study methods with evidence behind them
 * (METHODS), chosen to fit how the person already works: how long they focus,
 * when they start, how they check themselves, what gets in the way. It is
 * not visual / auditory / hands-on: teaching to a "learning style" has been
 * tested many times and does not help. The types are about what you do.
 *
 * Every answer scores a few types (SCORES); the top one is yours and the
 * runner-up, when close, is the mix. Every question can be answered "not
 * sure"; mostly unsure gets the Explorer, a start from the methods with the
 * most evidence. It also names the habits that feel useful and are not
 * (BAD), each with why and what to do instead, and what already works. The result also sets the plan (session
 * rhythm, one subject a day or several, methods, daily goal), saved in
 * profiles.plan_settings like the Study plan settings, with the answers in
 * plan_settings.studyStyle.
 */

export const QUESTIONS = [
  {
    key: 'revise',
    q: 'When you revise, what do you do most?',
    options: [
      { v: 'reread', label: 'Read over my notes or the textbook' },
      { v: 'notes', label: 'Rewrite or highlight my notes' },
      { v: 'videos', label: 'Watch videos on it' },
      { v: 'diagrams', label: 'Draw diagrams or mind maps' },
      { v: 'test', label: 'Test myself: questions, flashcards, past papers' },
      { v: 'unsure', label: 'I do not really have a way yet' },
    ],
  },
  {
    key: 'start',
    q: 'A test is two weeks away. When do you start revising?',
    options: [
      { v: 'night', label: 'The night before, or the day of' },
      { v: 'days', label: 'A few days before' },
      { v: 'spread', label: 'Bit by bit, from now' },
      { v: 'unsure', label: 'It depends, I am not sure' },
    ],
  },
  {
    key: 'focus',
    q: 'How long can you focus before your mind wanders?',
    options: [
      { v: '15', label: 'About 15 minutes' },
      { v: '25', label: 'About 25 minutes' },
      { v: '45', label: 'About 45 minutes' },
      { v: '60', label: 'An hour or more' },
      { v: 'unsure', label: 'Not sure' },
    ],
  },
  {
    key: 'wrong',
    q: 'You get a question wrong. What usually happens next?',
    options: [
      { v: 'move', label: 'I move on to the next one' },
      { v: 'read', label: 'I read the right answer' },
      { v: 'redo', label: 'I work out why, and try a similar one later' },
      { v: 'none', label: 'I do not really do practice questions' },
    ],
  },
  {
    key: 'check',
    q: 'How do you know you have learned something?',
    options: [
      { v: 'familiar', label: 'It looks familiar when I read it' },
      { v: 'explain', label: 'I can explain it without my notes' },
      { v: 'answer', label: 'I can answer questions on it' },
      { v: 'unsure', label: 'I am not sure how to tell' },
    ],
  },
  {
    key: 'mix',
    q: 'In one sitting, do you…',
    options: [
      { v: 'one', label: 'Stay on one subject until it is done' },
      { v: 'few', label: 'Switch between a few subjects or topics' },
      { v: 'unsure', label: 'No set way' },
    ],
  },
  {
    key: 'block',
    q: 'What gets in the way most?',
    options: [
      { v: 'phone', label: 'My phone and other distractions' },
      { v: 'start', label: 'Not knowing where to start' },
      { v: 'time', label: 'Not having enough time' },
      { v: 'motivation', label: 'Staying motivated' },
      { v: 'none', label: 'Nothing much, I just get on with it' },
    ],
  },
  {
    key: 'methods',
    q: 'Which of these would you actually do?',
    hint: 'Pick any. Your plan is built from them.',
    multi: true,
    options: [
      { v: 'questions', label: 'Practice questions' },
      { v: 'exam', label: 'Exam-style questions' },
      { v: 'flashcards', label: 'Flashcards' },
      { v: 'blurting', label: 'Blurting: write all you remember, then check' },
      { v: 'teach', label: 'Explaining it to someone, or out loud' },
      { v: 'summaries', label: 'Summaries and mind maps' },
      { v: 'unsure', label: 'Not sure, pick for me', only: true },
    ],
  },
  {
    key: 'time',
    q: 'On a school day, how long can you give to revision?',
    options: [
      { v: '15', label: '15 minutes' },
      { v: '30', label: '30 minutes' },
      { v: '45', label: '45 minutes' },
      { v: '60', label: 'An hour' },
      { v: '90', label: 'An hour and a half or more' },
    ],
  },
]

/** The methods the types are made of: what each is, and how to do it here. */
export const METHODS = {
  recall: {
    name: 'Active recall',
    what: 'Close the notes and pull the answer out of memory. The effort of remembering is what makes it stick.',
    how: 'Flashcards: say or type the answer before you turn the card.',
    href: '/dashboard/flashcards',
  },
  spaced: {
    name: 'Spaced repetition',
    what: 'Come back to a topic after a day, then three, then a week. Each return resets the forgetting.',
    how: 'Your plan and flashcards schedule the returns for you.',
    href: '/dashboard/study-plan',
  },
  testing: {
    name: 'Practice testing',
    what: 'Answer questions the way the exam will ask them, closed book, and see where you slip.',
    how: 'Quizzes on a subtopic, and past papers sat in exam mode.',
    href: '/dashboard/papers',
  },
  feynman: {
    name: 'Feynman technique',
    what: 'Explain the idea in plain words, as if to someone new to it. Wherever you stall is the gap.',
    how: 'Explain a subtopic out loud, then check it against the notes in a lesson.',
    href: '/dashboard/syllabus',
  },
  interleave: {
    name: 'Interleaving',
    what: 'Mix topics and question types in one sitting, so you practise choosing the method, not just using it.',
    how: 'Mixed quizzes, and a plan with a few subjects a day.',
    href: '/dashboard/quiz',
  },
  pomodoro: {
    name: 'Pomodoro',
    what: 'Short timed blocks of focus with a proper break between, so starting is easy and focus stays fresh.',
    how: 'The study timer runs the blocks and breaks; your plan uses the same rhythm.',
    href: '/dashboard/study-plan',
  },
  mindmap: {
    name: 'Mind mapping',
    what: 'Draw the topic out from one idea in the middle, so you see how the parts connect.',
    how: 'Use the subject map to see a topic’s shape, then draw your own from memory.',
    href: '/dashboard/map',
  },
  cornell: {
    name: 'Cornell notes',
    what: 'Notes in three parts: the notes, a column of questions beside them, a summary underneath. The questions become your test.',
    how: 'Keep your notes alongside a lesson, then cover them and answer your own questions.',
    href: '/dashboard/syllabus',
  },
  sq3r: {
    name: 'SQ3R',
    what: 'Survey, Question, Read, Recite, Review: reading with a purpose, made for dense chapters.',
    how: 'Skim a lesson’s headings, write your questions, read for the answers, then recite and quiz.',
    href: '/dashboard/syllabus',
  },
  blurting: {
    name: 'Blurting',
    what: 'Write everything you can remember on a blank page, then check what you missed. What is missing is what to study.',
    how: 'Blurt a subtopic, then take its quiz to check yourself.',
    href: '/dashboard/quiz',
  },
}

/** Ten types, each a mix of methods, and the Explorer for anyone not sure yet. `plan` adds methods the plan builds tasks from. */
export const TYPES = {
  sprinter: {
    name: 'The Sprinter',
    line: 'Short, sharp bursts. You do your best work fast and fresh, so the trick is many small sessions, not a few long ones.',
    methods: ['pomodoro', 'recall', 'spaced'],
    plan: ['flashcards', 'questions'],
  },
  marathoner: {
    name: 'The Marathoner',
    line: 'You can go deep for a long time. Use it on full past papers and hard topics, and space the returns so it lasts.',
    methods: ['testing', 'spaced', 'interleave'],
    plan: ['exam', 'questions'],
  },
  explainer: {
    name: 'The Explainer',
    line: 'You understand by putting things into words. Explaining is one of the strongest ways to learn, so make it your test.',
    methods: ['feynman', 'blurting', 'recall'],
    plan: ['teach', 'blurting'],
  },
  tester: {
    name: 'The Tester',
    line: 'You already learn by answering questions, the method with the most evidence behind it. Now mix them up and space them out.',
    methods: ['testing', 'interleave', 'spaced'],
    plan: ['questions', 'exam'],
  },
  planner: {
    name: 'The Planner',
    line: 'You start early and keep at it, which is half the battle. Fill that time with recall, not re-reading, and it pays off fully.',
    methods: ['spaced', 'recall', 'testing'],
    plan: ['flashcards', 'questions'],
  },
  lastminute: {
    name: 'The Last-Minute Hero',
    line: 'Pressure gets you going, but cramming fades within days. Keep the urgency and spread it: short daily bursts, starting earlier.',
    methods: ['spaced', 'pomodoro', 'recall'],
    plan: ['flashcards', 'questions'],
  },
  mapper: {
    name: 'The Mapper',
    line: 'You see things as connected ideas. Map them, then rebuild the map from memory: that turns a picture into recall.',
    methods: ['mindmap', 'blurting', 'recall'],
    plan: ['summaries', 'blurting'],
  },
  notemaker: {
    name: 'The Note-Maker',
    line: 'Good notes are your base. Turn them into questions and test yourself on them, so the time making them is not wasted.',
    methods: ['cornell', 'recall', 'spaced'],
    plan: ['summaries', 'flashcards'],
  },
  reader: {
    name: 'The Reader',
    line: 'You learn from reading and watching, but it can feel like knowing when it is not. Read with questions, then answer them closed book.',
    methods: ['sq3r', 'testing', 'recall'],
    plan: ['questions', 'flashcards'],
  },
  explorer: {
    name: 'The Explorer',
    line: 'You are still finding what works, which is the best time to start right. Begin with the three methods with the most evidence behind them, then take this again in a few weeks.',
    methods: ['recall', 'spaced', 'testing'],
    plan: ['questions', 'flashcards'],
  },
  switcher: {
    name: 'The Switcher',
    line: 'You like variety. Mixing topics is a real strength for exams, so keep sessions short and mixed, with a question set at the end.',
    methods: ['interleave', 'pomodoro', 'testing'],
    plan: ['questions', 'flashcards'],
  },
}

/** What each answer says about which types fit. */
const SCORES = {
  revise: { reread: { reader: 3 }, notes: { notemaker: 3 }, videos: { reader: 2, mapper: 1 }, diagrams: { mapper: 3 }, test: { tester: 3 } },
  start: { night: { lastminute: 3, sprinter: 1 }, days: { lastminute: 1, planner: 1 }, spread: { planner: 3 } },
  focus: { 15: { sprinter: 3 }, 25: { sprinter: 1, switcher: 1 }, 45: { marathoner: 1, notemaker: 1 }, 60: { marathoner: 3 } },
  wrong: { move: { lastminute: 2 }, read: { reader: 1, notemaker: 1 }, redo: { tester: 1, planner: 1 } },
  check: { familiar: { reader: 2, mapper: 1 }, explain: { explainer: 3 }, answer: { tester: 2 } },
  mix: { one: { marathoner: 2, notemaker: 1 }, few: { switcher: 3 } },
  block: { phone: { sprinter: 2 }, start: { planner: 2, notemaker: 1 }, time: { lastminute: 2 }, motivation: { switcher: 2 } },
  methods: {
    questions: { tester: 1 },
    exam: { tester: 1, marathoner: 1 },
    flashcards: { planner: 1, sprinter: 1 },
    blurting: { explainer: 1, mapper: 1 },
    teach: { explainer: 2 },
    summaries: { mapper: 2, notemaker: 2 },
  },
  time: { 15: { sprinter: 1, lastminute: 1 }, 90: { marathoner: 1 } },
}

/** Habits that feel useful and are not, from the answers: why, and what instead. */
const BAD = [
  { when: (a) => a.revise === 'reread', name: 'Re-reading your notes', why: 'It feels productive because the page gets familiar, but familiar is not the same as remembered. In the exam there is no page to recognise.', instead: 'Close the notes and write or say what you remember, then check. Flashcards do this for you.' },
  { when: (a) => a.revise === 'notes', name: 'Rewriting and highlighting', why: 'It moves information around without making you pull it out of memory, so little of it sticks.', instead: 'Turn each page of notes into five questions, then answer them a day later without looking.' },
  { when: (a) => a.revise === 'videos', name: 'Watching instead of doing', why: 'Following an explanation feels like understanding it. Doing the question yourself is what shows whether you can.', instead: 'Pause before each worked example and try it first, then do a quiz on the topic straight after.' },
  { when: (a) => a.start === 'night', name: 'Cramming', why: 'It can get you through tomorrow, but most of it is gone within days, and IB exams test two years at once.', instead: 'Fifteen to twenty minutes a day from two weeks out. Your plan spaces every topic for you.' },
  { when: (a) => a.start === 'days', name: 'Starting only a few days before', why: 'A few days is not enough room to forget and remember again, which is what makes memory last.', instead: 'Start a little earlier and do less each day. The returns matter more than the hours.' },
  { when: (a) => a.wrong === 'move', name: 'Moving past mistakes', why: 'A question you got wrong is the most useful thing you will see all session. Skipping it means making it again in the exam.', instead: 'Find out why it was wrong, then try a similar one a few days later. Redemption keeps them for you.' },
  { when: (a) => a.wrong === 'read', name: 'Reading the answer and moving on', why: 'Seeing the right answer makes it feel fixed, but you have not had to produce it yourself.', instead: 'Cover the answer and redo the question tomorrow. If you get it, it is learned; if not, it comes back.' },
  { when: (a) => a.wrong === 'none', name: 'Not doing practice questions', why: 'Answering questions is the single method with the most evidence behind it. Without it you only find your gaps in the exam.', instead: 'End every session with five questions on what you just covered.' },
  { when: (a) => a.check === 'familiar' || a.check === 'unsure', name: 'Trusting the feeling that you know it', why: 'Recognising something and being able to recall it are different, and the first is much easier.', instead: 'Before calling a topic done, explain it without notes or answer a few questions on it.' },
  { when: (a) => a.block === 'phone', name: 'Studying next to your phone', why: 'Even a phone face down pulls attention, and every check costs minutes of focus to get back.', instead: 'Phone in another room for each block. Short blocks make that easier to keep to.' },
  { when: (a) => Array.isArray(a.methods) && a.methods.length > 0 && a.methods.every((m) => m === 'summaries'), name: 'Only making summaries', why: 'Summaries are a good start but they do not test you, so they cannot tell you what you have actually learned.', instead: 'After each summary, cover it and blurt what you remember, or do a quiz.' },
]

/** What is already working, from the answers. */
const GOOD = [
  { when: (a) => a.revise === 'test', name: 'You test yourself' },
  { when: (a) => a.start === 'spread', name: 'You start early and spread it out' },
  { when: (a) => a.wrong === 'redo', name: 'You go back to your mistakes' },
  { when: (a) => a.check === 'explain' || a.check === 'answer', name: 'You check what you really know' },
  { when: (a) => a.mix === 'few', name: 'You mix topics' },
  { when: (a) => a.block === 'none', name: 'You get on with it' },
]

const BLOCK_TIPS = {
  phone: 'Put the phone in another room for each session. Short blocks with a real break make it easier to start and to keep going.',
  start: "Open Today's plan and do the first task on it. It picks what matters most, so you never have to.",
  time: 'A small goal you hit every day beats a big one you miss. Fifteen minutes still counts and keeps your streak.',
  motivation: 'Add a friend and keep each other going: you see each other’s streaks and study time, nothing else.',
}

const RHYTHM_FOR = { 15: '25', 25: '25', 45: '45', 60: '50' }

/** The answers as a result: your type, the mix, a tip, and plan settings. */
export function resultOf(a) {
  const score = Object.fromEntries(Object.keys(TYPES).map((k) => [k, 0]))
  for (const [q, table] of Object.entries(SCORES)) {
    const picked = Array.isArray(a[q]) ? a[q] : a[q] != null ? [a[q]] : []
    for (const v of picked) for (const [t, n] of Object.entries(table[v] || {})) score[t] += n
  }
  const ranked = Object.keys(TYPES).filter((k) => k !== 'explorer').sort((x, y) => score[y] - score[x])
  // Mostly "not sure": too little to go on, so the methods that suit anyone.
  const unsure = Object.values(a).filter((v) => v === 'unsure' || (Array.isArray(v) && v.includes('unsure'))).length
  const type = score[ranked[0]] < 3 || unsure >= 4 ? 'explorer' : ranked[0]
  // A mix only when the runner-up is close; otherwise one clear type.
  const also = type !== 'explorer' && score[ranked[1]] >= Math.max(2, score[type] * 0.6) ? ranked[1] : null
  const methods = [...TYPES[type].methods, ...(also ? TYPES[also].methods : [])].filter((m, i, all) => all.indexOf(m) === i).slice(0, 4)

  const chosen = Array.isArray(a.methods) ? a.methods.filter((m) => m !== 'unsure') : []
  const planMethods = [...chosen, ...TYPES[type].plan].filter((m, i, all) => all.indexOf(m) === i)
  const tests = planMethods.some((m) => ['questions', 'exam', 'flashcards', 'blurting'].includes(m))
  const setup = {
    rhythm: RHYTHM_FOR[a.focus] || '25',
    mix: a.mix === 'one' ? 'focus' : 'mixed',
    // A plan with no testing in it is not one; questions keep it honest.
    methods: tests ? planMethods : ['questions', ...planMethods],
    goal: Math.min(120, Number(a.time) || 30),
  }
  const bad = BAD.filter((h) => h.when(a))
  const good = GOOD.filter((h) => h.when(a)).map((h) => h.name)
  return { type, also, methods, bad, good, block: BLOCK_TIPS[a.block] || null, setup }
}

/** plan_settings with the result applied, keeping everything else. */
export function applyTo(planSettings, answers) {
  const { setup, type } = resultOf(answers)
  const saved = planSettings || {}
  return {
    ...saved,
    goal: setup.goal,
    style: { ...(saved.style || {}), rhythm: setup.rhythm, mix: setup.mix, methods: setup.methods },
    studyStyle: { answers, type, at: new Date().toISOString() },
  }
}
