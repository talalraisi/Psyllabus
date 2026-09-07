-- Everything that belongs to a question, generated with it.
--
-- A hint, an explanation for each wrong option, and a figure are all things
-- the model already knows while it is writing the question and has to
-- reconstruct from scratch afterwards. Generating them in the same pass costs
-- a few hundred extra tokens; generating them later means reading every
-- question back, re-solving it, and paying for the whole thing twice.
--
-- It also means they cannot drift. A hint produced in a separate run can point
-- at a method the question does not use, because nothing forces the two to
-- agree. Written together, they are one object.
--
-- None of this needs an API at runtime. It is all written once at build time
-- and served from the row, which is the whole point: per-answer feedback that
-- costs nothing per student.

BEGIN;

ALTER TABLE questions
  -- One nudge toward the method, never the answer. Shown on request during a
  -- quiz, and asking for it is recorded so it can be worth fewer points later
  -- if that turns out to matter.
  ADD COLUMN IF NOT EXISTS hint text,

  -- Why each wrong option is wrong, keyed by option id: {"a": "...", "c": "..."}.
  -- This is the difference between "the answer was b" and "you picked c, which
  -- is what you get if you forget to convert to metres". The second one
  -- teaches; the first one just closes the loop.
  ADD COLUMN IF NOT EXISTS option_feedback jsonb,

  -- A diagram, graph or data table, stored as data rather than as an image:
  -- {"kind": "plot"|"bar"|"scatter"|"table", ...}. The app draws it, so it
  -- follows the theme, scales on a phone, and can be read by a screen reader.
  -- A model-authored SVG could do none of those and could not be checked.
  ADD COLUMN IF NOT EXISTS figure jsonb;

COMMENT ON COLUMN questions.hint IS
  'One nudge toward the method. Never contains the answer.';
COMMENT ON COLUMN questions.option_feedback IS
  'Per-option explanation of the mistake that leads there, keyed by option id.';
COMMENT ON COLUMN questions.figure IS
  'Structured figure data the app renders. Never raw SVG or an image URL.';

-- Finding questions that still need enriching, for a backfill pass over the
-- ones already generated.
CREATE INDEX IF NOT EXISTS questions_needs_enrich
  ON questions (subject, subtopic)
  WHERE hint IS NULL;

COMMIT;
