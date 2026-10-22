/**
 * What the writers are told.
 *
 * Everything that is the same across a subject goes first, so prompt caching
 * charges it once: the rules, the subject's paper formats and its examples.
 * The guide section and the list of slots to fill come last.
 *
 * The rules are the ones the first generator learned the hard way (see
 * scripts/generate-questions.mjs): exactly the data needed, the answer is
 * what the numbers produce, exactly one true option, a hint that is not the
 * answer. They are restated rather than imported because that file runs on
 * import.
 */

import { GROUPS, HEAT_WORDS, HEAT_DIFFICULTY } from './formats.mjs'

const ANGLES = [
  'state or define the key idea precisely',
  'apply it to a routine case with given values',
  'work backwards from a result to a missing input',
  'combine it with something from an earlier topic',
  'interpret data from a table or graph',
  'spot the error in a worked attempt',
  'decide which method applies',
  'apply it to an unfamiliar real-world context',
  'compare two cases',
  'handle a limiting or special case',
]

export const RULES = `You write exam questions for the IB Diploma Programme. They must be correct, belong to the subtopic you are given, and read like questions from a real IB paper.

STYLE OF THE REAL PAPERS
- Use IB command terms exactly (State, Identify, Outline, Calculate, Determine, Explain, Deduce, Estimate, Show that...). The marks must match the demand of the command term.
- Multiple choice is ALWAYS worth 1 mark, with exactly 4 options (a-d) and exactly one correct.
- Use SI units and IB notation (m s^-1, not m/s). Write powers plainly (x^2, 10^-3) and wrap other maths in single dollars: $\\frac{a}{b}$, $\\sqrt{2}$, $\\Delta$. Never put a currency amount inside dollars.
- Write every question fresh. Match the style, structure and difficulty of IB questions, but never copy or reword a specific past-paper question.

CORRECTNESS
- Work every question out fully before writing the answer or the options.
- GIVE EXACTLY THE DATA NEEDED. Extra quantities that do not agree with each other let two correct methods reach two different answers.
- THE ANSWER IS WHAT YOUR NUMBERS PRODUCE, not a remembered textbook value.
- EXACTLY ONE OPTION IS TRUE. The other three must be false, not merely "less good". When options are formulas, three must be formulas that do not hold.
- Never ask about an error that is not there.

FEEDBACK (a student sees this the moment they get it wrong)
- Every wrong option: why_wrong names the specific mistake that produces exactly that option. Recompute it: if the mistake does not give that value, change the option. No vague or invented mistakes, and no option that gives itself away by its units or size.
- Every typed-answer question: 2 or 3 wrong_answers a student would really type, each produced by a named mistake.
- accepted_answers holds only the correct value in different forms (2.5, 2.50) or spellings. Where IB accepts the value with or without its sign (an elasticity, a change described as a fall), list both signs. Never a different value, and never the value in other units (no "60 kJ" for 60000 J).
- hint: one sentence pointing at the method, never the answer.
- explanation: the worked solution with the key steps.
- markscheme on EVERY question, even 1 mark: the command term and one specific point per mark, M1/A1 where that is the convention.

FIGURES
Most questions need none: write exactly "none". Add one only when the question cannot be asked without it, written as JSON in one of these shapes (every figure has "alt", a full description for a screen reader):
- table, for data-based questions: {"kind":"table","alt":"...","columns":["t / s","v / m s^-1"],"rows":[["0","0.0"],["2","4.1"]]}
- plot (a relationship) or scatter (measurements): {"kind":"plot","alt":"...","x_label":"t / s","y_label":"v / m s^-1","points":[{"x":0,"y":0},{"x":2,"y":4}]}
- bar, for categories: {"kind":"bar","alt":"...","y_label":"...","bars":[{"label":"A","value":3}]}
- circuit: {"kind":"circuit","alt":"...","source":"12 V","series":[{"type":"resistor","label":"R1 = 2.0 Ω"}],"parallel":[[{"type":"resistor","label":"R2 = 6.0 Ω"}],[{"type":"lamp","label":""}]]}
  component types: resistor, lamp, ammeter, voltmeter, switch, variable_resistor, thermistor, ldr, diode, cell. parallel is [] for a plain series circuit, otherwise 2 or 3 branches.
- forces: {"kind":"forces","alt":"...","surface":"incline","angle_deg":30,"body":"block","forces":[{"label":"W","direction_deg":270,"size":1},{"label":"N","direction_deg":60,"size":0.87}]}
  surface: none, horizontal or incline; body: block, ball or point; direction_deg anticlockwise from the positive x axis (0 right, 90 up, 270 down); size 0.3 to 1, in proportion to the forces.
Every value the question needs must agree between the stem and the figure, and the answer must never be on the figure. The stem refers to it ("The diagram shows...").`

export function subjectBlock(subject, group) {
  const g = GROUPS[group]
  return `SUBJECT: IB ${subject}

FORMATS FOR THIS SUBJECT
${g.formats}

ORIGINAL EXAMPLES IN THE STYLE WANTED (not to be reused)
${g.examples}`
}

