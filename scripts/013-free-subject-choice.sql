-- Let a free account choose which subject is the free one.
--
-- Until now the free subject was whichever happened to sit first in the
-- profile's subjects array, which is an accident of the order they were ticked
-- during onboarding. A student revising for a Chemistry test should not have to
-- upgrade because English sorted first.

BEGIN;

-- Null means "not chosen yet", and the app falls back to the first subject.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_subject text;

COMMIT;
