/**
 * Homepage copy, lifted from the live page so the remake is a restyle and not
 * a rewrite. Nothing here is new except the objections block, which is drawn
 * from what IB students actually complain about in public.
 */

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Map your syllabus',
    body: 'Pick your subjects and see every topic and subtopic from the official course outline on one screen.',
  },
  {
    step: '02',
    title: 'Prove what you know',
    body: 'Take a quiz on any subtopic. Where you stand comes from how many you got right, not from how you felt about it.',
  },
  {
    step: '03',
    title: 'Study what actually matters',
    body: 'Weak and fading subtopics rise to the top of your plan, and every question you got wrong comes back for review.',
  },
]

export const FEATURES = [
  ['Heatmap you cannot fake', 'Five levels, from Weak to Mastered, every one set by a quiz rather than by how you feel.', 'mastered'],
  ['Topics that fade', 'Nail something, leave it two weeks untouched and it fades back into your plan for a retest.', 'fading'],
  ['Mistake bank', 'Questions you got wrong come back on a spaced schedule, so you drill your own gaps.', 'weak'],
  ['Timed papers', 'Build a paper from any mix of topics and sit it against a live marks-per-minute clock.', 'developing'],
  ['Calendar and reminders', 'Put your tests and IA deadlines in, and the planner moves that subject up as they get close.', 'proficient'],
  ['A session timer that follows you', 'Start a study block and it keeps running while you work through quizzes.', 'fading'],
  ['Real resources on every subtopic', 'Hand-picked lessons, videos and notes for the exact thing you got wrong, not a search box.', 'proficient'],
  ['Predicted grade', 'A running prediction out of 45, built from your quiz results, next to the grades you told us you want.', 'mastered'],
]

export const WHY = [
  {
    title: 'Because you cannot mark your own homework',
    body: 'Asking students to rate their own confidence produces a map of their mood, not their knowledge. The effect is well documented: the less someone knows about a topic, the more likely they are to overrate themselves on it. Every status here comes from questions you either got right or did not, which is the one signal that cannot flatter you.',
  },
  {
    title: 'Because forgetting is the default, not the exception',
    body: 'Memory decays on a curve unless it is used, and the gap between learning something in October and being examined on it in May is where most marks quietly disappear. Anything you had proved starts Fading after about two weeks untouched and returns for a short retest. Spacing practice out like this is one of the most reliably supported findings in learning research.',
  },
  {
    title: 'Because testing is studying, not just measuring',
    body: 'Retrieving an answer from memory strengthens it far more than reading the same page again. Every quiz here does two jobs at once: telling the planner where you stand, and making the thing you just recalled harder to forget.',
  },
  {
    title: 'Because your own mistakes beat anyone else’s',
    body: 'A question you got wrong is worth more than ten you got right, and it goes into a bank that brings it back on a widening schedule: a day later, then three, then a week. You drill your specific gaps instead of generic cards written for somebody else.',
  },
  {
    title: 'Because knowing what to do is most of the battle',
    body: 'Most students do not lack material, they lack direction, and picking a subject to revise at 8pm is a decision made on guesswork and guilt. Tell the planner how long you have and it hands you an ordered list, with a reason attached to each item so you can disagree with it.',
  },
  {
    title: 'Because a number you can check beats a feeling',
    body: 'A predicted grade out of 45 next to the one you are aiming for turns a vague worry into a gap you can close. It says how much of your syllabus it is based on, so a prediction from three quizzes is labelled low confidence rather than presented as a forecast.',
  },
]

