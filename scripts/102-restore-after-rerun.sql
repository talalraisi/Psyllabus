-- Restore what a re-run of 032-058 put back to older versions.
--
-- 032-058 had been applied to this database without being recorded in
-- _psyllabus_migrations, so setup-db on 5 November 2026 ran them again. Most
-- are idempotent, but four define things a later migration had since
-- replaced, and the re-run restored the older versions:
--
--   protect_profile_subjects   043 (subjects locked by work)  -> 073 (changeable)
--   flashcards_source_check    047 (no 'syllabi')             -> 074
--   export_my_data             057                            -> 081 (lessons, papers)
--   public_bank_counts         036                            -> 089 (flashcards)
--
-- This is each of those latest definitions again, copied from its file.

BEGIN;

-- ===== From 073-subjects-changeable.sql
-- Subjects can be changed whenever a student needs to.
--
-- 042 and 043 locked the list once there was work under it, because work is
-- filed under subject names and changing the list hid it. Hiding is not
-- losing: progress, mistakes and flashcards stay filed under their subject,
-- so removing one hides its work and adding it back brings it all back. The
-- page says exactly that, and students need a way to fix a list they got
-- wrong or that changed.
--
-- What still holds:
--   a free account cannot take its free subject off the list, or the free
--     place would fall to whichever subject came first;
--   the list stays a list of short names, at most twelve.
-- A direct connection (support) can still do anything.


CREATE OR REPLACE FUNCTION public.protect_profile_subjects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  everything boolean;
BEGIN
  IF is_trusted_profile_writer() THEN
    RETURN NEW;
  END IF;

  IF NEW.subjects IS NOT DISTINCT FROM OLD.subjects THEN
    RETURN NEW;
  END IF;

  IF NEW.subjects IS NULL OR jsonb_typeof(NEW.subjects) <> 'array' THEN
    RAISE EXCEPTION 'Subjects must be a list.' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_array_length(NEW.subjects) > 12
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.subjects) e WHERE jsonb_typeof(e) <> 'string' OR char_length(e #>> '{}') > 120) THEN
    RAISE EXCEPTION 'That is not a list of subjects.' USING ERRCODE = 'check_violation';
  END IF;

  everything := OLD.is_admin
    OR OLD.plan IN ('basic', 'premium')
    OR (OLD.access_expires_at IS NOT NULL AND OLD.access_expires_at > now());

  IF NOT everything AND OLD.free_subject IS NOT NULL AND NOT (NEW.subjects ? OLD.free_subject) THEN
    RAISE EXCEPTION 'Your free subject (%) stays on your list. Change the others, or unlock every subject.', OLD.free_subject
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ===== From 081-export-papers.sql
-- Predicted-paper sittings (080) belong in a student's data export too.
-- Same function otherwise, copied from the live definition.


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
    'syllabi_ideas',       (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM syllabi_ideas t WHERE t.user_id = uid),
    'syllabi_folders',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM syllabi_folders t WHERE t.user_id = uid),
    'lesson_progress',     (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM lesson_progress t WHERE t.user_id = uid),
    'paper_attempts',      (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM paper_attempts t WHERE t.user_id = uid)
  ) INTO out;

  RETURN out;
END;
$function$;

-- ===== From 089-public-counts-flashcards.sql
-- The landing page counts ready-made flashcards as well as questions.
-- Only checked cards count, as only verified questions do.


CREATE OR REPLACE FUNCTION public.public_bank_counts()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'questions',  (SELECT count(*) FROM questions WHERE verified),
    'flashcards', (SELECT count(*) FROM flashcard_presets WHERE verified),
    'subtopics',  (SELECT count(*) FROM syllabus_content),
    'subjects',   (SELECT count(DISTINCT subject) FROM syllabus_content)
  );
$function$;

-- ===== From 074-notes-cards.sql
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_source_check;
ALTER TABLE flashcards ADD CONSTRAINT flashcards_source_check
  CHECK (source = ANY (ARRAY['manual', 'note', 'question', 'preset', 'syllabi']));

COMMIT;
