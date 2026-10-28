-- How a predicted paper was sat: in exam conditions against the clock, timed
-- by the student on a stopwatch, or with no clock at all. Reading a paper
-- (questions and markscheme, nothing answered) makes no attempt.

BEGIN;

ALTER TABLE paper_attempts
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'exam'
  CHECK (mode IN ('exam', 'stopwatch', 'practice'));

COMMIT;
