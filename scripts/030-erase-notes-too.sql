-- Notes were added after the erasure function was written, so delete_my_account
-- would have left them behind. A "delete everything" that quietly keeps your
-- notes is worse than no button, and it is exactly the kind of gap a school's
-- IT review is looking for.

BEGIN;

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
    'progress', (SELECT count(*) FROM progress WHERE user_id = uid),
    'attempts', (SELECT count(*) FROM quiz_attempts WHERE user_id = uid),
    'mistakes', (SELECT count(*) FROM mistakes WHERE user_id = uid),
    'credits',  (SELECT count(*) FROM mastery_credits WHERE user_id = uid),
    'events',   (SELECT count(*) FROM calendar_events WHERE user_id = uid),
    'notes',    (SELECT count(*) FROM notes WHERE user_id = uid)
  ) INTO removed;

  DELETE FROM question_responses
    WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = uid);
  DELETE FROM mistakes WHERE user_id = uid;
  DELETE FROM quiz_attempts WHERE user_id = uid;
  DELETE FROM mastery_credits WHERE user_id = uid;
  DELETE FROM calendar_events WHERE user_id = uid;
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
