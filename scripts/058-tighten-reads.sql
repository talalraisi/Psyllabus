-- Two reads that were open wider than anything needs.
--
-- syllabus_content was readable by anon. Nothing unauthenticated reads it: the
-- landing page gets its figures from the public_bank_counts RPC, which returns
-- totals, and every direct read is from a dashboard page behind a session. So
-- the only thing the anon grant bought was the ability to walk out with all
-- 9,641 mapped subtopics across 170 courses in one request, which is the
-- single most expensive artefact in this project and the one a competitor
-- would most like to have. No personal data, so not a breach — but there is no
-- reason to hand it over either.
--
-- _psyllabus_migrations sits in the public schema with RLS off, which means
-- PostgREST will serve it. It holds no personal data, only the names and dates
-- of every migration ever run, which is a description of the system's
-- internals offered to anybody who asks. Deny-all: nothing in the app reads it
-- through the API, only the migration runner does, over the direct connection.

BEGIN;

-- Signed in, and no wider.
DROP POLICY IF EXISTS "Syllabus readable" ON syllabus_content;
DROP POLICY IF EXISTS "syllabus_content readable" ON syllabus_content;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'syllabus_content' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON syllabus_content', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Syllabus readable when signed in"
  ON syllabus_content FOR SELECT
  TO authenticated
  USING (true);

-- The migration log answers to the migration runner, not to the API.
ALTER TABLE _psyllabus_migrations ENABLE ROW LEVEL SECURITY;

COMMIT;
