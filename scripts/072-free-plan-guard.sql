-- One person, one free subject.
--
-- A free account opens one subject, chosen once. Two ways round that are
-- closed here: changing the free subject after choosing it (the old lock was
-- a cooling-off window the app never set), and making more accounts to
-- choose more free subjects.
--
-- The free subject can now only be set through claim_free_subject(), once.
-- Before it is set, the claim checks, in order:
--
--   the email is not a throwaway address
--   no other account has claimed with the same inbox: Gmail dots and
--     "+anything" aliases count as the same address
--   this device has not claimed for two other accounts already (siblings
--     share laptops)
--   this network has not had eight new free claims in the last day (a
--     school shares one address)
--
-- What is kept is a one-way fingerprint of each (SHA-256 with a salt), never
-- the email, device id or address itself, in a table no client can read. It
-- goes when the account is deleted. Accounts with every subject (school
-- licences, paid plans, admins) skip the checks: they lose nothing to a
-- duplicate.
--
-- None of this stops someone with several real inboxes and devices; phone
-- verification would, and costs money per text. It stops the easy ways.

BEGIN;

CREATE TABLE IF NOT EXISTS free_claims (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_key text NOT NULL,
  device_key text,
  network_key text,
  subject text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_free_claims_email ON free_claims (email_key);
CREATE INDEX IF NOT EXISTS idx_free_claims_device ON free_claims (device_key, created_at);
CREATE INDEX IF NOT EXISTS idx_free_claims_network ON free_claims (network_key, created_at);
ALTER TABLE free_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON free_claims FROM anon, authenticated;

/** The inbox an address really delivers to: lower case, "+tag" dropped, and Gmail's dots ignored. */
CREATE OR REPLACE FUNCTION public.inbox_of(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(lower(btrim(p_email)), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(btrim(p_email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(lower(btrim(p_email)), '@', 1), '+', 1) || '@' || split_part(lower(btrim(p_email)), '@', 2)
  END
$$;

CREATE OR REPLACE FUNCTION public.fingerprint(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest('psyllabus:free-claim:v1:' || p_value, 'sha256'), 'hex')
$$;
REVOKE ALL ON FUNCTION public.fingerprint(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_free_subject(p_subject text, p_device text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  uid uuid := auth.uid();
  prof profiles%ROWTYPE;
  addr text;
  confirmed timestamptz;
  domain text;
  v_email text;
  v_device text;
  v_network text;
  ip text;
  everything boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'signed_out');
  END IF;

  SELECT * INTO prof FROM profiles WHERE id = uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
  END IF;
  IF prof.free_subject IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already', 'subject', prof.free_subject);
  END IF;
  IF NOT (prof.subjects ? p_subject) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_your_subject');
  END IF;

  everything := prof.is_admin
    OR prof.plan IN ('basic', 'premium')
    OR (prof.access_expires_at IS NOT NULL AND prof.access_expires_at > now());

  IF NOT everything THEN
    SELECT email, email_confirmed_at INTO addr, confirmed FROM auth.users WHERE id = uid;
    IF addr IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_email');
    END IF;
    IF confirmed IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'confirm_email');
    END IF;

    domain := split_part(lower(btrim(addr)), '@', 2);
    IF domain IN (
      'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'grr.la', '10minutemail.com',
      '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com', 'tempail.com', 'tempr.email',
      'tempinbox.com', 'yopmail.com', 'yopmail.net', 'trashmail.com', 'getnada.com', 'nada.email', 'dispostable.com',
      'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'fakemail.net', 'emailfake.com', 'mintemail.com', 'mohmal.com',
      'emailondeck.com', 'burnermail.io', 'mailnesia.com', 'spamgourmet.com', 'moakt.com', 'tmail.ws', 'minuteinbox.com',
      'mailpoof.com', 'inboxkitten.com', 'dropmail.me', 'mail.tm', 'tmpmail.org', 'tmpmail.net', 'discard.email',
      'spambox.us', 'mytemp.email', 'harakirimail.com', 'mailcatch.com', 'trbvm.com', 'emltmp.com', 'mailtemp.net'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'disposable');
    END IF;

    v_email := fingerprint('email:' || inbox_of(addr));
    IF p_device IS NOT NULL AND char_length(p_device) BETWEEN 16 AND 100 THEN
      v_device := fingerprint('device:' || p_device);
    END IF;
    ip := btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
    IF ip <> '' THEN
      v_network := fingerprint('network:' || ip);
    END IF;

    -- One claim at a time per inbox, so two tabs cannot both get through.
    PERFORM pg_advisory_xact_lock(hashtext('psyllabus:free-claim:' || v_email));

    IF EXISTS (SELECT 1 FROM free_claims fc WHERE fc.email_key = v_email AND fc.user_id <> uid) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_email');
    END IF;
    IF v_device IS NOT NULL AND (
      SELECT count(*) FROM free_claims fc WHERE fc.device_key = v_device AND fc.user_id <> uid
    ) >= 2 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_device');
    END IF;
    IF v_network IS NOT NULL AND (
      SELECT count(*) FROM free_claims fc
       WHERE fc.network_key = v_network AND fc.user_id <> uid AND fc.created_at > now() - interval '1 day'
    ) >= 8 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'busy_network');
    END IF;

    INSERT INTO free_claims (user_id, email_key, device_key, network_key, subject)
    VALUES (uid, v_email, v_device, v_network, p_subject)
    ON CONFLICT (user_id) DO UPDATE SET subject = EXCLUDED.subject;
  END IF;

  PERFORM set_config('psyllabus.free_claim', 'on', true);
  UPDATE profiles SET free_subject = p_subject, free_subject_locked_until = 'infinity' WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'subject', p_subject);
END;
$$;
REVOKE ALL ON FUNCTION public.claim_free_subject(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_free_subject(text, text) TO authenticated;

/**
 * The free subject changes only through the claim, and only once. A direct
 * write from the app is quietly put back, the same way the other privileged
 * profile fields are. A direct database connection (support) still can.
 */
CREATE OR REPLACE FUNCTION public.guard_free_subject()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_trusted_profile_writer() OR current_setting('psyllabus.free_claim', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.free_subject := NULL;
    NEW.free_subject_locked_until := NULL;
  ELSE
    NEW.free_subject := OLD.free_subject;
    NEW.free_subject_locked_until := OLD.free_subject_locked_until;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_free_subject ON profiles;
CREATE TRIGGER profiles_guard_free_subject
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_free_subject();

-- The accounts that already chose: recorded so a new account on the same
-- inbox is recognised, and locked so the choice stays.
INSERT INTO free_claims (user_id, email_key, subject)
SELECT p.id, fingerprint('email:' || inbox_of(u.email)), p.free_subject
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
 WHERE p.free_subject IS NOT NULL AND u.email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

UPDATE profiles SET free_subject_locked_until = 'infinity' WHERE free_subject IS NOT NULL;

COMMIT;
