-- Mastery earned in points, not in percentages.
--
-- Status used to come from accuracy on a single quiz, so five correct easy
-- questions read as Mastered. That is not mastery, it is five easy questions.
--
-- A subtopic is now worth 20 points, earned across every attempt:
--
--   easy    0.25
--   medium  0.5
--   hard    1
--
--   under 10   Weak
--   under 15   Developing
--   under 18   Proficient
--   18 and up  Mastered
--
-- Points come only from correct answers, and only the first time a given
-- question is answered correctly. Without that, the same easy question answered
-- eighty times would reach Mastered, which is the original bug wearing a
-- different hat.

BEGIN;

ALTER TABLE progress ADD COLUMN IF NOT EXISTS mastery_points numeric(6,2) NOT NULL DEFAULT 0;

-- Which questions have already paid out, so points cannot be farmed by
-- repeating one question. Kept separate from question_responses because that
-- table records every attempt, including the repeats.
CREATE TABLE IF NOT EXISTS mastery_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  subject text NOT NULL,
  subtopic text NOT NULL,
  points numeric(4,2) NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS mastery_credits_lookup
  ON mastery_credits (user_id, subject, subtopic);

ALTER TABLE mastery_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own credits" ON mastery_credits;
CREATE POLICY "Students read own credits" ON mastery_credits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students earn own credits" ON mastery_credits;
CREATE POLICY "Students earn own credits" ON mastery_credits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Backfill from answers already given, so nobody loses work they have done.
-- Difficulty is stored as a number, so it is banded here the same way the app
-- bands it: <= 0.35 easy, <= 0.65 medium, above that hard.
-- ---------------------------------------------------------------------------

INSERT INTO mastery_credits (user_id, question_id, subject, subtopic, points, earned_at)
SELECT DISTINCT ON (a.user_id, r.question_id)
  a.user_id,
  r.question_id,
  q.subject,
  q.subtopic,
  CASE
    WHEN coalesce(q.difficulty, 0.5) <= 0.35 THEN 0.25
    WHEN coalesce(q.difficulty, 0.5) <= 0.65 THEN 0.5
    ELSE 1
  END,
  r.created_at
FROM question_responses r
JOIN quiz_attempts a ON a.id = r.attempt_id
JOIN questions q ON q.id = r.question_id
WHERE r.is_correct
ORDER BY a.user_id, r.question_id, r.created_at
ON CONFLICT (user_id, question_id) DO NOTHING;

-- Roll the credits up onto progress, and restate every status from points.
WITH totals AS (
  SELECT user_id, subject, subtopic, sum(points) AS pts
  FROM mastery_credits GROUP BY 1, 2, 3
)
UPDATE progress p
SET mastery_points = t.pts,
    status = CASE
      WHEN t.pts >= 18 THEN 'mastered'
      WHEN t.pts >= 15 THEN 'proficient'
      WHEN t.pts >= 10 THEN 'confident'
      ELSE 'in_progress'
    END
FROM totals t
WHERE p.user_id = t.user_id AND p.subject = t.subject AND p.subtopic = t.subtopic;

COMMIT;
