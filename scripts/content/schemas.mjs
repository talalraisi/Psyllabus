/**
 * The shapes the writers must return. Structured output holds them to it, so
 * every question arrives with every field the app shows: heat, marks,
 * markscheme, feedback for each wrong option and each likely wrong typed
 * answer, hint and worked explanation.
 *
 * Fields that only apply to one type (options for multiple choice, accepted
 * answers for typed ones) are always present and left empty when they do not
 * apply, because a schema that changes shape by type is one models get wrong.
 */

/**
 * Figures travel as JSON text rather than as a schema of their own. Spelled
 * out as a schema inside every question and every lesson section, they made
 * the structured-output grammar too large for the API to compile. Their
 * shapes are in the prompt (prompts.mjs, FIGURE_SHAPES) and the code checks
 * parse and validate every one, so nothing is lost but a guarantee the checks
 * already give.
 */
export const FIGURE_TEXT = {
  type: 'string',
  description: 'The figure as JSON in one of the shapes given, or exactly "none".',
}

const MARKSCHEME = {
  type: 'object',
  additionalProperties: false,
  required: ['command_term', 'points', 'guidance'],
  properties: {
    command_term: { type: 'string', description: 'The IB command term: State, Identify, Calculate, Determine, Explain, Outline, Deduce...' },
    points: {
      type: 'array',
      description: 'One entry per mark, in the order an answer makes them, each a specific thing written or done. Label method marks M1 and answer marks A1 where that is the convention.',
      items: { type: 'object', additionalProperties: false, required: ['point', 'marks'], properties: { point: { type: 'string' }, marks: { type: 'integer', enum: [1] } } },
    },
    guidance: { type: 'string', description: 'What else is accepted, or a common answer that earns nothing. Empty if nothing to add.' },
  },
}

export const QUESTION = {
  type: 'object',
  additionalProperties: false,
  required: [
    'slot', 'heat', 'type', 'marks', 'stem', 'stimulus', 'figure', 'options', 'correct_answer',
    'accepted_answers', 'answer_kind', 'answer_hint', 'wrong_answers', 'hint', 'explanation', 'markscheme',
  ],
  properties: {
    slot: { type: 'integer', description: 'The number of the slot this question fills, from the list.' },
    heat: { type: 'string', enum: ['low', 'medium', 'hot', 'extreme', 'burning'] },
    type: { type: 'string', enum: ['mcq', 'short_answer'] },
    marks: { type: 'integer', description: 'Multiple choice is always 1.' },
    stem: { type: 'string' },
    stimulus: { type: 'string', description: 'Context or data the question is built on, or empty.' },
    figure: FIGURE_TEXT,
    options: {
      type: 'array',
      description: 'mcq: exactly 4, ids a-d. Empty for short_answer.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text', 'why_wrong'],
        properties: {
          id: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
          text: { type: 'string' },
          why_wrong: { type: 'string', description: 'The specific mistake that leads here. Empty for the correct option.' },
        },
      },
    },
    correct_answer: { type: 'string', description: 'mcq: the correct option id. short_answer: empty.' },
    accepted_answers: {
      type: 'array',
      items: { type: 'string' },
      description: 'short_answer: the correct answer first, then other forms of the SAME value or term (rounding variants, spellings). Never a different value. Empty for mcq.',
    },
    answer_kind: { type: 'string', enum: ['numeric', 'text', 'none'], description: 'none for mcq.' },
    answer_hint: { type: 'string', description: 'short_answer: unit and precision expected, e.g. "in m s^-1, to 2 significant figures". Empty for mcq.' },
    wrong_answers: {
      type: 'array',
      description: 'short_answer: 2 or 3 answers a student reaches by a specific mistake, each with the mistake named. Empty for mcq.',
      items: { type: 'object', additionalProperties: false, required: ['answer', 'feedback'], properties: { answer: { type: 'string' }, feedback: { type: 'string' } } },
    },
    hint: { type: 'string', description: 'One sentence pointing at the method. Never the answer or a number that gives it away.' },
    explanation: { type: 'string', description: 'The worked solution, showing the key steps.' },
    markscheme: MARKSCHEME,
  },
}

export const QUESTIONS = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: { questions: { type: 'array', items: QUESTION } },
}

/* --------------------------------------------------------------- lessons --- */

const CHECK = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'stem', 'options', 'correct_answer', 'accepted_answers', 'answer_kind', 'feedback_right', 'feedback_wrong'],
  properties: {
    type: { type: 'string', enum: ['mcq', 'short_answer'] },
    stem: { type: 'string' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text', 'why_wrong'],
        properties: { id: { type: 'string', enum: ['a', 'b', 'c', 'd'] }, text: { type: 'string' }, why_wrong: { type: 'string' } },
      },
    },
    correct_answer: { type: 'string' },
    accepted_answers: { type: 'array', items: { type: 'string' } },
    answer_kind: { type: 'string', enum: ['numeric', 'text', 'none'] },
    feedback_right: { type: 'string', description: 'One sentence on why it is right.' },
    feedback_wrong: { type: 'string', description: 'One or two sentences that teach the point again.' },
  },
}

