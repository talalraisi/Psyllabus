-- Curated resources, one row per link.
--
-- lib/resource-catalog.js hand-picks at the subject and topic level, which
-- covers all 2,590 subtopics but cannot be specific to each one. This table
-- holds links chosen for an exact subtopic, imported from a CSV, and the app
-- shows them ahead of anything generic.
--
-- Links only. Never store or mirror a publisher's material here.

BEGIN;

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text,                     -- optional; subtopic is what matters for matching
  subtopic text NOT NULL,
  kind text NOT NULL DEFAULT 'lesson'
    CHECK (kind IN ('official', 'lesson', 'video', 'notes', 'practice', 'reference')),
  title text NOT NULL,
  provider text NOT NULL,         -- who published it, shown to the student
  url text NOT NULL,
  note text,                      -- one line on why this link is worth opening
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Re-importing the CSV updates rows rather than duplicating them.
CREATE UNIQUE INDEX IF NOT EXISTS resources_unique
  ON resources (subject, subtopic, url);

CREATE INDEX IF NOT EXISTS resources_lookup
  ON resources (subject, subtopic);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Reference data: every signed-in student reads it, nobody writes from the app.
DROP POLICY IF EXISTS "Signed-in students read resources" ON resources;
CREATE POLICY "Signed-in students read resources" ON resources
  FOR SELECT TO authenticated USING (true);

COMMIT;