/**
 * The slots one request fills: a heat, a type and an angle each. Types are
 * mixed to the subject's multiple-choice share; Extremely hot and Burning are
 * always typed, because one mark cannot carry a question that hard.
 */
export function slotsFor(heats, group, offset = 0) {
  const g = GROUPS[group]
  const slots = []
  let i = 0
  for (const heat of ['low', 'medium', 'hot', 'extreme', 'burning']) {
    for (let k = 0; k < (heats[heat] || 0); k++, i++) {
      const hard = heat === 'extreme' || heat === 'burning'
      const mcq = !hard && ((i * 7 + offset) % 100) / 100 < g.mcqShare
      slots.push({
        slot: slots.length + 1,
        heat,
        difficulty: HEAT_DIFFICULTY[heat],
        type: mcq ? 'mcq' : 'short_answer',
        angle: ANGLES[(i + offset) % ANGLES.length],
      })
    }
  }
  return slots
}

export function questionPrompt({ topic, subtopic, guide, slots, avoid = [], neighbours = [] }) {
  const lines = slots.map(
    (s) => `${s.slot}. ${HEAT_WORDS[s.heat]} Type: ${s.type === 'mcq' ? 'multiple choice' : 'typed answer'}. Angle: ${s.angle}.`
  )
  return `TOPIC: ${topic}
SUBTOPIC: ${subtopic}

${guide ? `WHAT THE IB GUIDE SAYS STUDENTS MUST UNDERSTAND (write to this, and nothing outside it):\n${guide}` : 'The guide section was not found: keep strictly to what this subtopic name covers in the IB course.'}
${neighbours.length ? `\nTHE GUIDE SECTION COVERS A WHOLE UNIT; YOURS IS ONLY "${subtopic}". These neighbouring subtopics have their own questions, so none of them may be the main thing a question tests (a hard question may use one as a single step on the way): ${neighbours.join('; ')}.\n` : ''}
HEAT, exactly as defined here (a question one level easier than its slot is a failure):
${Object.values(HEAT_WORDS).join('\n')}
Calibration, from reviewing earlier questions: rearranging one equation to find the unknown is Medium, not Low. Two separate calculations whose results are combined are Medium at least. A standard three-step calculation is Hot, not Extremely hot. Extremely hot must combine two parts of the syllabus or need set-up before calculating. Burning needs a genuine trap or insight, not just more steps.

Write exactly ${slots.length} questions, one for each slot below, in this order. Each question's heat must be the heat of its slot: a Low question a revised student gets every time, a Burning question that only the best can do.

${lines.join('\n')}${avoid.length ? `\n\nAlready written for this subtopic, so do not repeat or reword these:\n${avoid.map((s) => `- ${s}`).join('\n')}` : ''}`
}

export function lessonPrompt({ subject, topic, subtopic, guide, neighbours = [] }) {
  return `Write an interactive lesson for IB ${subject}, ${topic}, subtopic "${subtopic}".

${guide ? `WHAT THE IB GUIDE SAYS STUDENTS MUST UNDERSTAND:\n${guide}` : 'Keep strictly to what this subtopic covers in the IB course.'}
${neighbours.length ? `\nTHE GUIDE SECTION COVERS A WHOLE UNIT; THIS LESSON IS ONLY "${subtopic}". Teach only the guide statements that belong to it. These neighbouring subtopics have lessons of their own, so do not teach them (mention one in a sentence only where this subtopic needs it): ${neighbours.join('; ')}.\n` : ''}
The lesson takes about 10 minutes and teaches a student who has not met this before up to IB standard.
- intro: two sentences on what this is and why it matters.
- 3 to 5 sections, each one idea, 80-180 words, building on the last. Each section ends with one quick check question with feedback for right and wrong.
- Figures: when the subtopic has a diagram or graph students are expected to draw or read (most science, maths and economics subtopics do: a free-body diagram, a circuit, a graph of the relationship, a data table), at least one section must include it, in the figure shapes given. A section's figure is "none" otherwise.
- worked_example: one IB-style problem solved step by step.
- mistakes: 2-4 common mistakes, each with the fix.
- key_terms: the terms a student must be able to define.
- A section's check may use that section's figure. Never refer to a table, graph or diagram that is not given as that section's figure.
- outcomes, "What you should know now": 3-5 statements written as IB command terms ("Calculate...", "Explain why..."), together covering the guide statements that belong to this subtopic, each with one check question that tests exactly that statement. Outcome checks have no figure, so they must be complete in their own words.
- cards: 15-30 flashcards covering the key terms, definitions, equations and facts of this subtopic only.

Check questions follow the question rules: correct, exactly one true option, accepted answers only the correct value, feedback that teaches.`
}

