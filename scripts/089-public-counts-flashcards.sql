-- The landing page counts ready-made flashcards as well as questions.
-- Only checked cards count, as only verified questions do.

BEGIN;

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

COMMIT;
