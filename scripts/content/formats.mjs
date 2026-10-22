/**
 * What each subject's questions look like, how many there are, and who
 * writes them.
 *
 * HEAT. Every question is written to a heat chosen before it is written
 * (lib/progress.js: Low, Medium, Hot, Extremely hot, Burning), because models
 * asked for "a mix" rate everything hard. The heat also decides the writer:
 *
 *   Low, Medium              Haiku           recall, one or two steps
 *   Hot                      Sonnet, medium  multi-step, method not obvious
 *   Extremely hot, Burning   Sonnet, normal  combines ideas, separates grades
 *
 * FORMATS follow the real papers. IB multiple choice is always one mark, and
 * only the sciences sit multiple-choice papers: Economics, Maths and the
 * humanities have none, so their "IB-style" questions are structured,
 * data-response or short typed answers. Multiple choice still appears for
 * them at Low heat, as recall practice, which is what it is good for.
 *
 * EXAMPLES are original, written for this file in the style of each paper.
 * They are never copied from past papers; the prompt says the same.
 */

/* Difficulty number written for each heat: the middle of its range. */
export const HEAT_DIFFICULTY = { low: 0.18, medium: 0.42, hot: 0.6, extreme: 0.75, burning: 0.9 }

export const TIER_OF_HEAT = { low: 'basic', medium: 'basic', hot: 'middle', extreme: 'hard', burning: 'hard' }

export const TIERS = {
  basic: { model: 'claude-haiku-5-5', effort: null, label: 'claude-haiku-5-5' },
  middle: { model: 'claude-sonnet-5-5', effort: 'medium', label: 'claude-sonnet-5-5/medium' },
  hard: { model: 'claude-sonnet-5-5', effort: null, label: 'claude-sonnet-5-5/normal' },
}

export const HEAT_WORDS = {
  low: 'Low: one step. Recall a fact or definition, or put numbers straight into one equation as given. A student who has revised gets it every time.',
  medium: 'Medium: two steps, or one equation that has to be rearranged, or one value read from a graph or table and used. The wording points to the method.',
  hot: 'Hot: three or more steps, or two steps where the student must choose the method because the wording does not point to it, or data that must be processed first (an area under a graph, a chain of conversions).',
  extreme: 'Extremely hot: needs ideas from two parts of the syllabus together, or an unfamiliar situation that must be set up before anything can be calculated; four or more steps.',
  burning: 'Burning: everything Extremely hot asks, plus a trap or a genuine insight. The last part of the hardest Paper 2 question; the one that separates a 6 from a 7. Rare.',
}

export const HEAT_ORDER = ['low', 'medium', 'hot', 'extreme', 'burning']

const SCIENCE_EXAMPLES = `EXAMPLE 1 (multiple choice, Paper 1 style, 1 mark, Medium)
A trolley of mass 0.80 kg moves at 3.0 m s^-1 and collides with a stationary trolley of mass 1.2 kg. The trolleys stick together. What is their speed after the collision?
a) 1.2 m s^-1 (correct)
b) 2.0 m s^-1 — divided the momentum by the second trolley's mass only
c) 1.8 m s^-1 — scaled the speed by 1.2/2.0 instead of 0.80/2.0
d) 3.0 m s^-1 — assumed the first trolley keeps its speed
Markscheme: 1 mark for (a). Momentum before = 0.80 × 3.0 = 2.4 N s; after, 2.4 / 2.0 = 1.2 m s^-1.

EXAMPLE 2 (typed answer, Paper 2 style, 2 marks, Hot)
A lamp is rated 6.0 V, 3.0 W. It is connected in series with a resistor to a 9.0 V supply of negligible internal resistance, and works at its rated power. Calculate the resistance of the resistor.
Accepted: 6.0 Ω. Hint: find the current the lamp draws first.
Markscheme (Calculate): current = P/V = 0.50 A ✓ (M1); resistor p.d. = 3.0 V so R = 3.0/0.50 = 6.0 Ω ✓ (A1).
Wrong typed answers: "12" — divided 6.0 V by the current, using the lamp's p.d. instead of the resistor's; "18" — used the whole 9.0 V.

EXAMPLE 3 (typed answer, data-based, 3 marks, Extremely hot)
Figure: a table of the temperature of 0.25 kg of water every 60 s for 300 s while a 50 W immersion heater is switched on; over the 300 s the temperature rises by 9.1 °C.
Determine the fraction of the heater's energy that is transferred to the water. Specific heat capacity of water = 4200 J kg^-1 K^-1.
Markscheme (Determine): energy supplied = 50 × 300 = 15 000 J (M1); energy to water = 0.25 × 4200 × 9.1 = 9555 J (M1); fraction = 0.64 (A1). Accept 0.63–0.64.`

