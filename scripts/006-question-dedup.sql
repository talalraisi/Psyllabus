-- Guarantees the question bank never contains duplicate questions, so students
-- never see the same question twice while unseen ones remain.
-- Run in the Supabase SQL editor after 004-quiz-engine.sql.

BEGIN;

-- Normalized fingerprint of the question text: lowercase, collapse whitespace,
-- strip punctuation. Catches near-duplicates that differ only in formatting.
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS stem_fingerprint text
  GENERATED ALWAYS AS (
    md5(
      regexp_replace(
        regexp_replace(lower(stem), '[^a-z0-9 ]', '', 'g'),
        '\s+', ' ', 'g'
      )
    )
  ) STORED;

-- Remove any existing duplicates (keep the oldest of each group) before the
-- unique index is applied.
DELETE FROM questions q
USING questions keep
WHERE q.subject = keep.subject
  AND q.stem_fingerprint = keep.stem_fingerprint
  AND q.created_at > keep.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_unique_stem
  ON questions (subject, stem_fingerprint);

-- Fast lookup of "questions this user has already answered", used to serve
-- unseen questions first.
CREATE INDEX IF NOT EXISTS idx_question_responses_question
  ON question_responses (question_id);

COMMIT;
