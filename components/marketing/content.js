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
    a: 'The syllabus is mapped for IB, A-Level and AP across 173 subjects. Question coverage is still being built and is deeper in some subjects than others, which the app tells you rather than hides.',
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