const HUMANITIES_EXAMPLES = `EXAMPLE 1 (typed answer, data-response style, 2 marks, Medium)
Stimulus: when the price of a good rose from $8 to $10, quantity demanded fell from 500 to 450 units a week.
Calculate the price elasticity of demand.
Accepted: -0.4, 0.4. Markscheme (Calculate): %ΔQd = -10% and %ΔP = +25% (M1); PED = -0.4 (A1). Accept 0.4 if described as inelastic.
Wrong typed answers: "-2.5" — divided %ΔP by %ΔQd, the ratio the wrong way round.

EXAMPLE 2 (multiple choice, recall, 1 mark, Low)
Which of the following is a characteristic of a public good?
a) It is non-rivalrous and non-excludable (correct)
b) It is provided only by the government — confuses who provides it with what it is
c) It has positive externalities of consumption — that is a merit good
d) It is rivalrous but non-excludable — that describes a common-pool resource

EXAMPLE 3 (typed answer, application, 2 marks, Hot)
A government imposes a specific tax of $2 per unit. The price paid by consumers rises from $10 to $11.50 and the quantity traded falls from 1000 to 800 units. Calculate the tax burden on producers.
Accepted: 400. Markscheme (Calculate): producers receive $9.50, so the burden per unit is $0.50 (M1); 0.50 × 800 = $400 (A1).`

const MATHS_EXAMPLES = `EXAMPLE 1 (typed answer, Paper 1 style, no calculator, 2 marks, Medium)
The first term of an arithmetic sequence is 7 and the fifth term is 23. Find the sum of the first 10 terms.
Accepted: 250. Markscheme (Find): d = 4 (A1); S10 = 10/2 (14 + 9 × 4) = 250 (A1).
Wrong typed answers: "214" — found d by dividing 16 by 5 instead of 4.

EXAMPLE 2 (typed answer, Paper 2 style, GDC allowed, 3 marks, Hot)
The function f(x) = 3x e^(-0.5x), x ≥ 0, has a maximum at P. Find the coordinates of P.
Accepted: (2, 2.21). Markscheme (Find): attempt to differentiate using the product rule (M1); f'(x) = 0 gives x = 2 (A1); y = 6e^-1 = 2.21 (A1).

EXAMPLE 3 (multiple choice, recall practice, 1 mark, Low)
Which expression is equal to log_2(8x^3)?
a) 3 + 3 log_2 x (correct)
b) 3 log_2 x — forgot the log of 8
c) 8 + 3 log_2 x — took 8 rather than log_2 8
d) 3 log_2(8x) — took the power over the whole bracket`

const LANGUAGE_EXAMPLES = `EXAMPLE 1 (multiple choice, 1 mark, Low)
Which literary device is used in "the classroom was a zoo"?
a) Metaphor (correct)
b) Simile — a simile needs "like" or "as"
c) Personification — nothing non-human is given human qualities
d) Hyperbole — it is a comparison rather than an exaggeration of degree

EXAMPLE 2 (typed answer, 1 mark, Medium)
Stimulus: a short original extract.
Identify the narrative perspective used in the extract.
Accepted: first person, first-person narrator.`

