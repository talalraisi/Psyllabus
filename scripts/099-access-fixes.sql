-- Three fixes to access before the pilot.
--
-- 1. A code that grants a set number of months no longer sets plan = 'premium'.
--    The plan column is permanent and nothing ever reset it, so a three-month
--    pilot code was Premium for good. Time-limited access now lives only in
--    access_expires_at, which getTier(), claim_free_subject and
--    protect_profile_subjects already honour until it passes. Codes with no
--    months (a standing licence) still set the plan, as before.
--
-- 2. Redeeming locks the code's row, so two people redeeming one single-use
--    code at the same moment cannot both get it.
--
-- 3. join_school_with_code says it is a trusted writer. Without the flag the
--    protect_profile_privileges trigger put school_id and role back, so the
--    call reported success and changed nothing.
--
-- And the multi-use, never-expiring admin code is switched off. Admins who
-- already have it keep it; new admins are made with scripts/make-admin.mjs.

BEGIN;

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

  -- FOR UPDATE: a second redemption of the same code waits here until the
  -- first has committed, then sees the new redemption count.
  SELECT * INTO c FROM access_codes
  WHERE upper(code) = p_code AND active
  LIMIT 1
  FOR UPDATE;

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

  -- See 056: the flag is how a function of ours tells the privilege trigger
  -- this write is trusted. Transaction-local and cleared straight after.
  PERFORM set_config('app.privileged_write', 'on', true);

  UPDATE profiles
  SET plan = CASE WHEN v_expires IS NULL THEN 'premium' ELSE plan END,
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

CREATE OR REPLACE FUNCTION public.join_school_with_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  resolved_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  p_code := upper(btrim(p_code));

  SELECT * INTO s FROM schools
  WHERE upper(join_code) = p_code
     OR (staff_code IS NOT NULL AND upper(staff_code) = p_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code was not recognised.');
  END IF;

  IF s.staff_code IS NOT NULL AND upper(s.staff_code) = p_code THEN
    resolved_role := 'teacher';
  ELSE
    resolved_role := 'student';
  END IF;

  PERFORM set_config('app.privileged_write', 'on', true);

  UPDATE profiles
  SET school_id = s.id,
      role = resolved_role
  WHERE id = auth.uid();

  PERFORM set_config('app.privileged_write', 'off', true);

  RETURN jsonb_build_object('ok', true, 'school', s.name, 'role', resolved_role);
END;
$function$;

UPDATE access_codes
SET active = false
WHERE grants_admin AND active AND label = 'Developer access';

COMMIT;
