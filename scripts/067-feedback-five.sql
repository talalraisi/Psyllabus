-- The feedback button now allows five messages in ten minutes before the
-- limit steps in (it was three). Everything else is as 066 set it.

BEGIN;

CREATE OR REPLACE FUNCTION public.limit_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF recent >= 5 THEN
    RAISE EXCEPTION 'That is a lot at once. Give it a few minutes.';
  END IF;
  IF today >= 15 THEN
    RAISE EXCEPTION 'That is plenty for today. Thank you for all of it.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_feedback ON feedback;
CREATE TRIGGER limit_feedback
  BEFORE INSERT ON feedback
  FOR EACH ROW EXECUTE FUNCTION public.limit_feedback();

COMMIT;
