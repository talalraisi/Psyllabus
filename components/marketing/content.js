/**
 * Homepage copy, lifted from the live page so the remake is a restyle and not
 * a rewrite. Nothing here is new except the objections block, which is drawn
 * from what IB students actually complain about in public.
 */

import { coursesIn } from '@/lib/catalogue'

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
    a: 'A study app for students taking the IB Diploma, made by students for students. It lays out every topic and subtopic of your course, works out which parts you are weak on by testing you, builds your study plan, and gives you Syllabi, an AI tutor that marks drafts and turns your notes into flashcards. Built in Muscat, Oman by an IB Diploma student.',
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
    a: `The syllabus is mapped for the IB Diploma across ${coursesIn('IB')} courses, listed in full on the Subjects page, with A-Levels and AP to follow. Question coverage is still being built and is deeper in some subjects than others, which the app tells you rather than hides.`,
  },
  {
    q: 'How do school codes work, and what stops one leaking?',
    a: 'A school buys one code for a year group and students type it in once. Each code has a redemption limit, so it cannot quietly become a public unlock, and no card is involved for the student.',
  },
  {
    q: 'What is Syllabi?',
    a: 'The AI tutor inside the app, on Premium. Ask it about anything on your course, send photos, PDFs or links, get your IA, EE, TOK and Paper 1 and 2 answers marked on the criteria, and turn your notes into flashcards. It coaches rather than writes: it will not do your coursework for you.',
  },
  {
    q: 'What does it cost?',
    a: 'One subject is free, for good, with no card. Basic opens every subject you take; Premium adds Syllabi and the subject map. Yearly plans cost ten months for twelve. If your school or a friend gave you a code, it can open Premium for a while or for good.',
  },
  {
    q: 'Who made it?',
    a: 'Students. It started as one IB Diploma student’s answer to revision apps that ask you how confident you feel, and it is built with feedback from classmates sitting the same exams. That is also why the prices are what a student can actually say yes to.',
  },
]

