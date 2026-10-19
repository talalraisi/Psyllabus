/**
 * Spotting tests in a student's own calendar.
 *
 * Kept apart from lib/ics.js so the calendar page can use it in the browser
 * without shipping the iCalendar parser to every student. Tested with the
 * reader in scripts/ics-test.mjs.
 */

/**
 * Does an imported event look like a test the plan should prepare for?
 *
 * Matches the words schools use — test, quiz, exam, mock, assessment, paper —
 * as whole words, so "Contest" and "testimony" do not count, and names the
 * student's subject when the title mentions it. Only ever a suggestion: the
 * student confirms before anything is added.
 */
const TEST_WORDS = /\b(tests?|quiz(?:zes)?|exams?|mocks?|assessments?|unit\s+tests?|paper\s*[123]|finals?|midterms?)\b/i
const NOT_TESTS = /\b(test\s*drive|driving\s*test|covid|pcr|blood\s*test|eye\s*test)\b/i

export function looksLikeTest(event, subjects = []) {
  if (!event?.title || !TEST_WORDS.test(event.title) || NOT_TESTS.test(event.title)) return null
  const kind = /\bmocks?\b/i.test(event.title) ? 'mock' : 'test'
  // Students abbreviate: "Econ mock", "Maths quiz", "Phys test". A title word
  // of four letters or more that begins a subject's word, or that the subject
  // word begins, names it — "econ" → Economics HL, "maths" → Math Analysis.
  const said = event.title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4)
  const subject =
    subjects.find((s) =>
      s
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 4)
        .some((w) => said.some((t) => w.startsWith(t) || t.startsWith(w)))
    ) || null
  return { kind, subject }
}
