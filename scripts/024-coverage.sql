-- What your class has covered, separately from what you have proven.
--
-- Everything in the product was gated behind quiz results, so a new student
-- opened a grey screen and had to grind before anything worked at all. That is
-- a brutal first day, and it also assumes a student wants to spend most of
-- their time being tested. Plenty do not.
--
-- Coverage is a different claim from competence. "We did this in class" is a
-- fact about the course; "I know this" is an opinion about yourself, and the
-- second one is the thing this product refuses to accept. Tracking the first
-- costs nothing in honesty and gives the app a job from the first minute.
--
-- The gap between the two is the useful part: taught but unproven is exactly
-- what a student should be testing, and never-taught is not their fault yet.

BEGIN;

ALTER TABLE progress ADD COLUMN IF NOT EXISTS covered boolean NOT NULL DEFAULT false;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS covered_at timestamptz;

CREATE INDEX IF NOT EXISTS progress_covered_idx
  ON progress (user_id, subject) WHERE covered;

COMMIT;
