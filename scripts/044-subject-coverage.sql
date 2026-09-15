-- How much of each subject actually has questions in it.
--
-- 166 of 173 subjects have none at all. A student picking their six from a
-- list that looks identical for every subject will pick four empty ones and
-- conclude the product is broken, which — for those four — it effectively is.
--
-- Counting this from the client would mean fetching every question row to
-- length them. One function, one round trip, no rows.
--
-- It is SECURITY DEFINER over a table whose RLS already says verified
-- questions are readable by anyone signed in, so it exposes nothing that a
-- SELECT would not. It returns counts only: no stems, no answers.

BEGIN;

CREATE OR REPLACE FUNCTION public.subject_coverage()
RETURNS TABLE (
  subject text,
  subtopics integer,
  covered integer,
  questions integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.subject,
         count(DISTINCT s.subtopic)::int,
         count(DISTINCT q.subtopic) FILTER (WHERE q.verified)::int,
         count(q.id) FILTER (WHERE q.verified)::int
  FROM syllabus_content s
  LEFT JOIN questions q
    ON q.subject = s.subject AND q.subtopic = s.subtopic
  GROUP BY s.subject;
$$;

REVOKE ALL ON FUNCTION public.subject_coverage() FROM public;
GRANT EXECUTE ON FUNCTION public.subject_coverage() TO authenticated;

COMMIT;
