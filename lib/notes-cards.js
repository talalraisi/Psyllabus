/**
 * What Syllabi is told, and must answer in, when it turns a student's notes
 * into flashcards (app/api/syllabi/cards). Kept here so the route and its
 * test use exactly the same thing.
 */

export const MAX_CARDS = 40

export const CARDS_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
        },
        required: ['front', 'back'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
  },
  required: ['cards', 'note'],
  additionalProperties: false,
}

export const cardsSystem = ({ curriculum, subject, subtopic }) =>
  `You turn a ${curriculum || 'high school'} student's own study notes for ${subject}${subtopic ? ` (${subtopic})` : ''} into flashcards.

Rules:
- Use only what is in the notes. Never add facts the notes do not contain. If a photo or page is unreadable, skip it.
- One idea per card. The front is a short, specific question or prompt; the back is the answer in at most 50 words.
- Prefer what is examinable: definitions, key facts, formulas, steps of a process, causes and effects, comparisons, named examples.
- Write maths with $...$ for inline LaTeX.
- Write the cards in the language the notes are written in.
- At most ${MAX_CARDS} cards. Fewer good cards beat many thin ones. No duplicates.
- "note": one short sentence for the student about what you made, or why there were no cards (for example, the notes were not readable or not study notes).`
