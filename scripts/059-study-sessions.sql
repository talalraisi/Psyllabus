-- 059: Study sessions — time the session timer actually ran.
--
-- The timer used to keep only its live countdown, in localStorage, and wrote
-- nothing anywhere when a session ended. So the dashboard's "Time studied"
-- could only count time spent answering questions, and the features page's
-- line about sessions being recorded was not true. Each uninterrupted run of
-- the timer — start or resume, to pause, reset or the end — is one row here.
--
-- The id is generated in the browser when the run starts, not by the
-- database. A run can be closed from several places (the study plan, the
-- floating pill on another page, a later visit after the tab was shut), and
-- with a client id every one of them writes the same row, so the insert is
-- ON CONFLICT DO NOTHING and a session is never counted twice.
--
-- Erasure: rows go with the account through the ON DELETE CASCADE on
-- user_id, because delete_my_account() ends by deleting the auth.users row.
-- Export: export_my_data() is redefined below with study_sessions added,
-- since a table it does not name is data a student asked for and did not get.

BEGIN;

CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_sessions_in_order CHECK (ended_at > started_at),
  -- The timer's longest setting is well under this; anything longer is a
  -- clock gone wrong, not a study session.
  CONSTRAINT study_sessions_bounded CHECK (ended_at - started_at <= interval '12 hours')
);

CREATE INDEX IF NOT EXISTS study_sessions_user_started
  ON study_sessions (user_id, started_at DESC);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own study sessions" ON study_sessions;
CREATE POLICY "Read own study sessions" ON study_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Record own study sessions" ON study_sessions;
CREATE POLICY "Record own study sessions" ON study_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Read and add, nothing else, and nothing for anyone signed out. No update
-- or delete: a session that happened stays happened, and the account's
-- erasure removes them all at once.
REVOKE ALL ON study_sessions FROM anon, authenticated;
GRANT SELECT, INSERT ON study_sessions TO authenticated;

CREATE OR REPLACE FUNCTION export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  out jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'exported_at', now(),
    'notice', 'Everything Project Syllabus holds about you. Question and syllabus content is not included: it is the same for every student and is not personal data.',
    'account', (
      SELECT to_jsonb(p) - 'school_id' - 'access_code_id'
      FROM profiles p WHERE p.id = uid
    ),
    'progress',            (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM progress t WHERE t.user_id = uid),
    'topic_progress',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM user_topic_progress t WHERE t.user_id = uid),
    'core_progress',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM core_progress t WHERE t.user_id = uid),
    'quiz_attempts',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM quiz_attempts t WHERE t.user_id = uid),
    'answers',             (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM question_responses r
                              WHERE r.attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = uid)),
    'mistakes',            (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM mistakes t WHERE t.user_id = uid),
    'mastery_credits',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM mastery_credits t WHERE t.user_id = uid),
    'flashcards',          (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM flashcards t WHERE t.user_id = uid),
    'notes',               (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM notes t WHERE t.user_id = uid),
    'todos',               (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM todos t WHERE t.user_id = uid),
    'calendar_events',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM calendar_events t WHERE t.user_id = uid),
    'saved_questions',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM question_favourites t WHERE t.user_id = uid),
    'question_reports',    (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM question_reports t WHERE t.user_id = uid),
    'feedback',            (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM feedback t WHERE t.user_id = uid),
    'access_redemptions',  (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM access_code_redemptions t WHERE t.user_id = uid),
    'assistant_usage',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM ai_usage t WHERE t.user_id = uid),
    'study_sessions',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM study_sessions t WHERE t.user_id = uid)
  ) INTO out;

  RETURN out;
END;
$$;

REVOKE ALL ON FUNCTION export_my_data() FROM public;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;

COMMIT;
