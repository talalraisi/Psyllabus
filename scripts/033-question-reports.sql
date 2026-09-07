-- Let students tell you a question is wrong.
--
-- You can check a hundred questions. Your users will sit thousands, and they
-- will hit the bad ones you never sampled. A report button turns every quiz
-- into a spot-check you did not have to do, which is the only way a bank this
-- size ever gets clean.
--
-- A report is a signal, not a verdict. Plenty of people report a question
-- because they got it wrong and are annoyed, which is human and not evidence.
-- So one report changes nothing visible: it queues the question for you. Three
-- separate people reporting the same question is different, because they do
-- not know about each other, and at that point the question comes down
-- automatically and waits for you rather than staying up until you happen to
-- look.
--
-- Taking a question down is cheap and reversible. Leaving a wrong one up costs
-- a student marks in a real exam, and they never find out why.

BEGIN;

CREATE TABLE IF NOT EXISTS question_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Categories rather than free text alone, because "the answer is wrong" and
  -- "this is not on my syllabus" need completely different fixes and a pile of
  -- undifferentiated complaints is unreadable.
  reason text NOT NULL CHECK (reason IN (
    'wrong_answer',   -- the marked answer is not right
    'unclear',        -- cannot tell what is being asked
    'off_syllabus',   -- not part of this course
    'typo',           -- broken text, symbols, formatting
    'other'
  )),
  note text,

  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One report per person per question. Otherwise one annoyed student can take
-- a perfectly good question down on their own.
CREATE UNIQUE INDEX IF NOT EXISTS question_reports_one_per_user
  ON question_reports (question_id, user_id);

CREATE INDEX IF NOT EXISTS question_reports_open
  ON question_reports (question_id) WHERE resolved_at IS NULL;

ALTER TABLE question_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students file own reports" ON question_reports;
CREATE POLICY "Students file own reports" ON question_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students read own reports" ON question_reports;
CREATE POLICY "Students read own reports" ON question_reports
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Three independent reports takes a question down.
--
-- SECURITY DEFINER because a student may not update the questions table, and
-- must not be able to: the whole point is that the threshold decides, not the
-- reporter. It only ever sets verified to false, so the worst a coordinated
-- group of three can do is hide a question until you look at it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION unpublish_heavily_reported()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_reports int;
BEGIN
  SELECT count(DISTINCT user_id) INTO open_reports
  FROM question_reports
  WHERE question_id = NEW.question_id AND resolved_at IS NULL;

  IF open_reports >= 3 THEN
    UPDATE questions SET verified = false WHERE id = NEW.question_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS question_reports_threshold ON question_reports;
CREATE TRIGGER question_reports_threshold
  AFTER INSERT ON question_reports
  FOR EACH ROW EXECUTE FUNCTION unpublish_heavily_reported();

-- Erasure has to take these too.
CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  removed jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  SELECT jsonb_build_object(
    'progress',   (SELECT count(*) FROM progress WHERE user_id = uid),
    'attempts',   (SELECT count(*) FROM quiz_attempts WHERE user_id = uid),
    'mistakes',   (SELECT count(*) FROM mistakes WHERE user_id = uid),
    'credits',    (SELECT count(*) FROM mastery_credits WHERE user_id = uid),
    'events',     (SELECT count(*) FROM calendar_events WHERE user_id = uid),
    'notes',      (SELECT count(*) FROM notes WHERE user_id = uid),
    'flashcards', (SELECT count(*) FROM flashcards WHERE user_id = uid),
    'reports',    (SELECT count(*) FROM question_reports WHERE user_id = uid)
  ) INTO removed;

  DELETE FROM question_responses
    WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = uid);
  DELETE FROM question_reports WHERE user_id = uid;
  DELETE FROM mistakes WHERE user_id = uid;
  DELETE FROM quiz_attempts WHERE user_id = uid;
  DELETE FROM mastery_credits WHERE user_id = uid;
  DELETE FROM calendar_events WHERE user_id = uid;
  DELETE FROM flashcards WHERE user_id = uid;
  DELETE FROM notes WHERE user_id = uid;
  DELETE FROM progress WHERE user_id = uid;
  DELETE FROM access_code_redemptions WHERE user_id = uid;
  DELETE FROM profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'removed', removed);
END;
$$;

REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

COMMIT;
