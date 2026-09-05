-- Guardian consent and the right to erasure.
--
-- Oman's Personal Data Protection Law (Royal Decree 6/2022) requires guardian
-- consent to process a minor's data, and gives every subject an absolute right
-- to have their data deleted. The audience here is 16 to 18, so both apply.
--
-- Consent is recorded rather than merely collected. A tick box with no audit
-- trail proves nothing to a school asking when and on what terms a student
-- agreed, so the timestamp and the wording they accepted are both stored.

BEGIN;

-- ---------------------------------------------------------------------------
-- Consent
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_consent_at timestamptz;
-- The exact wording agreed to, so a later change to the form cannot rewrite
-- what somebody actually consented to.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_consent_text text;
-- Optional, and the stronger form of consent: an address that can be verified.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_verified_at timestamptz;

-- ---------------------------------------------------------------------------
-- Erasure
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER because a signed-in client cannot delete its own row in
-- auth.users, and deleting only the profile would leave the account able to
-- sign in to an empty shell. Everything else cascades from auth.users, but the
-- child rows are removed explicitly so the function is readable as a list of
-- exactly what goes.
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
    'events',     (SELECT count(*) FROM calendar_events WHERE user_id = uid)
  ) INTO removed;

  DELETE FROM question_responses
    WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE user_id = uid);
  DELETE FROM mistakes WHERE user_id = uid;
  DELETE FROM quiz_attempts WHERE user_id = uid;
  DELETE FROM mastery_credits WHERE user_id = uid;
  DELETE FROM calendar_events WHERE user_id = uid;
  DELETE FROM progress WHERE user_id = uid;
  DELETE FROM access_code_redemptions WHERE user_id = uid;
  DELETE FROM profiles WHERE id = uid;

  -- Removes the login itself. Without this the account still exists.
  DELETE FROM auth.users WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'removed', removed);
END;
$$;

REVOKE ALL ON FUNCTION delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

COMMIT;
