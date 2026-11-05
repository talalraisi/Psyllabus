-- Mastered within reach.
--
-- At 10 points (Mastered from 9) only about a quarter of IB subtopics had
-- enough questions to be mastered at all, so a student could answer every
-- question in a subtopic correctly and still see Proficient. The line is now
-- per subtopic (lib/progress.js masteryTarget): 80% of what its questions are
-- worth, capped at 8 and never under 3. The other levels are shares of it:
--
--   Mastered     the line
--   Proficient   75% of it
--   Developing   45% of it
--   Weak         anything above 0
--
-- The quiz writes new statuses this way from now on; this restates every
-- existing row against the new lines, from the points already earned.
-- Points are untouched. A question's worth follows its heat, as in
-- pointsForQuestion: 0.5, 0.75, 1, 1.25, 1.5.

BEGIN;

WITH bank AS (
  SELECT subject, subtopic,
         sum(CASE
               WHEN coalesce(difficulty, 0.5) <= 0.3 THEN 0.5
               WHEN coalesce(difficulty, 0.5) <= 0.5 THEN 0.75
               WHEN coalesce(difficulty, 0.5) <= 0.68 THEN 1
               WHEN coalesce(difficulty, 0.5) <= 0.82 THEN 1.25
               ELSE 1.5
             END) AS available
  FROM questions
  WHERE verified
  GROUP BY 1, 2
),
lines AS (
  SELECT p.user_id, p.subject, p.subtopic, p.mastery_points AS pts,
         round(least(8, greatest(3, coalesce(b.available, 7.5) * 0.8)) * 4) / 4 AS target
  FROM progress p
  LEFT JOIN bank b ON b.subject = p.subject AND b.subtopic = p.subtopic
  WHERE p.mastery_points IS NOT NULL
)
UPDATE progress p
SET status = CASE
  WHEN l.pts <= 0 THEN 'not_started'
  WHEN l.pts >= l.target THEN 'mastered'
  WHEN l.pts >= round(l.target * 0.75 * 4) / 4 THEN 'proficient'
  WHEN l.pts >= round(l.target * 0.45 * 4) / 4 THEN 'confident'
  ELSE 'in_progress'
END
FROM lines l
WHERE p.user_id = l.user_id AND p.subject = l.subject AND p.subtopic = l.subtopic;

COMMIT;
