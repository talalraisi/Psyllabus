-- Mastery at 10 points, and a fade that means something.
--
-- 20 points was roughly 36 questions answered correctly at the generator's
-- intended difficulty mix, which is a lot of work before a subtopic ever turns
-- purple. 10 is about 18, which a student can reach in a couple of sessions
-- and which the question bank can actually supply.
--
--   under 5   Weak
--   under 7   Developing
--   under 9   Proficient
--   9 and up  Mastered
--
-- Decay had a hole. It measured from progress.updated_at, which is bumped by
-- any quiz touching the subtopic, including one where every answer was wrong.
-- So a Fading subtopic could be cleared by sitting a quiz and failing it.
-- Fading now clears only on a correct answer, tracked separately.

BEGIN;

-- The last time this subtopic was actually got right. Null means never, and
-- decay leaves those alone because there is nothing to fade.
ALTER TABLE progress ADD COLUMN IF NOT EXISTS last_correct_at timestamptz;

-- Seed it from the credits, which only exist for correct answers.
WITH latest AS (
  SELECT user_id, subject, subtopic, max(earned_at) AS at
  FROM mastery_credits GROUP BY 1, 2, 3
)
UPDATE progress p
SET last_correct_at = latest.at
FROM latest
WHERE p.user_id = latest.user_id
  AND p.subject = latest.subject
  AND p.subtopic = latest.subtopic
  AND p.last_correct_at IS NULL;

-- Restate every status against the new thresholds.
UPDATE progress
SET status = CASE
  WHEN mastery_points >= 9 THEN 'mastered'
  WHEN mastery_points >= 7 THEN 'proficient'
  WHEN mastery_points >= 5 THEN 'confident'
  WHEN mastery_points > 0 THEN 'in_progress'
  ELSE 'not_started'
END
WHERE mastery_points IS NOT NULL;

COMMIT;
