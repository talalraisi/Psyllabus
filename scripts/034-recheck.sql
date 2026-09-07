-- Track which questions have been independently re-checked.
--
-- A recheck pass over 10,000 questions takes a while and costs money, so it
-- has to be resumable: killing it and starting again tomorrow should carry on
-- rather than pay for the first half twice. The column is the bookmark.
--
-- Separate from `verified`, which says the question survived the checks made
-- when it was generated. This says a *different* model, that did not write it,
-- solved it from scratch and got the same answer. Those are different claims
-- and collapsing them into one column would lose the distinction that matters.

BEGIN;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS rechecked_at timestamptz,
  -- What the independent solve produced when it disagreed. Kept so a human
  -- reviewing the flagged pile can see the disagreement rather than just being
  -- told there was one.
  ADD COLUMN IF NOT EXISTS recheck_note text;

CREATE INDEX IF NOT EXISTS questions_needs_recheck
  ON questions (subject) WHERE rechecked_at IS NULL;

COMMENT ON COLUMN questions.rechecked_at IS
  'When an independent model last solved this from scratch and agreed.';
COMMENT ON COLUMN questions.recheck_note IS
  'The disagreement, when there was one. Null means it agreed.';

COMMIT;