export const GROUPS = {
  sciences: {
    match: /^(Physics|Chemistry|Biology|Sports, Exercise|Design Technology|Computer Science|Environmental)/,
    perSubtopic: 30,
    heat: { low: 0.3, medium: 0.3, hot: 0.25, extreme: 0.1, burning: 0.05 },
    mcqShare: 0.5,
    formats:
      'Multiple choice in the style of Paper 1 (always 1 mark, 4 options). Typed answers in the style of Paper 1B and Paper 2: numeric answers with units, or a single named term, 1-4 marks. Data-based questions give their data as a table or graph figure.',
    examples: SCIENCE_EXAMPLES,
  },
  maths: {
    match: /^Math/,
    perSubtopic: 35,
    heat: { low: 0.2, medium: 0.25, hot: 0.4, extreme: 0.1, burning: 0.05 },
    mcqShare: 0.15,
    formats:
      'IB Mathematics has no multiple-choice papers, so typed answers are the norm: Paper 1 style (no calculator, exact answers) and Paper 2 style (GDC allowed, 3 significant figures), 1-5 marks. Multiple choice only at Low heat, for recall practice.',
    examples: MATHS_EXAMPLES,
  },
  humanities: {
    match: /^(Economics|Business|Geography|History|Psychology|Global Politics|Social and Cultural|Digital Society|Philosophy|World Religions)/,
    perSubtopic: 18,
    heat: { low: 0.35, medium: 0.32, hot: 0.2, extreme: 0.09, burning: 0.04 },
    mcqShare: 0.35,
    formats:
      'These subjects have no multiple-choice papers. Typed answers in the style of the data-response and short-answer parts of the papers: a calculation from given data, a single term, or a value read from a diagram, 1-4 marks. Multiple choice for recall and concepts at Low and Medium heat only.',
    examples: HUMANITIES_EXAMPLES,
  },
  languages: {
    // "English A: Literature SL", "Arabic B HL", "Spanish ab initio SL".
    match: / A:| B (SL|HL)$| B$| ab initio|^Classical|^Literature and Performance/,
    perSubtopic: 12,
    heat: { low: 0.45, medium: 0.35, hot: 0.15, extreme: 0.05, burning: 0 },
    mcqShare: 0.6,
    formats:
      'Terminology, techniques, grammar and vocabulary, and comprehension of short ORIGINAL extracts you write yourself (never quote a published text). Typed answers are a single word or short phrase.',
    examples: LANGUAGE_EXAMPLES,
  },
  arts: {
    match: /^(Visual Arts|Music|Film|Theatre|Dance)/,
    perSubtopic: 5,
    heat: { low: 0.6, medium: 0.4, hot: 0, extreme: 0, burning: 0 },
    mcqShare: 0.7,
    formats: 'Terminology, conventions and context. Assessment is coursework, so keep to knowledge questions.',
    examples: LANGUAGE_EXAMPLES,
  },
}

export function groupOf(subject) {
  return Object.entries(GROUPS).find(([, g]) => g.match.test(subject))?.[0] || 'humanities'
}

/**
 * How many questions each subtopic gets, at each heat.
 *
 * Weighted by the guide's teaching hours: a section's hours are shared among
 * its subtopics, and a subtopic with more hours behind it gets more
 * questions, between 0.6x and 1.6x the subject's base. Without hours, every
 * subtopic gets the base.
 */
export function planCounts(subtopics, group, scale = 1) {
  const g = GROUPS[group]
  const share = subtopics.map((s) => (s.hours && s.siblings ? s.hours / s.siblings : null))
  const known = share.filter(Boolean)
  const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null
  const order = ['low', 'medium', 'hot', 'extreme', 'burning']
  return subtopics.map((s, i) => {
    const weight = share[i] && mean ? Math.min(1.6, Math.max(0.6, share[i] / mean)) : 1
    const total = Math.max(3, Math.round(g.perSubtopic * weight * scale))
    // Largest remainder, so the mix holds at any size: rounding each heat up
    // on its own turned a 15-question subtopic a fifth hardest-tier.
    const exact = order.map((h) => total * (g.heat[h] || 0))
    const heats = Object.fromEntries(order.map((h, k) => [h, Math.floor(exact[k])]))
    let left = total - Object.values(heats).reduce((a, b) => a + b, 0)
    const byRemainder = order.map((h, k) => [h, exact[k] - Math.floor(exact[k])]).sort((a, b) => b[1] - a[1])
    for (const [h] of byRemainder) {
      if (left <= 0) break
      if (g.heat[h]) {
        heats[h]++
        left--
      }
    }
    // Every subtopic big enough for it gets at least one Hot question.
    if (total >= 6 && g.heat.hot && !heats.hot) {
      heats.hot = 1
      heats.low--
    }
    return { ...s, total, heats }
  })
}
