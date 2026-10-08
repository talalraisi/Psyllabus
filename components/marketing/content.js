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
  ['Topics that fade', 'Nail something, leave it two weeks untouched and it starts fading. Leave it another three and it counts as not known.', 'fading'],
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
    body: 'Rate your own confidence and you get a map of your mood. The less you know about something, the more likely you are to overrate it. Every level here comes from questions instead.',
  },
  {
    title: 'Because forgetting is the default, not the exception',
    body: 'Memory decays unless it is used, and the gap between October and May is where most marks quietly disappear. Anything you proved starts fading after two weeks, and drops to Weak after five.',
  },
  {
    title: 'Because testing is studying, not just measuring',
    body: 'Retrieving an answer strengthens it far more than reading the page again. Every quiz does two jobs: it tells the planner where you stand, and it makes the thing harder to forget.',
  },
  {
    title: 'Because your own mistakes beat anyone else’s',
    body: 'A question you got wrong is worth more than ten you got right. Each one returns after a day, then five, then a week, until you have proved it sticks.',
  },
  {
    title: 'Because knowing what to do is most of the battle',
    body: 'Most students do not lack material, they lack direction. Tell the planner how long you have and it builds the evening, worst thing first, with a reason on every line.',
  },
  {
    title: 'Because a number you can check beats a feeling',
    body: 'A predicted grade next to the one you want turns a vague worry into a gap you can close. It says how much of your syllabus it rests on, so three quizzes is labelled low confidence.',
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
      'Every subtopic of your course, from the official outline',
      'Five levels, each set by questions you got right or did not',
      'No confidence slider. Anywhere. Ever.',
    ],
    limit: 'A subtopic you have never been tested on is grey, not green. The map will not flatter you by assuming the parts you skipped are fine.',
  },
  {
    label: 'Decay',
    title: 'Topics that fade on their own',
    lede: 'Prove something, leave it, and it quietly goes back on the list.',
    how: [
      'Two weeks untouched and it starts fading',
      'Three weeks more and it counts as not known',
      'One correct answer puts it back',
    ],
    limit: 'It cannot know you revised something on paper. If you worked on a topic away from here, test it here and the fade clears.',
  },
  {
    label: 'Review',
    title: 'A mistake bank that schedules itself',
    lede: 'Your own wrong answers, on a widening schedule.',
    how: [
      'Every wrong answer returns, on a widening gap',
      'Right each time and it leaves the bank for good',
      'Wrong once and the schedule restarts',
    ],
    limit: 'It only holds questions you have actually attempted. It is a record of your mistakes, not a prediction of which ones you would make.',
  },
  {
    label: 'Papers',
    title: 'Timed papers with real pacing',
    lede: 'Sit a paper the way your subject examines it, against a clock that tells you the truth.',
    how: [
      'Build from any topics, or sit Paper 1 and Paper 2',
      'Live marks per minute against the pace you need',
      'Results feed the same map as everything else',
    ],
    limit: 'A generated paper is built to the shape of the real one. It is not a past paper, and nothing here is scraped from one.',
  },
  {
    label: 'Calendar',
    title: 'Deadlines that change the plan',
    lede: 'Put a test in and the plan reorders itself as it gets close.',
    how: [
      'Add your tests, mocks and IA deadlines',
      'That subject rises in the plan as the date nears',
      'Every item still says why it is there',
    ],
    limit: 'It does not read your school calendar. What is in it is what you put in it.',
  },
  {
    label: 'Sessions',
    title: 'A timer that follows you around',
    lede: 'One number for whether tonight actually happened.',
    how: [
      'Starts once and follows you between pages',
      'Recorded against the subjects you actually worked on',
      'Measures effort. Never moves a level.',
    ],
    limit: 'Time in a session is not evidence of anything. It never moves a subtopic up a level. Only questions do that.',
  },
  {
    label: 'Resources',
    title: 'Something to read for the exact gap',
    lede: 'A wrong answer leads somewhere, not into a search box.',
    how: [
      'Hand-picked lessons and notes for each subtopic',
      'A wrong answer ends somewhere, not in a search box',
      'Opens on the creator’s own site. Nothing rehosted.',
    ],
    limit: 'These are other people’s materials, credited and linked. If a creator wants a link removed it comes down.',
  },
  {
    label: 'Prediction',
    title: 'A grade you can check the maths on',
    lede: 'A running total built only from results, stated with its own confidence.',
    how: [
      'A running total built only from quiz results',
      'States how much of your syllabus it rests on',
      'Three quizzes is labelled low confidence, not a forecast',
    ],
    limit: 'It predicts from what you have been tested on here. It is a measurement of your evidence so far, not a forecast of results day.',
  },
]
