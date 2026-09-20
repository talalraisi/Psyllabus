-- Three student plans instead of two.
--
-- free    one subject, everything the app does for it
-- basic   every subject you take
-- premium every subject, plus Syllabi
--
-- A school licence grants premium and is recorded through access_source, so
-- it needs no plan of its own: a student on a school code is a premium
-- student whose access came from somewhere else.

BEGIN;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan = ANY (ARRAY['free'::text, 'basic'::text, 'premium'::text]));

COMMENT ON COLUMN profiles.plan IS
  'free | basic | premium. Set by the server only — the privilege trigger reverts client writes.';

COMMIT;
