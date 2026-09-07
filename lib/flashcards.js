/**
 * Flashcard scheduling, and where cards come from.
 *
 * A Leitner box system rather than the mistake bank's fixed ladder, because
 * cards are self-marked. Getting one right moves it up a box and further away;
 * getting it wrong sends it back to the start. Nothing here touches mastery
 * points, and that separation is deliberate: mastery is evidence, and a card
 * you marked yourself is not evidence.
 */

/** Days until a card in each box comes back. */
export const BOXES = [0, 1, 3, 7, 16, 35]

export const MAX_BOX = BOXES.length - 1

export function scheduleAfter(card, correct) {
  const box = correct ? Math.min(MAX_BOX, (card.box || 0) + 1) : 0
  const days = BOXES[box]
  return {
    box,
    due_at: new Date(Date.now() + days * 86400000).toISOString(),
    last_reviewed_at: new Date().toISOString(),
    reviews: (card.reviews || 0) + 1,
    lapses: (card.lapses || 0) + (correct ? 0 : 1),
    updated_at: new Date().toISOString(),
  }
}

export function isDue(card, now = Date.now()) {
  return new Date(card.due_at).getTime() <= now
}

/** "In 3 days", "Due now". */
export function dueLabel(card, now = Date.now()) {
  const ms = new Date(card.due_at).getTime() - now
  if (ms <= 0) return 'Due now'
  const days = Math.ceil(ms / 86400000)
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

/* -------------------------------------------------------------------------- *
 * Generating cards from what already exists
 * -------------------------------------------------------------------------- */

/**
 * Turn a note into cards.
 *
 * Splits on the shapes people actually write notes in, rather than trying to
 * understand the text:
 *
 *   Term: definition          one card
 *   Term - definition         one card
 *   Q: something / A: answer  one card
 *   ## Heading + lines        heading is the prompt, body the answer
 *
 * Anything it cannot read confidently is left alone. A wrong card is worse
 * than a missing one, because the student will sit there trying to recall
 * something the app invented.
 */
export function cardsFromNote(note) {
  const lines = String(note?.body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const cards = []
  let heading = null
  let buffer = []

  const flushHeading = () => {
    if (heading && buffer.length) {
      cards.push({ front: heading, back: buffer.join(' ') })
    }
    heading = null
    buffer = []
  }

  for (const line of lines) {
    // Markdown-ish heading starts a new card.
    const h = line.match(/^#{1,4}\s+(.+)$/)
    if (h) {
      flushHeading()
      heading = h[1].trim()
      continue
    }

    // Explicit question and answer.
    const q = line.match(/^Q[:.]\s*(.+)$/i)
    if (q) {
      flushHeading()
      heading = q[1].trim()
      continue
    }
    const a = line.match(/^A[:.]\s*(.+)$/i)
    if (a && heading) {
      cards.push({ front: heading, back: a[1].trim() })
      heading = null
      continue
    }

    // Term: definition, or Term - definition. The left side has to be short or
    // every sentence containing a colon becomes a card, and it must not end in
    // sentence punctuation, which marks it as prose rather than a term.
    const pair = line.match(/^(.{3,60}?)\s*[:–—-]\s+(.{3,})$/)
    if (pair && !/[.!?]$/.test(pair[1])) {
      // A definition line ends whatever heading was being collected, rather
      // than being swallowed into it. Without this, a note that opens with a
      // heading turns its whole body into one enormous card.
      flushHeading()
      cards.push({ front: pair[1].trim(), back: pair[2].trim() })
      continue
    }

    if (heading) buffer.push(line)
  }

  flushHeading()

  return cards
    .filter((c) => c.front.length > 2 && c.back.length > 2)
    .map((c) => ({
      ...c,
      subject: note.subject,
      topic: note.topic,
      subtopic: note.subtopic,
      source: 'note',
      source_id: note.id,
    }))
}

/**
 * A question already answered is a card that was sitting there.
 * The prompt is the question, the back is the answer plus the explanation.
 */
export function cardFromQuestion(question) {
  if (!question?.stem) return null

  const answer =
    question.question_type === 'short_answer'
      ? (question.accepted_answers || [])[0]
      : (question.options || []).find((o) => o.id === question.correct_answer)?.text

  if (!answer) return null

  return {
    front: question.stem,
    back: [answer, question.explanation].filter(Boolean).join('\n\n'),
    subject: question.subject,
    topic: question.topic,
    subtopic: question.subtopic,
    source: 'question',
    source_id: question.id,
  }
}
