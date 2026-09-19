-- Redeeming a code changed nothing, and the first fix for it was worse.
--
-- redeem_access_code is SECURITY DEFINER and is entitled to set plan =
-- 'premium'. The trigger that stops a client granting itself privileges
-- decided who to trust from request.jwt.claims, which still holds the
-- student's claims inside a definer function — so it put every privilege
-- column back and the update succeeded while changing nothing.
--
-- The first attempt trusted anything whose current_user was not a client
-- role. That is wrong in a way worth recording: the trigger function is
-- itself SECURITY DEFINER, so current_user inside it is always the owner, and
-- the test that caught it found a student could set their own plan. Trusting
-- the wrong signal is how a check becomes decoration.
--
-- So the signal is explicit instead: a transaction-local flag that only our
-- own definer functions set, immediately before the write they are entitled
-- to make, and clear immediately after. PostgREST cannot set it — it can only
-- call functions in the exposed schema, and set_config is not one of them.

BEGIN;

CREATE OR REPLACE FUNCTION is_trusted_profile_writer()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims text := current_setting('request.jwt.claims', true);
BEGIN
  -- A function of ours, mid-write, having said so.
  IF coalesce(current_setting('app.privileged_write', true), 'off') = 'on' THEN
    RETURN true;
  END IF;

  IF claims IS NULL OR claims = '' THEN
    RETURN true;  -- direct connection: already fully privileged
  END IF;

  RETURN (claims::jsonb ->> 'role') = 'service_role';
EXCEPTION
  WHEN others THEN
    RETURN false;  -- unparseable claims are not a reason to trust them
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_access_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- The privilege trigger refuses client writes to these columns, and a
  -- SECURITY DEFINER function looks like a client write to it: the role
  -- switches, the request claims do not. This flag is how a function we wrote
  -- says "this one is mine". It is transaction-local, cleared immediately
  -- after, and unreachable from PostgREST, which can only call functions in
  -- the exposed schema.
  PERFORM set_config('app.privileged_write', 'on', true);

  UPDATE profiles
  SET plan = 'premium',
      access_source = c.label,
      access_expires_at = v_expires,
      access_code_id = c.id,
      is_admin = (is_admin OR c.grants_admin)
  WHERE id = auth.uid();

  PERFORM set_config('app.privileged_write', 'off', true);

  INSERT INTO access_code_redemptions (code_id, user_id, email)
  VALUES (c.id, auth.uid(), v_email)
  ON CONFLICT DO NOTHING;

  UPDATE access_codes SET redemptions = redemptions + 1 WHERE id = c.id;

  RETURN jsonb_build_object(
    'ok', true, 'label', c.label, 'admin', c.grants_admin,
    'expires', v_expires
  );
END;
$function$;

COMMIT;
