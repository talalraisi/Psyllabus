-- A time of day on a to-do, as well as its day.
--
-- "Hand in the lab report, Thursday" was all a task could say. Some have an
-- hour: the coordinator's office closes at 3, the submission portal shuts at
-- 23:59. due_time is that hour, on the task's own day.
--
-- A local time with no zone, for the same reason due_on is a date and not a
-- timestamp: "Thursday at 3" does not move when the student does. It means
-- nothing without a day, so it cannot be set without one.

BEGIN;

ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_time time;

ALTER TABLE todos DROP CONSTRAINT IF EXISTS todos_time_needs_day;
ALTER TABLE todos ADD CONSTRAINT todos_time_needs_day CHECK (due_time IS NULL OR due_on IS NOT NULL);

COMMIT;
