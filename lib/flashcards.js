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

/**
 * A missed card goes back into this session, after the time the student picks.
 *
 * In minutes, not in cards. "In 4 cards" told them exactly when to expect it,
 * which turned the second attempt into waiting for a card rather than
 * recalling one; a time is how spacing is meant to work, and nobody counts
 * the seconds. The card waits (holdCard) and comes back as the next card
 * once its time has passed (releaseDue).
 *
 * The box is left where scheduleAfter put it: this is about the session,
 * the box is about the weeks after it.
 */
export const AGAIN_CHOICES = [
  { key: '1m', label: '1 minute', minutes: 1 },
  { key: '5m', label: '5 minutes', minutes: 5 },
  { key: '10m', label: '10 minutes', minutes: 10 },
  { key: '1h', label: '1 hour', minutes: 60 },
]

/** Hold a missed card until its time. Soonest first. */
export function holdCard(waiting, card, choice = AGAIN_CHOICES[1], now = Date.now()) {
  return [...waiting, { card, at: now + choice.minutes * 60000 }].sort((a, b) => a.at - b.at)
}

/**
 * Cards whose time has come go in straight after position `index`, soonest
 * first. Returns the new queue, what is still waiting, and how many went in.
 */
export function releaseDue(queue, index, waiting, now = Date.now()) {
  const due = waiting.filter((w) => w.at <= now)
  if (!due.length) return { queue, waiting, added: 0 }
  const next = [...queue]
  next.splice(index + 1, 0, ...due.map((w) => w.card))
  return { queue: next, waiting: waiting.filter((w) => w.at > now), added: due.length }
}

/** "0:42", "4:05", "59 min": how long until the next card comes back. */
export function untilLabel(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s >= 600) return `${Math.ceil(s / 60)} min`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * A fresh order for a round. Never starts with the card the last round
 * ended on, so the seam between two rounds does not show the same card twice.
 */
export function shuffleCards(cards, avoidFirst = null, rand = Math.random) {
  const out = [...cards]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  if (avoidFirst && out.length > 1 && out[0] === avoidFirst) {
    ;[out[0], out[1]] = [out[1], out[0]]
  }
  return out
}

/** How well a card is known, from its box, in words. */
export function levelOf(card) {
  const b = card?.box || 0
  return b === 0 ? 'New' : b <= 2 ? 'Learning' : b <= 4 ? 'Familiar' : 'Known'
}

/** The cards to study first: least known first, mixed within each level. */
export function studyOrder(cards, limit = 30) {
  return [...cards]
    .map((c) => ({ c, k: (c.box || 0) + Math.random() * 0.9 }))
    .sort((a, b) => a.k - b.k)
    .slice(0, limit)
    .map((x) => x.c)
}

/**
 * Is this card due? `now` is a timestamp in milliseconds, and anything else
 * (an array index, when this is handed straight to .filter) means "now".
 * It used to take the index as the time, so `cards.filter(isDue)` found
 * nothing due, ever, and the page said so.
 */
export function isDue(card, now) {
  const at = typeof now === 'number' && now > 1e12 ? now : Date.now()
  return new Date(card.due_at).getTime() <= at
}

/** "In 3 days", "Due now". */
export function dueLabel(card, now) {
  const ms = new Date(card.due_at).getTime() - (typeof now === 'number' && now > 1e12 ? now : Date.now())
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