export const ANSWERS = [
  {
    them: 'Notes and questions generated in bulk and never checked',
    us: 'Every question is solved from scratch twice, by a different model that never sees the intended answer. Disagreements are thrown away before anyone sits them.',
  },
  {
    them: 'An AI explanation that contradicts your textbook',
    us: 'Each wrong option carries the specific mistake that leads there, written with the question and checked with it, so the first explanation you see was checked, not improvised.',
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
    detail: [
      'A level is a running total of evidence, not a count of attempts. Every question carries a difficulty, that difficulty is banded into five heat levels, and the heat decides what a correct answer is worth — half a point for recall and one step, a point and a half at the hardest end of the paper. Ten points is mastery. Below five you are Weak, five to seven Developing, seven to nine Proficient, nine and above Mastered.',
      'Which means an easy run cannot reach the top. Ten of the simplest questions is five points, and five points is Developing. The only route into the highest band is questions that were genuinely hard for you, which is the whole reason the engine prices by heat instead of counting right answers. A subtopic nobody has asked you about stays grey rather than green, because zero points and never attempted are the same state and deserve the same colour.',
    ],
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
    detail: [
      'Fading is measured from your last correct answer, not from the last time the row was touched. That distinction matters: any quiz on a subtopic updates it, including one where every answer was wrong, so without the rule a fading topic could be cleared by sitting a quiz and failing it. Retention has to be re-proved, not revisited.',
      'Fourteen days without a correct answer and a subtopic starts fading. Twenty-one days after that — five weeks in total — it stops counting as known and returns to Weak. Only Mastered and Proficient fade, because something you never proved cannot quietly un-prove itself. One correct answer clears the whole thing, however long it has been.',
    ],
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
    detail: [
      'Every question you get wrong is kept against the subtopic it came from and returned to you on a widening gap: after a day, then five days, then a week. Answer it correctly each time and it leaves the bank for good. Get it wrong once and the schedule restarts from the beginning, because a question you have just missed is not one you nearly know.',
      'The questions come back inside ordinary sessions rather than as a separate chore, so revision and review are the same act. The bank only ever holds questions you actually attempted — it is a record of the mistakes you made, not a model of the mistakes you might make.',
    ],
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
    detail: [
      'You can assemble a paper from any combination of topics, or sit the structure your subject actually examines — Paper 1 and Paper 2, in their real shape. The clock runs against the pace the paper needs and shows marks per minute as you go, so you discover you are running slow during the paper, which is when it can still be fixed, rather than at the end.',
      'Everything a paper produces feeds the same map as a single quiz, so sitting one is not a side activity that leaves your levels untouched. The limit is honest: a generated paper is built to the shape of a real one. It is not a past paper, and nothing here is scraped from one.',
    ],
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
    detail: [
      'Put in your tests, your mocks and your IA deadlines, and the plan starts bending toward them. As a date gets closer that subject carries more weight in the ordering, so the evening tilts toward what is being examined soonest without you sitting down to re-plan it yourself.',
      "A deadline changes the priority of a line but never hides the reasoning behind it — every item still states why it is on the list, so you can disagree with it. It does not read your school's calendar or your inbox. What is in it is what you put in it.",
    ],
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
    detail: [
      'The timer starts once and follows you between pages, recording time against the subjects you actually worked on rather than the one you had open when you started. At the end of an evening there is a single number for whether that evening happened.',
      'It measures effort and only effort. Time in a session never moves a subtopic up a level — only questions do that. This is deliberate, because hours logged is the easiest number in studying to inflate, and a tool that rewarded sitting still would be measuring the wrong thing.',
    ],
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
    label: 'Prediction',
    detail: [
      'The predicted grade is a running total built only from quiz results. Nothing you tell it about yourself feeds in, because a prediction assembled partly from self-assessment is a prediction of your mood.',
      'It also states how much of your syllabus it rests on, which is the part most predictions leave out. Three quizzes is labelled low confidence rather than dressed up as a forecast, and the number moves as the coverage grows. It measures the evidence you have produced so far. It is not a forecast of results day.',
    ],
    title: 'A grade you can check the maths on',
    lede: 'A running total built only from results, stated with its own confidence.',
    how: [
      'A running total built only from quiz results',
      'States how much of your syllabus it rests on',
      'Three quizzes is labelled low confidence, not a forecast',
    ],
    limit: 'It predicts from what you have been tested on here. It is a measurement of your evidence so far, not a forecast of results day.',
  },
  {
    label: 'Syllabi',
    detail: [
      'Syllabi is a tutor that has your course in front of it: your subjects, your topics and the subtopic you are on. Ask it anything, send a photo of a question you are stuck on, a page of your notes or a link, and it explains the way your exam expects, then asks you something back to check it landed.',
      'It is a coach, not a ghostwriter. It will not write your IA, essay or coursework, and it says so. Every request goes through daily limits and checks before it reaches the model, which is how a student project can offer it at all.',
    ],
    title: 'A tutor that knows your syllabus',
    lede: 'Questions, photos, PDFs and links, answered for your course.',
    how: [
      'Knows your subject, topic and subtopic',
      'Reads photos, PDFs and web pages you send it',
      'Explains, then checks you understood',
    ],
    limit: 'It can be wrong, like any AI, and it never writes coursework for you. Premium only, with a daily allowance.',
  },
  {
    label: 'Marking',
    detail: [
      'Paste a draft of your IA, Extended Essay or TOK essay, or a Paper 1 or Paper 2 answer with its question, and Syllabi marks it against the published criteria for that piece: a mark per criterion, what earned it, and what the next band would need.',
      'Your own sentences are highlighted where they help or hurt, and every marking is kept, so you can see a draft improve from one version to the next.',
    ],
    title: 'Drafts and answers, marked',
    lede: 'Criterion by criterion, with your own sentences highlighted.',
    how: [
      'IA, EE, TOK, and Paper 1 and 2 answers',
      'A mark and a reason for every criterion',
      'Every version kept, so you can see the change',
    ],
    limit: 'An estimate from the criteria, not your teacher’s mark or the IB’s. Use it to improve a draft, not to predict a result.',
  },
  {
    label: 'Cards',
    detail: [
      'Upload up to three photos of handwritten notes, PDFs or text files, or paste your notes, and Syllabi writes flashcards from exactly what is in them: definitions, facts, formulas, steps. Nothing it was not given.',
      'The cards land in a list to check first. Edit any of them, untick the ones you do not want, then keep the rest. Your own cards are studied whenever you like, the ones you know least first.',
    ],
    title: 'Your notes, as flashcards',
    lede: 'Photos, PDFs or pasted notes in; cards you can check out.',
    how: [
      'Photos of handwriting, PDFs and text files',
      'Only what is in your notes, nothing invented',
      'Checked and edited by you before they are kept',
    ],
    limit: 'Blurry photos make thin cards. Pasting “term: definition” lines works for free without Syllabi.',
  },
  {
    label: 'Streaks',
    detail: [
      'Set a daily goal in minutes and keep a streak. Any study counts towards the streak, a quiz or the timer, and rest days on your plan never break it. The goal is what a good day looks like, not the price of keeping the streak.',
      'The analytics page shows the rest: time by subject, a week to a year at a time, your accuracy over time and by subject, when in the week you study best, how long your focus sessions run, and what you have covered subtopic by subtopic.',
    ],
    title: 'Streaks, goals and the whole picture',
    lede: 'A reason to come back tomorrow, and a page that shows where the time went.',
    how: [
      'A daily goal and a streak you can see everywhere',
      'Time by subject, accuracy, best study times',
      'Week, month, three months, six months, a year',
    ],
    limit: 'Time is counted from quizzes and the study timer. Reading a textbook with the timer off is invisible to it.',
  },
]
