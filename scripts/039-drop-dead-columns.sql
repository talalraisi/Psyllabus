-- Columns nothing reads and nothing has ever written.
--
-- Data minimisation is not only about what you collect, it is about what you
-- keep a place for. A column that exists with no purpose is somewhere data
-- accumulates without anyone deciding it should, and the honest time to remove
-- one is while it is still empty.
--
-- Checked before dropping: every one of these is NULL or false on every row.
--
--   reminders_enabled, reminder_time  reminders are read from calendar_events;
--                                     ReminderWatcher never looks at a profile
--   guardian_email                    no field on any form collects it
--
-- guardian_verified_at is deliberately kept. It is unused today because the
-- verification flow has not been built, but it is the column that flow will
-- write to, and it is the difference between "a student ticked a box" and "a
-- guardian confirmed" that the PDPL actually cares about.
--
-- school_id and access_code_id are kept too: neither appears in application
-- code because both are read server-side, school_id by the schools RLS policy
-- through current_school_id() and access_code_id by redemption.

BEGIN;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS reminders_enabled,
  DROP COLUMN IF EXISTS reminder_time,
  DROP COLUMN IF EXISTS guardian_email;

COMMIT;
