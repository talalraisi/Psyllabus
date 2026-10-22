-- Duplicate detection for questions in any script.
--
-- The fingerprint (006) kept only a-z and 0-9, so a question in Arabic
-- fingerprinted as the empty string, every Arabic question in a subject
-- collided with the first, and only that one could be saved. French and
-- Spanish lost every accented letter. It now removes punctuation and
-- spacing instead, and keeps letters in any script.

BEGIN;

DROP INDEX IF EXISTS idx_questions_unique_stem;
ALTER TABLE questions DROP COLUMN IF EXISTS stem_fingerprint;
ALTER TABLE questions
  ADD COLUMN stem_fingerprint text
  GENERATED ALWAYS AS (
    md5(btrim(regexp_replace(lower(stem), '[[:punct:][:space:]]+', ' ', 'g')))
  ) STORED;
CREATE UNIQUE INDEX idx_questions_unique_stem ON questions (subject, stem_fingerprint);

COMMIT;