export const FAQ = [
  {
    q: 'What is Project Syllabus?',
    a: 'A study tracker for students taking the IB Diploma, A-Levels or AP exams. It lays out every topic and subtopic of your official course, works out which parts you are weak on by testing you, and tells you what to study today. Built in Muscat, Oman by an IB Diploma student.',
  },
  {
    q: 'How is it different from a revision app or flashcards?',
    a: 'Most trackers ask you to rate your own confidence, and most students are poor judges of what they know. This never asks. Every subtopic is coloured by how many questions you got right, so the map reflects tested ability rather than how you feel about a topic.',
  },
  {
    q: 'How does the syllabus tracking work?',
    a: 'Pick your subjects and you get the full course broken into topics and subtopics from the official outlines. Each subtopic sits at one of five levels: Weak, Developing, Proficient, Mastered, or Fading once something you had proved starts slipping. Anything untested stays grey, because untested is not a level, it is the absence of one.',
  },
  {
    q: 'What does the study plan actually do?',
    a: 'Tell it how long you have, from five minutes to eight hours, and it builds a session that fits. It ranks subtopics by what you got wrong, what is fading, what a test is coming up on, and which foundations unlock later topics. Every item says why it is there.',
  },
  {
    q: 'Which subjects are covered?',
    a: 'The syllabus is mapped for IB, A-Level and AP across 128 courses: 46 IB, 44 A-Level and 38 AP, listed in full on the Subjects page. Question coverage is still being built and is deeper in some subjects than others, which the app tells you rather than hides.',
  },
  {
    q: 'How do school codes work, and what stops one leaking?',
    a: 'A school buys one code for a year group and students type it in once. Each code has a redemption limit, so it cannot quietly become a public unlock, and no card is involved for the student.',
  },
]

export const ANSWERS = [
  {
    them: 'Notes and questions generated in bulk and never checked',
    us: 'Every question is solved from scratch twice, by a different model that never sees the intended answer. Disagreements are thrown away before anyone sits them.',
  },
  {
    them: 'An AI explanation that contradicts your textbook',
    us: 'Each wrong option carries the specific mistake that leads there, written with the question and checked with it. No chatbot improvising at the moment you are confused.',
  },
  {
    them: 'Free YouTube lessons resold behind a tier',
    us: 'Links go to the creator’s own page. Nothing is rehosted, and nothing free is put behind a wall.',
  },
  {
    them: 'An exam builder that cannot read your handwriting',
    us: 'We do not pretend to mark handwriting or diagrams. What is marked is marked exactly; what needs a human says so.',
  },
  {
    them: 'Three tiers, and the one you bought is never the right one',
    us: 'One subject free with no time limit. One price for the rest. If your school has a code, all of it is free.',
  },
]

/**
 * Each feature, at length.
 *
 * The front page shows eight of these one slide at a time, which is the right
 * amount to decide whether to keep reading and the wrong amount to decide
 * whether to sign up. Somebody who followed "Learn more" has already decided
 * they are interested; what they want then is how the thing actually works,
 * and — the part most product pages leave out — where it stops.
 *
 * So every entry carries three things: what it is, the mechanism in enough
 * detail to argue with, and the limit. The limits are real. A page that lists
 * only capabilities is a page you cannot trust about capabilities.
 */
