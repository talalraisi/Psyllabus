-- Caps on how much one account can create.
--
-- There is no server of our own to rate limit: the browser talks to Supabase
-- directly and RLS decides what it may touch. RLS answers "whose row is this"
-- and says nothing about "how many", so a runaway loop in our own code, or a
-- script someone writes against the public anon key, can insert until the
-- database fills. That is not a data breach; it is an outage and a bill, and
-- it is the more likely of the two to actually happen.
--
-- The numbers are far above real use and far below damage. A student with
-- 5,000 flashcards is extraordinary; one with 500,000 is a bug.
--
-- Auth endpoints (sign-up, sign-in, password reset, email sending) are rate
-- limited by Supabase itself under Authentication -> Rate Limits, which is
-- where those belong and cannot be done from here.

BEGIN;

CREATE OR REPLACE FUNCTION enforce_row_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap   int := TG_ARGV[0]::int;
  total bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I WHERE user_id = $1', TG_TABLE_NAME)
    INTO total USING NEW.user_id;

  IF total >= cap THEN
    RAISE EXCEPTION
      'You have reached the limit of % rows in %. Delete some before adding more.',
      cap, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flashcards_row_cap ON flashcards;
CREATE TRIGGER flashcards_row_cap BEFORE INSERT ON flashcards
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('20000');

DROP TRIGGER IF EXISTS notes_row_cap ON notes;
CREATE TRIGGER notes_row_cap BEFORE INSERT ON notes
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('10000');

DROP TRIGGER IF EXISTS calendar_events_row_cap ON calendar_events;
CREATE TRIGGER calendar_events_row_cap BEFORE INSERT ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('5000');

DROP TRIGGER IF EXISTS question_reports_row_cap ON question_reports;
CREATE TRIGGER question_reports_row_cap BEFORE INSERT ON question_reports
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('2000');

DROP TRIGGER IF EXISTS quiz_attempts_row_cap ON quiz_attempts;
CREATE TRIGGER quiz_attempts_row_cap BEFORE INSERT ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('50000');

-- Stored text is capped too. Without this one note can be as large as the
-- client is willing to send, and a few of those cost more than every row cap
-- above put together.
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_body_length;
ALTER TABLE notes ADD CONSTRAINT notes_body_length CHECK (length(body) <= 100000);

ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_text_length;
ALTER TABLE flashcards ADD CONSTRAINT flashcards_text_length
  CHECK (length(front) <= 5000 AND length(back) <= 5000);

ALTER TABLE question_reports DROP CONSTRAINT IF EXISTS question_reports_note_length;
ALTER TABLE question_reports ADD CONSTRAINT question_reports_note_length
  CHECK (note IS NULL OR length(note) <= 2000);

COMMIT;
