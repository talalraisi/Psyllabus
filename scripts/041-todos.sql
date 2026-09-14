-- A to-do list that belongs to the student rather than to a page.
--
-- The calendar already holds dated things that the planner reacts to: tests,
-- mocks, internal assessment deadlines. That is deliberately not a to-do list.
-- A test on the 11th changes what the planner puts in front of you; "print the
-- lab sheet" does not, and putting the two in one table would mean either
-- polluting the planner with errands or refusing to let anybody write one down.
--
-- So this is its own table, and it is deliberately small. A title, whether it
-- is done, an optional day, an optional subject, and a position. Everything
-- else people put in task managers — priorities, tags, sub-tasks, recurrence —
-- is what turns a list you actually use into an app you have to maintain.
--
-- It is separate from the calendar for one more reason: a to-do with no date
-- is the common case, and a calendar cannot hold one.

BEGIN;

CREATE TABLE IF NOT EXISTS todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Trimmed and capped in the client, and capped again here, because a client
  -- is a suggestion.
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),

  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,

  -- A local calendar day, not a timestamp. "Thursday" does not move when you
  -- fly somewhere, and storing 00:00Z for it means it does.
  due_on date,

  -- Free text rather than a foreign key: subjects live in a jsonb array on the
  -- profile, and a task should survive its subject being dropped.
  subject text CHECK (subject IS NULL OR char_length(subject) <= 120),

  -- Manual order within the list. Sparse, so a reorder can land between two
  -- neighbours without rewriting the rest.
  position double precision NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The list is always read as "mine, newest ordering first", and the widget
-- that shows only what is outstanding filters on done.
CREATE INDEX IF NOT EXISTS todos_user_open_idx
  ON todos (user_id, done, position, created_at DESC);

CREATE INDEX IF NOT EXISTS todos_user_due_idx
  ON todos (user_id, due_on)
  WHERE due_on IS NOT NULL;

-- done_at follows done rather than being set by the client, so "completed
-- three days ago" cannot be back-dated from a browser.
CREATE OR REPLACE FUNCTION todos_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.done AND (OLD IS NULL OR NOT OLD.done) THEN
    NEW.done_at := now();
  ELSIF NOT NEW.done THEN
    NEW.done_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS todos_touch_trigger ON todos;
CREATE TRIGGER todos_touch_trigger
  BEFORE INSERT OR UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION todos_touch();

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Four policies rather than one FOR ALL: an INSERT policy needs WITH CHECK and
-- a SELECT policy needs USING, and writing them separately is what makes it
-- obvious that both are present.
DROP POLICY IF EXISTS "Users view own todos" ON todos;
CREATE POLICY "Users view own todos" ON todos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own todos" ON todos;
CREATE POLICY "Users insert own todos" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own todos" ON todos;
CREATE POLICY "Users update own todos" ON todos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own todos" ON todos;
CREATE POLICY "Users delete own todos" ON todos
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
