-- Which individual subtopics have questions behind them.
--
-- `subject_coverage` answers "is there anything in this subject", which is
-- what the subject picker needs. The planner needs the finer question: can a
-- student actually sit a quiz on THIS subtopic. Without it the plan ranks by
-- pedagogy alone and recommends whatever is most urgent to learn, which on a
-- bank covering 21 of 113 Economics subtopics is almost always something with
-- no questions in it. The dashboard's one call to action then lands on
-- "Questions coming soon", which is the worst first minute the app has.
--
-- Counts only, and only verified questions, so it exposes nothing a SELECT on
-- the questions table would not. One row per covered subtopic rather than one
-- per question, so it stays small as the bank grows.

BEGIN;

CREATE OR REPLACE FUNCTION public.subtopic_coverage()
RETURNS TABLE (
  subject text,
  subtopic text,
  questions integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT q.subject, q.subtopic, count(*)::int
  FROM questions q
  WHERE q.verified
  GROUP BY q.subject, q.subtopic;
$$;

REVOKE ALL ON FUNCTION public.subtopic_coverage() FROM public;
GRANT EXECUTE ON FUNCTION public.subtopic_coverage() TO authenticated;

COMMIT;
