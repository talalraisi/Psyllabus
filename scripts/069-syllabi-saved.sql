-- Syllabi remembers: conversations, every marked draft, and ideas.
--
-- Until now all of it lived in the browser tab and was gone when the tab
-- closed, which is the wrong default for an essay a student is redrafting
-- over weeks. Now it is kept on their account:
--
--   syllabi_chats   one row per conversation, its messages as JSON. Files a
--                   student attached are not kept, only their names.
--   syllabi_marks   one row every time a draft is marked: the text as sent,
--                   the review, and the total and grade pulled out so a list
--                   can show progress without reading the JSON. Markings of
--                   the same draft share a draft_id, which is how the page
--                   shows 13/24 becoming 17/24.
--   syllabi_ideas   one row per set of research questions or study plan.
--
-- Each is the student's own: they read, add and delete their rows, nobody
-- else reads them, and they go with the account (ON DELETE CASCADE) and come
-- out in the data export. Sizes are capped per row and rows per student, so
-- a loop cannot fill the database.

BEGIN;

CREATE TABLE IF NOT EXISTS syllabi_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text CHECK (subject IS NULL OR char_length(subject) <= 120),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 160),
  -- Where it was opened from, when not the Syllabi page: "Flashcard · Physics".
  source text CHECK (source IS NULL OR char_length(source) <= 120),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array' AND pg_column_size(messages) <= 400000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_syllabi_chats_user ON syllabi_chats (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS syllabi_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL,
  subject text CHECK (subject IS NULL OR char_length(subject) <= 120),
  kind text NOT NULL CHECK (kind IN ('ia', 'ee', 'tok')),
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 160),
  text text NOT NULL CHECK (char_length(text) <= 60000),
  review jsonb NOT NULL CHECK (jsonb_typeof(review) = 'object' AND pg_column_size(review) <= 300000),
  total integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  out_of integer NOT NULL DEFAULT 0 CHECK (out_of >= 0),
  grade text CHECK (grade IS NULL OR char_length(grade) <= 4),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_syllabi_marks_user ON syllabi_marks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_syllabi_marks_draft ON syllabi_marks (user_id, draft_id, created_at);

CREATE TABLE IF NOT EXISTS syllabi_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('research', 'study')),
  subject text CHECK (subject IS NULL OR char_length(subject) <= 120),
  kind text CHECK (kind IS NULL OR kind IN ('ia', 'ee')),
  prompt text NOT NULL DEFAULT '' CHECK (char_length(prompt) <= 2000),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object' AND pg_column_size(result) <= 100000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_syllabi_ideas_user ON syllabi_ideas (user_id, created_at DESC);

ALTER TABLE syllabi_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabi_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabi_ideas ENABLE ROW LEVEL SECURITY;

-- Chats are kept up to date as the conversation goes, so they can be updated;
-- markings and ideas are records, so they are added and deleted, not edited.
DROP POLICY IF EXISTS "Own chats" ON syllabi_chats;
CREATE POLICY "Own chats" ON syllabi_chats FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Read own marks" ON syllabi_marks;
CREATE POLICY "Read own marks" ON syllabi_marks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Add own marks" ON syllabi_marks;
CREATE POLICY "Add own marks" ON syllabi_marks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Delete own marks" ON syllabi_marks;
CREATE POLICY "Delete own marks" ON syllabi_marks FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Read own ideas" ON syllabi_ideas;
CREATE POLICY "Read own ideas" ON syllabi_ideas FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Add own ideas" ON syllabi_ideas;
CREATE POLICY "Add own ideas" ON syllabi_ideas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Delete own ideas" ON syllabi_ideas;
CREATE POLICY "Delete own ideas" ON syllabi_ideas FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON syllabi_chats, syllabi_marks, syllabi_ideas FROM anon;
REVOKE UPDATE ON syllabi_marks, syllabi_ideas FROM authenticated;

DROP TRIGGER IF EXISTS syllabi_chats_row_cap ON syllabi_chats;
CREATE TRIGGER syllabi_chats_row_cap BEFORE INSERT ON syllabi_chats
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('300');
DROP TRIGGER IF EXISTS syllabi_marks_row_cap ON syllabi_marks;
CREATE TRIGGER syllabi_marks_row_cap BEFORE INSERT ON syllabi_marks
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('500');
DROP TRIGGER IF EXISTS syllabi_ideas_row_cap ON syllabi_ideas;
CREATE TRIGGER syllabi_ideas_row_cap BEFORE INSERT ON syllabi_ideas
  FOR EACH ROW EXECUTE FUNCTION enforce_row_cap('300');

-- The data export now includes all three.
CREATE OR REPLACE FUNCTION public.export_my_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'plan_adjustments',    (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM plan_adjustments t WHERE t.user_id = uid),
    -- The connection minus its private link: that address is a key to the
    -- student's own calendar, and an export file gets emailed and left in
    -- downloads folders.
    'calendar_connections', (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'url'), '[]'::jsonb) FROM calendar_connections t WHERE t.user_id = uid),
    'calendar_imported',   (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM calendar_busy t WHERE t.user_id = uid),
    'plan_blocks',         (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM plan_blocks t WHERE t.user_id = uid),
    'syllabi_chats',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM syllabi_chats t WHERE t.user_id = uid),
    'syllabi_marks',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM syllabi_marks t WHERE t.user_id = uid),
    'syllabi_ideas',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM syllabi_ideas t WHERE t.user_id = uid)
  ) INTO out;

  RETURN out;
END;
$function$;

COMMIT;
