-- Save a question for later.
--
-- Reporting a question says "this is broken". Saving one says "come back to
-- this" — a worked example worth rereading, a question you got right by luck,
-- one to ask a teacher about. Those are different actions and the second had
-- nowhere to go, so people screenshotted questions instead.
--
-- One row per student per question, so pressing it twice is not two saves.

BEGIN;

CREATE TABLE IF NOT EXISTS question_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_favourites_user
  ON question_favourites (user_id, created_at DESC);

ALTER TABLE question_favourites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students save their own questions" ON question_favourites;
CREATE POLICY "Students save their own questions" ON question_favourites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students read their own saved questions" ON question_favourites;
CREATE POLICY "Students read their own saved questions" ON question_favourites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students unsave their own questions" ON question_favourites;
CREATE POLICY "Students unsave their own questions" ON question_favourites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMIT;
