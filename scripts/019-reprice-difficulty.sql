-- Re-price the difficulty bands.
--
--   easy    0.25 -> 0.5
--   medium  0.5  -> 0.75
--   hard    1    -> 1.25
--
-- The gap between an easy and a hard question narrows from 4x to 2.5x. Credits
-- already earned are re-priced rather than left at the old rate, otherwise two
-- students who answered the same questions would sit at different levels
-- depending on when they did it.

BEGIN;

UPDATE mastery_credits c
SET points = CASE
  WHEN coalesce(q.difficulty, 0.5) <= 0.35 THEN 0.5
  WHEN coalesce(q.difficulty, 0.5) <= 0.65 THEN 0.75
  ELSE 1.25
END
FROM questions q
WHERE q.id = c.question_id;

WITH totals AS (
  SELECT user_id, subject, subtopic, sum(points) AS pts
  FROM mastery_credits GROUP BY 1, 2, 3
)
UPDATE progress p
SET mastery_points = t.pts,
    status = CASE
      WHEN t.pts >= 9 THEN 'mastered'
      WHEN t.pts >= 7 THEN 'proficient'
      WHEN t.pts >= 5 THEN 'confident'
      WHEN t.pts > 0 THEN 'in_progress'
      ELSE 'not_started'
    END
FROM totals t
WHERE p.user_id = t.user_id AND p.subject = t.subject AND p.subtopic = t.subtopic;

COMMIT;