export const FEATURE_DETAIL = [
  {
    label: 'The map',
    title: 'A heatmap you cannot fake',
    lede: 'Every subtopic of your course, coloured by what you proved.',
    how: [
      'Pick your subjects and the full official outline appears, broken into topics and subtopics. Nothing is coloured at first, because untested is not a level but the absence of one, and it stays grey to say so.',
      'Each subtopic sits at one of five levels: Weak, Developing, Proficient, Mastered, or Fading. The level is a function of how many questions you got right on that subtopic and how hard they were, so an easy run cannot carry you to the top.',
      'There is no confidence slider anywhere in this product. Asking students to rate themselves produces a map of their mood, and the students furthest from understanding a topic are the ones most likely to overrate it.',
    ],
    limit: 'A subtopic you have never been tested on is grey, not green. The map will not flatter you by assuming the parts you skipped are fine.',
  },
  {
    label: 'Decay',
    title: 'Topics that fade on their own',
    lede: 'Prove something, leave it, and it quietly goes back on the list.',
    how: [
      'Anything you proved starts fading after about two weeks untouched, and drops back into your plan for a short retest rather than a full one.',
      'Fading is its own level with its own colour, so you can tell the difference between a topic you never learned and a topic you learned in October and have not seen since.',
      'Nothing else takes a green tick away from you. Only time does, and only after you have actually stopped touching it.',
    ],
    limit: 'It cannot know you revised something on paper. If you worked on a topic away from here, test it here and the fade clears.',
  },
  {
    label: 'Review',
    title: 'A mistake bank that schedules itself',
    lede: 'Your own wrong answers, on a widening schedule.',
    how: [
      'Every question you get wrong goes into the bank and comes back straight away, then after a day, then five, then a week.',
      'Get it right each time and the gap widens until it leaves the bank for good. Get it wrong and the schedule restarts from the beginning.',
      'You end up drilling the questions you personally failed rather than a deck somebody else wrote for a student who is not you.',
    ],
    limit: 'It only holds questions you have actually attempted. It is a record of your mistakes, not a prediction of which ones you would make.',
  },
  {
    label: 'Papers',
    title: 'Timed papers with real pacing',
    lede: 'Sit a paper the way your subject examines it, against a clock that tells you the truth.',
    how: [
      'Build a paper from any mix of topics, or sit Paper 1 and Paper 2 as your subject actually sets them, with the same structure and the same timing.',
      'A live marks-per-minute figure runs beside the clock and compares where you are against the pace the paper needs. You find out you are behind while there is still time to do something about it, rather than at the end.',
      'Results feed the same map as everything else, so a paper counts as evidence rather than as a separate score in a separate place.',
    ],
    limit: 'A generated paper is built to the shape of the real one. It is not a past paper, and nothing here is scraped from one.',
  },
  {
    label: 'Calendar',
    title: 'Deadlines that change the plan',
    lede: 'Put a test in and the plan reorders itself as it gets close.',
    how: [
      'Add your tests, mocks and internal assessment deadlines. Each one is attached to a subject, and to specific topics if you know which.',
      'As a date approaches the planner moves that subject up on its own. The week before a mock reorders itself without you sitting down to decide what to prioritise.',
      'Every item in the plan says why it is there, so when a topic jumps the queue you can see whether you agree with the reason.',
    ],
    limit: 'It does not read your school calendar. What is in it is what you put in it.',
  },
  {
    label: 'Sessions',
    title: 'A timer that follows you around',
    lede: 'One number for whether tonight actually happened.',
    how: [
      'Start a study block and it keeps running while you move between quizzes, notes, the plan and the map. It does not reset when you change page.',
      'Blocks are recorded against the subjects you worked on, so the week adds up to something you can look at rather than a feeling about how much you did.',
      'It is the one number in the product that measures effort rather than result, which is why it is deliberately kept separate from the map.',
    ],
    limit: 'Time in a session is not evidence of anything. It never moves a subtopic up a level. Only questions do that.',
  },
  {
    label: 'Resources',
    title: 'Something to read for the exact gap',
    lede: 'A wrong answer leads somewhere, not into a search box.',
    how: [
      'Every subtopic carries hand-picked lessons, videos and notes for that one thing, so getting a question wrong ends with something to read rather than a query to type.',
      'Links open on the creator’s own site. Nothing is rehosted, nothing is mirrored, and nothing is resold.',
      'Coverage is deeper in some subjects than others, and the app says which rather than presenting a thin list as a complete one.',
    ],
    limit: 'These are other people’s materials, credited and linked. If a creator wants a link removed it comes down.',
  },
  {
    label: 'Prediction',
    title: 'A grade you can check the maths on',
    lede: 'A running total built only from results, stated with its own confidence.',
    how: [
      'A running prediction sits next to the grades you told us you want, built from quiz results and nothing else.',
      'It states how much of your syllabus it is based on. A prediction from three quizzes is labelled low confidence instead of presented as a forecast.',
      'The scale follows your curriculum: out of 45 with the core for the IB, and the right scale for A-Level and AP rather than a number you can never get.',
    ],
    limit: 'It predicts from what you have been tested on here. It is a measurement of your evidence so far, not a forecast of results day.',
  },
]
