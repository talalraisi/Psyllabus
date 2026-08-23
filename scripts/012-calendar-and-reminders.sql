-- Calendar and reminders.
--
-- Students already track what they know; this tracks what is coming. Tests,
-- deadlines, mocks and IA milestones live in one table, and the study planner
-- reads it so that a test in four days outranks a topic with no date on it.
--
-- Reminders are stored as an offset in minutes so the client can raise a
-- notification at the right moment without a scheduler.

BEGIN;

-- ---------------------------------------------------------------------------
-- Reminder preferences on the profile
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT false;
-- Local time of day for the daily study nudge, e.g. '18:00'.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminder_time text;
-- Preferred length of a study block, in minutes.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_minutes int NOT NULL DEFAULT 40
  CHECK (session_minutes BETWEEN 5 AND 240);

-- ---------------------------------------------------------------------------
-- Calendar events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'test'
    CHECK (kind IN ('test', 'mock', 'deadline', 'ia', 'oral', 'other')),
  subject text,                      -- null for cross-subject deadlines
  due_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT true,
  notes text,
  -- Minutes before due_at to raise a reminder. Null means no reminder.
  remind_minutes_before int DEFAULT 1440,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_events_user_due_idx
  ON calendar_events (user_id, due_at);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read their own events" ON calendar_events;
CREATE POLICY "Students read their own events" ON calendar_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students create their own events" ON calendar_events;
CREATE POLICY "Students create their own events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update their own events" ON calendar_events;
CREATE POLICY "Students update their own events" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students delete their own events" ON calendar_events;
CREATE POLICY "Students delete their own events" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
