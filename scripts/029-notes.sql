-- Your own notes, attached to the syllabus.
--
-- The app could measure a student and plan for them, but it had nowhere to put
-- the thing students actually spend their time producing. So it was only worth
-- opening when you wanted to be tested, which is a small fraction of studying.
--
-- Notes here are not a notes app with a syllabus bolted on. They are attached
-- to a specific subtopic, which is the thing Notion and Google Docs cannot do:
-- they have no idea what "Topic 3.1, Circular motion" is, so your notes end up
-- in a folder structure you maintain by hand and that drifts from the course.
--
-- This also happens to be the strongest thing the product can own. Questions
-- can be out-written by a company with money. A student's own notes, mapped
-- across two years of their course, cannot be taken anywhere else.

BEGIN;

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  topic text,
  subtopic text NOT NULL,
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One note per subtopic. Students want "my notes on enzymes", not a list of
  -- seven documents they have to pick between.
  UNIQUE (user_id, subject, subtopic)
);

CREATE INDEX IF NOT EXISTS notes_lookup ON notes (user_id, subject);
CREATE INDEX IF NOT EXISTS notes_recent ON notes (user_id, updated_at DESC);

-- Searchable, so a note can be found from the search page alongside the
-- syllabus itself.
CREATE INDEX IF NOT EXISTS notes_body_trgm ON notes USING gin (body gin_trgm_ops);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own notes" ON notes;
CREATE POLICY "Students read own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students write own notes" ON notes;
CREATE POLICY "Students write own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update own notes" ON notes;
CREATE POLICY "Students update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students delete own notes" ON notes;
CREATE POLICY "Students delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