export function blindPrompt(items) {
  return `Solve each question independently. Multiple choice: give the option letter only. Typed answer: give the bare number (no unit) or the single term. If a question is ambiguous, has no correct answer or more than one, set confident to false.
Then say how many distinct steps your solution took, rate its heat by these definitions, and where a list of subtopics is given, put the one it mainly tests in "tests" (word for word), otherwise leave it empty:
${Object.values(HEAT_WORDS).join('\n')}

${items
  .map((it) => {
    const q = it.q
    const parts = [`[${it.id}] ${q.stem}`]
    if (q.stimulus) parts.push(`Context: ${q.stimulus}`)
    if (q.figure && q.figure.kind !== 'none') parts.push(`Figure (${q.figure.kind}): ${JSON.stringify(q.figure)}`)
    if (q.type === 'mcq') for (const o of q.options) parts.push(`  ${o.id}) ${o.text}`)
    else if (q.answer_hint) parts.push(`  (answer ${q.answer_hint})`)
    if (it.choices?.length > 1) parts.push(`  Which of these does it mainly test? ${it.choices.map((c) => `"${c}"`).join(', ')}`)
    return parts.join('\n')
  })
  .join('\n\n')}`
}

/* -------------------------------------------------------- lessons, v2 --- */

const FRAME_SHAPES = `FRAMES, one idea each, 14 to 22 of them. Each has a type, a title, short text (at most 60 words; never a wall of text), optional bullet points (revealed one by one), a figure ("none" or JSON in the figure shapes) and data (JSON for its type, or "{}"):
- explain: plain teaching, short.
- key_point: the thing they must remember ("Need to know"). text only.
- note: a useful side note or exam tip.
- analogy: "Think of it like..." an everyday comparison that makes it click.
- diagram: the figure does the teaching; text is its caption. Required whenever the subtopic has a diagram or graph students draw or read.
- formula: data {"expression":"$E_k = \\\\frac{1}{2}mv^2$","symbols":[{"symbol":"E_k","meaning":"kinetic energy","unit":"J"}]}
- example: data {"problem":"...","steps":["...","..."],"answer":"..."} — revealed step by step.
- mistake: data {"wrong":"what students write","right":"what is correct","why":"why the wrong one is wrong"}
- reveal: predict-then-look. data {"items":[{"prompt":"What happens if...?","answer":"..."}]} (1 to 3 items)
- cards: data {"cards":[{"front":"...","back":"..."}]} (3 to 5 flip cards on what was just taught)
- check: data is one interaction, with "right" and "wrong" feedback that teaches:
  {"kind":"mcq","prompt":"...","options":[{"id":"a","text":"...","why":"why it is wrong, empty if correct"}],"answer":"b","right":"...","wrong":"..."}
  {"kind":"truefalse","statement":"...","answer":true,"right":"...","wrong":"..."}
  {"kind":"match","prompt":"Match each ... to ...","pairs":[{"left":"...","right":"..."}],"right":"...","wrong":"..."} (3 to 5 pairs)
  {"kind":"order","prompt":"Put these steps in order","items":["first","second","third"],"right":"...","wrong":"..."} (3 to 6, given in the correct order)
  {"kind":"sort","prompt":"Sort these into...","groups":[{"name":"Scalar","items":["speed","mass"]},{"name":"Vector","items":["velocity","force"]}],"right":"...","wrong":"..."} (2 groups, 4 to 8 items)
  {"kind":"gap","prompt":"Fill the gaps","text":"Displacement is a ___ quantity; distance is a ___ quantity.","answers":["vector","scalar"],"bank":["vector","scalar","derived"],"right":"...","wrong":"..."}
  {"kind":"numeric","prompt":"...","answer":"9.9","accepted":["9.9","9.90"],"unit":"m s^-1","right":"...","wrong":"..."}
  {"kind":"short","prompt":"...","accepted":["..."],"right":"...","wrong":"..."}

THE SHAPE OF A GOOD LESSON: explain or analogy first, then alternate teaching frames and checks so the student does something every two or three screens. Use at least one analogy, one key_point, one example, one mistake, one cards frame, and checks of at least three different kinds (not only mcq). Include a formula frame for every equation the subtopic uses, and a diagram frame whenever it has a diagram or graph. Teach to IB standard; keep every frame short.`

export function lessonPrompt2({ subject, topic, subtopic, guide, neighbours = [] }) {
  return `Write an interactive lesson for IB ${subject}, ${topic}, subtopic "${subtopic}". It is a sequence of short screens a student moves through, not an article.

${guide ? `WHAT THE IB GUIDE SAYS STUDENTS MUST UNDERSTAND:\n${guide}` : 'Keep strictly to what this subtopic covers in the IB course.'}
${neighbours.length ? `\nTHE GUIDE SECTION COVERS A WHOLE UNIT; THIS LESSON IS ONLY "${subtopic}". Teach only the guide statements that belong to it. These neighbouring subtopics have lessons of their own: ${neighbours.join('; ')}.\n` : ''}
- hook: one line that makes a student curious.
- overview: why it matters, and 3 to 5 things they will be able to do.

${FRAME_SHAPES}

- outcomes, "What you should know now": 3 to 5 statements in IB command-term language covering this subtopic's guide statements, each with one check (mcq, truefalse, numeric or short) that tests exactly it and needs no figure.
- key_terms: the terms they must be able to define.
- cards: 12 to 20 flashcards for the deck, covering this subtopic only.

Every check is correct, with exactly one right answer where there is one, and feedback that teaches. Never refer to a table, graph or diagram that is not the frame's own figure.`
}
