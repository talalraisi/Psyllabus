-- Short answer questions have no options.
--
-- questions.options was NOT NULL from when every question was multiple choice.
-- The first short answer batch generated fine, passed verification, and then
-- failed at the insert, so a whole batch of model time was thrown away for a
-- column constraint.

BEGIN;

ALTER TABLE questions ALTER COLUMN options DROP NOT NULL;

-- Multiple choice still must have them.
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_mcq_needs_options;
ALTER TABLE questions ADD CONSTRAINT questions_mcq_needs_options
  CHECK (question_type <> 'mcq' OR options IS NOT NULL);

-- And a typed answer must have something to mark against.
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_short_needs_answers;
ALTER TABLE questions ADD CONSTRAINT questions_short_needs_answers
  CHECK (question_type <> 'short_answer' OR accepted_answers IS NOT NULL);

COMMIT;
