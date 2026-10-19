-- 060: The study plan's own data.
--
-- Three additions for the rebuilt study plan (lib/study-plan.js):
--
-- profiles.plan_settings — how the student studies: minutes per weekday, their
-- rhythm (25/5, 50/10, one block), order (questions or reading first), mixing
-- or focusing subjects, flashcards on or off, which topic each class has
-- reached, and any exam dates they have corrected. One jsonb column because
-- these are read and saved together and change shape as the plan grows. It
-- is not one of the columns the profile guards protect, so the existing
-- "update own profile" policy lets a student save it; capped in size so it
-- cannot be used as free storage. Exported with the rest of the profile row.
--
-- study_sessions.subject / subtopic — which subject a timer run was for, when
-- it was started from a plan task. Makes "time by subject" possible, and
-- makes true the features page's line about sessions being recorded against
-- the subjects worked on. Nullable: a timer started on its own is still time.
--
-- plan_adjustments — the student's edits to the plan: skip a task today, move
-- it to another day, pin it to one, or mark it done. The plan is automatic
-- but these win over it. Students can delete their own rows, which is how an
-- edit is undone; nothing can be updated in place.

BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_settings_size;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_settings_size
  CHECK (pg_column_size(plan_settings) <= 16384);

ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_labels_bounded;
ALTER TABLE study_sessions ADD CONSTRAINT study_sessions_labels_bounded
  CHECK (coalesce(char_length(subject), 0) <= 200 AND coalesce(char_length(subtopic), 0) <= 400);

CREATE TABLE IF NOT EXISTS plan_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id text NOT NULL CHECK (char_length(task_id) <= 600),
  kind text NOT NULL CHECK (kind IN ('skip', 'move', 'pin', 'done')),
  on_date date NOT NULL,
  to_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_adjustments_move_has_date CHECK (kind NOT IN ('move', 'pin') OR to_date IS NOT NULL),
  CONSTRAINT plan_adjustments_once UNIQUE (user_id, task_id, kind, on_date)
);

CREATE INDEX IF NOT EXISTS plan_adjustments_user_date ON plan_adjustments (user_id, on_date DESC);

ALTER TABLE plan_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own plan adjustments" ON plan_adjustments;
CREATE POLICY "Read own plan adjustments" ON plan_adjustments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Add own plan adjustments" ON plan_adjustments;
CREATE POLICY "Add own plan adjustments" ON plan_adjustments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Undo own plan adjustments" ON plan_adjustments;
CREATE POLICY "Undo own plan adjustments" ON plan_adjustments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON plan_adjustments FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON plan_adjustments TO authenticated;

-- Same cap pattern as 037, generous: a year of daily edits is a few hundred.
DROP TRIGGER IF EXISTS plan_adjustments_row_cap ON plan_adjustments;
CREATE TRIGGER plan_adjustments_row_cap BEFORE INSERT ON plan_adjustments
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('5000');

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
    'study_sessions',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM study_sessions t WHERE t.user_id = uid),
    'plan_adjustments',    (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM plan_adjustments t WHERE t.user_id = uid)
  ) INTO out;

  RETURN out;
END;
$$;

REVOKE ALL ON FUNCTION export_my_data() FROM public;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;

COMMIT;
