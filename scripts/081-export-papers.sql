-- Predicted-paper sittings (080) belong in a student's data export too.
-- Same function otherwise, copied from the live definition.

BEGIN;

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

COMMIT;
