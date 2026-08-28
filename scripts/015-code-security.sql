-- Close the shared-code hole.
--
-- A single school code that anyone can type is worth exactly as much as the
-- most careless student who screenshots it. One post in a group chat and the
-- whole licence is public. Three changes fix that:
--
--   1. Email domain. A code can require the account's email to end in the
--      school's own domain, so a leaked code is useless without a school
--      address. This is how most education licensing actually works.
--
--   2. Seats. max_redemptions was already there but unenforced in practice
--      because nothing set it. School codes now get a real seat count, so even
--      a leak inside the school cannot exceed what was paid for.
--
--   3. Revocation. Profiles now record which code unlocked them, so a leaked
--      code can be switched off and everyone it let in can be put back on the
--      free plan in one statement.
--
-- For schools with no student email domain there are single-use codes: one
-- code per student, redeemable once, generated in bulk. See scripts/make-codes.mjs

BEGIN;

-- ---------------------------------------------------------------------------
-- Code restrictions
-- ---------------------------------------------------------------------------

-- Null means no restriction. Otherwise the email must end in one of these,
-- stored without the '@' so both 'school.edu' and subdomains are easy to match.
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS allowed_email_domains text[];

-- One code, one student. Used for schools that have no email domain of
-- their own; make-codes.mjs generates a batch and the school hands them out.
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS single_use boolean NOT NULL DEFAULT false;

-- How long the unlock lasts. Null keeps the old permanent behaviour; a school
-- licence should expire with the licence.
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS grants_months int;

-- Group a batch of single-use codes so one school's codes can be managed and
-- revoked together.
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS batch text;

-- ---------------------------------------------------------------------------
-- Which code unlocked this account, so a leak can be undone
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_code_id uuid REFERENCES access_codes(id);

CREATE INDEX IF NOT EXISTS profiles_access_code_idx ON profiles (access_code_id);

-- Record every redemption, so a code being passed around is visible rather
-- than just a number going up.
CREATE TABLE IF NOT EXISTS access_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

ALTER TABLE access_code_redemptions ENABLE ROW LEVEL SECURITY;
-- Written only by the SECURITY DEFINER function below; never read by clients.

-- ---------------------------------------------------------------------------
-- Redemption, with the restrictions actually enforced
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION redeem_access_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c            record;
  v_email      text;
  v_domain     text;
  v_expires    timestamptz;
  v_domain_ok  boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_domain := lower(split_part(coalesce(v_email, ''), '@', 2));

  p_code := upper(btrim(p_code));

  SELECT * INTO c FROM access_codes
  WHERE upper(code) = p_code AND active
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code was not recognised.');
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code has expired.');
  END IF;

  -- Already redeemed by this account: report success rather than burn a seat.
  IF EXISTS (SELECT 1 FROM access_code_redemptions r
             WHERE r.code_id = c.id AND r.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', true, 'label', c.label, 'admin', c.grants_admin,
                              'note', 'You had already used this code.');
  END IF;

  -- A single-use code is spent the moment anyone redeems it.
  IF c.single_use AND c.redemptions >= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'That code has already been used. Each student gets their own.');
  END IF;

  IF c.max_redemptions IS NOT NULL AND c.redemptions >= c.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Every place on this licence has been taken. Ask your school to add more.');
  END IF;

  -- The domain check is what makes a leaked code worthless outside the school.
  IF c.allowed_email_domains IS NOT NULL AND array_length(c.allowed_email_domains, 1) > 0 THEN
    SELECT bool_or(v_domain = d OR v_domain LIKE '%.' || d)
      INTO v_domain_ok
      FROM unnest(c.allowed_email_domains) AS d;

    IF NOT coalesce(v_domain_ok, false) THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'This code only works with a ' || array_to_string(c.allowed_email_domains, ' or ') ||
        ' email address. Sign up with your school email to use it.');
    END IF;
  END IF;

  IF c.grants_months IS NOT NULL THEN
    v_expires := now() + (c.grants_months || ' months')::interval;
  END IF;

  UPDATE profiles
  SET plan = 'premium',
      access_source = c.label,
      access_expires_at = v_expires,
      access_code_id = c.id,
      is_admin = (is_admin OR c.grants_admin)
  WHERE id = auth.uid();

  INSERT INTO access_code_redemptions (code_id, user_id, email)
  VALUES (c.id, auth.uid(), v_email)
  ON CONFLICT DO NOTHING;

  UPDATE access_codes SET redemptions = redemptions + 1 WHERE id = c.id;

  RETURN jsonb_build_object(
    'ok', true, 'label', c.label, 'admin', c.grants_admin,
    'expires', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION redeem_access_code(text) FROM public;
GRANT EXECUTE ON FUNCTION redeem_access_code(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Lock the existing school code to its own domain and give it seats.
-- Adjust the domain to whatever the school actually issues.
-- ---------------------------------------------------------------------------

UPDATE access_codes
SET allowed_email_domains = ARRAY['abaoman.org', 'abaoman.edu.om'],
    max_redemptions = 250,
    grants_months = 12
WHERE upper(code) = 'ABA2026';

COMMIT;

-- Revoke a leaked code and everyone it let in:
--   UPDATE access_codes SET active = false WHERE code = 'LEAKED';
--   UPDATE profiles SET plan = 'free', access_source = NULL, access_code_id = NULL
--   WHERE access_code_id = (SELECT id FROM access_codes WHERE code = 'LEAKED');
