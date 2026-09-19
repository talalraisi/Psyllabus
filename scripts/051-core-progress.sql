-- The Diploma core, ticked off by hand.
--
-- Everything else in this app refuses self-marking: a heatmap you can colour
-- in by feeling confident is a heatmap that lies. The core is the exception,
-- and it is not a contradiction — TOK, the extended essay and CAS are not
-- quizzed by anybody, they are a list of things that have to happen by a date.
-- "Sent the draft to my supervisor" is a fact the student is the only witness
-- to, so it is theirs to record.
--
-- It is kept in its own table for exactly that reason: none of it can ever
-- reach the progress that drives the heatmap and the prediction.

BEGIN;

CREATE TABLE IF NOT EXISTS core_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  item text NOT NULL,
  done boolean NOT NULL DEFAULT true,
  note text,
  done_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject, item)
);

CREATE INDEX IF NOT EXISTS idx_core_progress_user ON core_progress (user_id, subject);

ALTER TABLE core_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students record their own core progress" ON core_progress;
CREATE POLICY "Students record their own core progress" ON core_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students read their own core progress" ON core_progress;
CREATE POLICY "Students read their own core progress" ON core_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students change their own core progress" ON core_progress;
CREATE POLICY "Students change their own core progress" ON core_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students clear their own core progress" ON core_progress;
CREATE POLICY "Students clear their own core progress" ON core_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMIT;
