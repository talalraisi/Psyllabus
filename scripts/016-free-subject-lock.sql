-- Stop the free plan being switched around to get every subject free.
--
-- Free accounts choose one subject. Nothing stopped them quizzing subject A,
-- switching to B, quizzing B, and so on, which hands over the whole product a
-- subject at a time. The choice now sits at the end of onboarding and is held
-- for a cooling-off period before it can be changed again.
--
-- The window is deliberately generous rather than permanent. A student who
-- picks wrong on their first day should not be stuck for a year, and a real
-- change of focus (a subject finishing, a mock coming up) happens on a scale of
-- months, not hours.

BEGIN;

-- When the current free subject may next be changed. Null means "any time",
-- which is what existing accounts get so nobody is locked out retroactively.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_subject_locked_until timestamptz;

COMMIT;
