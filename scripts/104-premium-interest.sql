-- Who wants Premium before it can be bought.
--
-- During the beta the paid plans are not on sale yet (billing waits on the
-- store being activated). A student who would pay presses "Tell me when
-- Premium opens" and lands here, one row each, so the day payments go live
-- there is a list of exactly who to tell (npm run premium-interest).
--
-- Signed-in students only: their email is already on their account, so the
-- page collects nothing new and nobody can fill the list with strangers.

BEGIN;

CREATE TABLE IF NOT EXISTS premium_interest (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'premium' CHECK (plan IN ('basic', 'premium')),
  cycle text CHECK (cycle IN ('monthly', 'yearly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  told_at timestamptz
);

ALTER TABLE premium_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students see their own interest" ON premium_interest;
CREATE POLICY "Students see their own interest" ON premium_interest
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students add their own interest" ON premium_interest;
CREATE POLICY "Students add their own interest" ON premium_interest
  FOR INSERT WITH CHECK (auth.uid() = user_id AND told_at IS NULL);

DROP POLICY IF EXISTS "Students change their own interest" ON premium_interest;
CREATE POLICY "Students change their own interest" ON premium_interest
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND told_at IS NULL);

DROP POLICY IF EXISTS "Students take back their interest" ON premium_interest;
CREATE POLICY "Students take back their interest" ON premium_interest
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON premium_interest FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON premium_interest TO authenticated;

COMMIT;
