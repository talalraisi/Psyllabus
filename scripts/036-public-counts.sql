-- Let the homepage state a number that is actually true.
--
-- The homepage advertised "98 questions in the question bank" from a constant
-- in the source, updated by hand after a generation run. It said 98 while the
-- bank held 304. Understating is not a legal problem, but a number maintained
-- by remembering to maintain it will eventually overstate, and a marketing
-- claim that drifts away from the truth is exactly the kind of thing that has
-- to be defensible.
--
-- Reading the count directly is not possible: questions are readable only by
-- signed-in users, which is correct and should stay that way. So a function
-- returns the counts and nothing else. A total is not sensitive; the questions
-- behind it still are.

BEGIN;

CREATE OR REPLACE FUNCTION public_bank_counts()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'questions', (SELECT count(*) FROM questions WHERE verified),
    'subtopics', (SELECT count(*) FROM syllabus_content),
    'subjects',  (SELECT count(DISTINCT subject) FROM syllabus_content)
  );
$$;

REVOKE ALL ON FUNCTION public_bank_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_bank_counts() TO anon, authenticated;

COMMIT;
