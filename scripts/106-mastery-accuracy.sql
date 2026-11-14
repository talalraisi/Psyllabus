-- Wrong answers count.
--
-- Mastery was a running total of points from right answers, so wrong answers
-- changed nothing: 8 right out of 30 could read Mastered, and a subtopic
-- answered all wrong read Untested. Points still get you to a level; your
-- recent accuracy in that subtopic now has to hold it (lib/progress.js
-- capByAccuracy):
--
--   recent       the last 12 answers in the subtopic
--   once there are 5 or more of them:
--     Mastered     needs 75% of them right
--     Proficient   needs 60%
--     Developing   needs 40%
--     below that   Weak
--   answered, but no points    Weak, not Untested
--
-- progress also keeps what the level rests on (answered, recent_correct,
-- recent_total), which the app shows as low / medium / high confidence.
-- subtopic_accuracy() is what the quiz reads after each attempt. It returns
-- counts for the signed-in student only.

BEGIN;

ALTER TABLE progress ADD COLUMN IF NOT EXISTS answered int NOT NULL DEFAULT 0;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS recent_correct int NOT NULL DEFAULT 0;
ALTER TABLE progress ADD COLUMN IF NOT EXISTS recent_total int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_question_responses_question ON question_responses (question_id);

CREATE OR REPLACE FUNCTION public.subtopic_accuracy(p_subject text, p_subtopics text[])
RETURNS TABLE (
  subtopic text,
  answered integer,
  recent_correct integer,
  recent_total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH r AS (
    SELECT q.subtopic, r.is_correct,
           row_number() OVER (PARTITION BY q.subtopic ORDER BY r.created_at DESC, r.id) AS n
    FROM question_responses r
    JOIN quiz_attempts a ON a.id = r.attempt_id
    JOIN questions q ON q.id = r.question_id
    WHERE a.user_id = auth.uid()
      AND q.subject = p_subject
      AND q.subtopic = ANY (p_subtopics)
  )
  SELECT r.subtopic,
         count(*)::int,
         count(*) FILTER (WHERE r.n <= 12 AND r.is_correct)::int,
         count(*) FILTER (WHERE r.n <= 12)::int
  FROM r
  GROUP BY r.subtopic;
$$;

REVOKE ALL ON FUNCTION public.subtopic_accuracy(text, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.subtopic_accuracy(text, text[]) TO authenticated;

-- Restate every row: what it rests on, then its level, the same way the quiz
-- now does. Points are untouched.
WITH ranked AS (
  SELECT a.user_id, q.subject, q.subtopic, r.is_correct,
         row_number() OVER (PARTITION BY a.user_id, q.subject, q.subtopic
                            ORDER BY r.created_at DESC, r.id) AS n
  FROM question_responses r
  JOIN quiz_attempts a ON a.id = r.attempt_id
  JOIN questions q ON q.id = r.question_id
),
ev AS (
  SELECT user_id, subject, subtopic,
         count(*)::int AS answered,
         count(*) FILTER (WHERE n <= 12 AND is_correct)::int AS rc,
         count(*) FILTER (WHERE n <= 12)::int AS rt
  FROM ranked
  GROUP BY 1, 2, 3
),
bank AS (
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
  SELECT p.user_id, p.subject, p.subtopic, coalesce(p.mastery_points, 0) AS pts,
         round(least(8, greatest(3, coalesce(b.available, 7.5) * 0.8)) * 4) / 4 AS target,
         coalesce(e.answered, 0) AS answered,
         coalesce(e.rc, 0) AS rc,
         coalesce(e.rt, 0) AS rt
  FROM progress p
  LEFT JOIN bank b ON b.subject = p.subject AND b.subtopic = p.subtopic
  LEFT JOIN ev e ON e.user_id = p.user_id AND e.subject = p.subject AND e.subtopic = p.subtopic
),
earned AS (
  SELECT *,
         CASE
           WHEN pts <= 0 THEN 'not_started'
           WHEN pts >= target THEN 'mastered'
           WHEN pts >= round(target * 0.75 * 4) / 4 THEN 'proficient'
           WHEN pts >= round(target * 0.45 * 4) / 4 THEN 'confident'
           ELSE 'in_progress'
         END AS base,
         CASE WHEN rt > 0 THEN rc::numeric / rt ELSE 0 END AS acc
  FROM lines
)
UPDATE progress p
SET answered = e.answered,
    recent_correct = e.rc,
    recent_total = e.rt,
    status = CASE
      WHEN e.base = 'not_started' THEN CASE WHEN e.answered > 0 THEN 'in_progress' ELSE 'not_started' END
      WHEN e.base = 'in_progress' OR e.rt < 5 THEN e.base
      WHEN e.base = 'mastered' AND e.acc >= 0.75 THEN 'mastered'
      WHEN e.base IN ('mastered', 'proficient') AND e.acc >= 0.6 THEN 'proficient'
      WHEN e.acc >= 0.4 THEN 'confident'
      ELSE 'in_progress'
    END
FROM earned e
WHERE p.user_id = e.user_id AND p.subject = e.subject AND p.subtopic = e.subtopic;

COMMIT;
