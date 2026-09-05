-- Questions you type an answer to, rather than pick one.
--
-- Multiple choice is guessable and, for maths and the sciences, tests
-- recognition rather than the thing being examined. "Give the value of x" is
-- both a better test and still machine-markable, which matters because mastery
-- points must never come from a student marking their own work.
--
-- Deliberately narrow. Only answers a machine can mark objectively live here:
-- a number, or a short phrase from a known set. Extended writing is a
-- different problem and does not belong in the points ladder.

BEGIN;

-- Every accepted form of the answer, so "0.5", ".5" and "1/2" all pass where
-- the setter says they should.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS accepted_answers jsonb;

-- numeric  compared as a number, within answer_tolerance
-- text     compared as normalised text against accepted_answers
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer_kind text
  CHECK (answer_kind IN ('numeric', 'text'));

-- Relative tolerance for numeric answers, so 9.81 accepts 9.8 without
-- accepting 9. Null falls back to the app default.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer_tolerance numeric;

-- Shown under the box, e.g. "to 3 significant figures" or "in m/s".
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer_hint text;

-- Existing rows are all multiple choice and stay that way.
UPDATE questions SET question_type = 'mcq' WHERE question_type IS NULL;

CREATE INDEX IF NOT EXISTS questions_type_idx ON questions (subject, subtopic, question_type);

COMMIT;
