-- Flashcards, made by the student or generated from what is already there.
--
-- The question bank is the expensive, slow part of this product. Flashcards are
-- not: a card is a prompt and an answer, and a student can write one in ten
-- seconds. That makes them the fastest route to an app that is worth opening
-- before the bank is deep.
--
-- Cards can be generated too, from two sources that already exist and cost
-- nothing: a student's own notes, and questions they have already answered.
-- A multiple choice question with its explanation is a flashcard that has been
-- sitting there the whole time.
--
-- Scheduling is the same idea as the mistake bank but separate from it. The
-- mistake bank is evidence: it holds questions you got wrong and it feeds
-- mastery. Cards are self-marked, so they never touch mastery points. Keeping
-- the two apart is what stops self-assessment leaking into the heatmap.

BEGIN;

CREATE TABLE IF NOT EXISTS flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  subject text NOT NULL,
  topic text,
  subtopic text,

  front text NOT NULL,
  back text NOT NULL,

  -- 'manual' | 'note' | 'question'. Kept so a student can tell what they wrote
  -- from what the app assembled, and so generated cards can be regenerated.
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'note', 'question')),
  source_id uuid,

  -- Self-marked review schedule. Deliberately separate from mastery.
  box int NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  reviews int NOT NULL DEFAULT 0,
  lapses int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flashcards_due ON flashcards (user_id, due_at);
CREATE INDEX IF NOT EXISTS flashcards_subject ON flashcards (user_id, subject, subtopic);

-- A generated card should not be created twice from the same source.
CREATE UNIQUE INDEX IF NOT EXISTS flashcards_one_per_source
  ON flashcards (user_id, source, source_id) WHERE source_id IS NOT NULL;

ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own cards" ON flashcards;
CREATE POLICY "Students read own cards" ON flashcards
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students create own cards" ON flashcards;
CREATE POLICY "Students create own cards" ON flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update own cards" ON flashcards;
CREATE POLICY "Students update own cards" ON flashcards
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students delete own cards" ON flashcards;
CREATE POLICY "Students delete own cards" ON flashcards
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Erasure has to take these as well.
-- ---------------------------------------------------------------------------

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
    'flashcards', (SELECT count(*) FROM flashcards WHERE user_id = uid)
  ) INTO removed;

  DELETE FROM question_responses
    WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = uid);
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
