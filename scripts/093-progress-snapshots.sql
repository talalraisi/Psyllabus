-- How much was proved, day by day, so Progress can draw it over time.
--
-- The progress table only holds where each subtopic stands now. One row a
-- day per student (subject '' for all of them together, and one per
-- subject), written by the Progress page when it opens, is enough for a
-- line that grows with the student.

BEGIN;

CREATE TABLE IF NOT EXISTS progress_snapshots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  subject text NOT NULL DEFAULT '',
  proved integer NOT NULL CHECK (proved >= 0),
  tested integer NOT NULL CHECK (tested >= 0),
  total integer NOT NULL CHECK (total >= 0),
  PRIMARY KEY (user_id, day, subject)
);

ALTER TABLE progress_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own snapshots" ON progress_snapshots;
CREATE POLICY "Students read own snapshots" ON progress_snapshots FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students write own snapshots" ON progress_snapshots;
CREATE POLICY "Students write own snapshots" ON progress_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id AND day = current_date);
DROP POLICY IF EXISTS "Students update today's snapshot" ON progress_snapshots;
CREATE POLICY "Students update today's snapshot" ON progress_snapshots FOR UPDATE USING (auth.uid() = user_id AND day = current_date) WITH CHECK (auth.uid() = user_id AND day = current_date);

COMMIT;
