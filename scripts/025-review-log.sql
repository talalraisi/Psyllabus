-- Studying without being tested.
--
-- A student who spends an hour on a subtopic has done something real, and the
-- app had nowhere to put it: the only way to interact with a subtopic was to
-- answer questions about it. That makes the product useless when the bank is
-- thin, and tiring even when it is not.
--
-- Logging review is deliberately weaker than testing:
--
--   it lowers the item's priority in the planner, because you have just been
--   there and grinding it again today is not the best use of an hour
--
--   it does NOT change the level, and it does NOT clear Fading
--
-- That second rule is the whole point. Fading means "you proved this once and
-- have not proved it since", and self-reported review is not proof. Letting it
-- clear the fade would put self-assessment back into the heatmap through a side
-- door, which is the one thing this product refuses to do.

BEGIN;

ALTER TABLE progress ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS review_minutes int NOT NULL DEFAULT 0;

COMMIT;