export const LESSON = {
  type: 'object',
  additionalProperties: false,
  required: ['intro', 'minutes', 'sections', 'worked_example', 'mistakes', 'key_terms', 'outcomes', 'cards'],
  properties: {
    intro: { type: 'string', description: 'Two sentences: what this is and why it matters.' },
    minutes: { type: 'integer' },
    sections: {
      type: 'array',
      description: '3 to 5 short sections, each building on the last.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body', 'figure', 'check'],
        properties: {
          heading: { type: 'string' },
          body: { type: 'string', description: '80 to 180 words. Plain language, one idea, equations in $...$.' },
          figure: FIGURE_TEXT,
          check: CHECK,
        },
      },
    },
    worked_example: {
      type: 'object',
      additionalProperties: false,
      required: ['problem', 'steps', 'answer'],
      properties: { problem: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' } },
    },
    mistakes: { type: 'array', items: { type: 'string' }, description: '2 to 4 common mistakes, each with the fix.' },
    key_terms: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['term', 'definition'], properties: { term: { type: 'string' }, definition: { type: 'string' } } },
    },
    outcomes: {
      type: 'array',
      description: '"What you should know now": 3 to 5 statements in IB command-term language, each with one check question.',
      items: { type: 'object', additionalProperties: false, required: ['statement', 'check'], properties: { statement: { type: 'string' }, check: CHECK } },
    },
    cards: {
      type: 'array',
      description: 'Flashcards for this subtopic, for recall: key terms, definitions, equations with their symbols named, rules, facts. Never a problem to work out. Front a question or prompt, back the answer in under 40 words.',
      items: { type: 'object', additionalProperties: false, required: ['front', 'back'], properties: { front: { type: 'string' }, back: { type: 'string' } } },
    },
  },
}

/* ---------------------------------------------------------------- checks --- */

export const BLIND = {
  type: 'object',
  additionalProperties: false,
  required: ['answers'],
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'answer', 'confident', 'steps', 'heat', 'tests'],
        properties: {
          id: { type: 'string' },
          answer: { type: 'string', description: 'Option letter for multiple choice; the bare number or term for a typed answer.' },
          confident: { type: 'boolean', description: 'false if the question is ambiguous, has no answer, or more than one.' },
          steps: { type: 'integer' },
          heat: { type: 'string', enum: ['low', 'medium', 'hot', 'extreme', 'burning'] },
          tests: { type: 'string', description: 'The subtopic it mainly tests, from the list given, or empty.' },
        },
      },
    },
  },
}

/* -------------------------------------------------------- lessons, v2 --- */

/**
 * A lesson as frames, one idea a screen. The frame-specific parts travel as
 * JSON text (data, figure) for the same reason figures do: spelled out as a
 * schema for every kind of frame, the grammar would be too large to compile.
 * The shapes are in the prompt and every one is validated in code.
 */
export const LESSON2 = {
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'overview', 'frames', 'outcomes', 'key_terms', 'cards'],
  properties: {
    hook: { type: 'string', description: 'One line that makes a student want to know this.' },
    overview: {
      type: 'object',
      additionalProperties: false,
      required: ['why', 'learn', 'minutes'],
      properties: {
        why: { type: 'string', description: 'Two sentences: why this matters, in the exam and outside it.' },
        learn: { type: 'array', items: { type: 'string' }, description: '3 to 5 things the student will be able to do by the end.' },
        minutes: { type: 'integer' },
      },
    },
    frames: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'text', 'points', 'figure', 'data'],
        properties: {
          type: { type: 'string', enum: ['explain', 'key_point', 'note', 'analogy', 'diagram', 'formula', 'example', 'mistake', 'reveal', 'cards', 'check'] },
          title: { type: 'string' },
          text: { type: 'string', description: 'At most 60 words.' },
          points: { type: 'array', items: { type: 'string' }, description: 'Short bullet lines, revealed one at a time. Empty if none.' },
          figure: { type: 'string', description: 'A figure as JSON in the shapes given, or "none".' },
          data: { type: 'string', description: 'JSON for this frame type, as given, or "{}".' },
        },
      },
    },
    outcomes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['statement', 'check'],
        properties: { statement: { type: 'string' }, check: { type: 'string', description: 'A check as JSON (mcq, truefalse, numeric or short).' } },
      },
    },
    key_terms: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['term', 'definition'], properties: { term: { type: 'string' }, definition: { type: 'string' } } },
    },
    cards: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['front', 'back'], properties: { front: { type: 'string' }, back: { type: 'string' } } },
    },
  },
}

/* -------------------------------------------------------- lessons, v3 --- */

const BLOCK = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'title', 'text', 'points', 'figure', 'data'],
  properties: {
    type: { type: 'string', enum: ['explain', 'key_point', 'note', 'analogy', 'diagram', 'formula', 'example', 'mistake', 'reveal', 'cards', 'check'] },
    title: { type: 'string', description: 'A short heading for the block, or empty.' },
    text: { type: 'string' },
    points: { type: 'array', items: { type: 'string' } },
    figure: { type: 'string', description: 'A figure as JSON in the shapes given, or "none".' },
    data: { type: 'string', description: 'JSON for this block type, as given, or "{}".' },
  },
}

/** A lesson as a few full screens, each several blocks deep. */
export const LESSON3 = {
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'overview', 'screens', 'outcomes', 'key_terms', 'cards'],
  properties: {
    hook: LESSON2.properties.hook,
    overview: LESSON2.properties.overview,
    screens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'blocks'],
        properties: { title: { type: 'string' }, blocks: { type: 'array', items: BLOCK } },
      },
    },
    outcomes: LESSON2.properties.outcomes,
    key_terms: LESSON2.properties.key_terms,
    cards: LESSON2.properties.cards,
  },
}
