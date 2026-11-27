-- 108: reports that actually arrive.
--
-- 1. Feedback needed 50 characters. "The answer to Q3 is wrong" is 25, so most
--    real reports were refused (the button stayed greyed out), and so was
--    every short automatic one: Syllabi thumbs, curriculum waitlist. Now any
--    message with a few real characters goes through; the duplicate and
--    rate limits stay.
-- 2. The admin inbox (all_feedback) showed only the feedback table. Reports
--    on questions went to question_reports and were visible only from
--    `npm run reports`, so the inbox looked empty while reports existed.
--    It now returns both, question reports as kind 'question'.

CREATE OR REPLACE FUNCTION public.limit_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent integer;
  today integer;
  same integer;
BEGIN
  IF char_length(btrim(NEW.message)) < 3 THEN
    RAISE EXCEPTION 'Write a few words so we know what you mean.';
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('psyllabus:feedback:' || NEW.user_id::text));

  SELECT count(*) FILTER (WHERE created_at > now() - interval '10 minutes'),
         count(*),
         count(*) FILTER (WHERE lower(btrim(message)) = lower(btrim(NEW.message)))
    INTO recent, today, same
    FROM feedback
   WHERE user_id = NEW.user_id
     AND created_at > now() - interval '1 day';

  IF same > 0 THEN
    RAISE EXCEPTION 'You already sent that one. Thank you.';
  END IF;
  IF recent >= 10 THEN
    RAISE EXCEPTION 'That is a lot at once. Give it a few minutes.';
  END IF;
  IF today >= 30 THEN
    RAISE EXCEPTION 'That is plenty for today. Thank you for all of it.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.all_feedback()
RETURNS TABLE (
  id uuid,
  kind text,
  message text,
  path text,
  viewport text,
  handled boolean,
  created_at timestamptz,
  email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin) THEN
    RAISE EXCEPTION 'Not allowed.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT * FROM (
      SELECT f.id, f.kind, f.message, f.path, f.viewport, f.handled, f.created_at, u.email::text
        FROM feedback f
        LEFT JOIN auth.users u ON u.id = f.user_id
      UNION ALL
      SELECT r.id,
             'question'::text,
             concat_ws(E'\n',
               initcap(replace(r.reason, '_', ' ')) || coalesce(': ' || nullif(btrim(r.note), ''), ''),
               '',
               q.subject || ' · ' || coalesce(q.subtopic, q.topic, ''),
               left(regexp_replace(coalesce(q.stem, ''), '\s+', ' ', 'g'), 400),
               'Answer on file: ' || left(coalesce(q.correct_answer, ''), 200),
               'Question ' || q.id::text),
             NULL::text,
             NULL::text,
             r.resolved_at IS NOT NULL,
             r.created_at,
             u.email::text
        FROM question_reports r
        JOIN questions q ON q.id = r.question_id
        LEFT JOIN auth.users u ON u.id = r.user_id
    ) x
    ORDER BY x.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.all_feedback() FROM public;
GRANT EXECUTE ON FUNCTION public.all_feedback() TO authenticated;
