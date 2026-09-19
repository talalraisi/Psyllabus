-- What earns the marks, in the examiner's words.
--
-- A multiple choice question is right or wrong and an explanation is enough.
-- A six-mark question in history or economics is neither: it is a list of
-- points, each worth something, and the difference between a 4 and a 6 is
-- knowing which ones were missing. Telling a student "the answer is the
-- Keynesian multiplier" after a question like that teaches nothing.
--
-- So questions can carry a mark scheme: the points available, what each is
-- worth, and the command term the question is answering. Stored as JSON
-- because the shape differs by subject — a language paper marks on criteria
-- bands, a science on specific statements — and pretending otherwise would
-- mean inventing a table that fits neither.
--
-- Shape:
--   {
--     "command_term": "Explain",
--     "points": [{ "point": "...", "marks": 1 }, ...],
--     "guidance": "optional note about what examiners accept"
--   }

BEGIN;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS markscheme jsonb;

COMMENT ON COLUMN questions.markscheme IS
  'Marking points for written answers: {command_term, points:[{point, marks}], guidance}.';

-- Which questions have one, for the generator to top up later.
CREATE INDEX IF NOT EXISTS idx_questions_markscheme_missing
  ON questions (subject)
  WHERE markscheme IS NULL AND question_type <> 'mcq';

COMMIT;
