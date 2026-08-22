-- Student-only access model.
--
-- Removes the teacher/cohort concept: PSyllabus is a study tool, not a class
-- management system. A school licence now just issues an access code that
-- unlocks premium for its students.
--
-- Adds the entitlement columns the paywall reads.

BEGIN;

-- ---------------------------------------------------------------------------
-- Entitlement on the profile
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'premium'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_source text;      -- e.g. 'ABA Oman International School'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- Access codes replace the school join/staff code pair
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,                 -- shown to the student as the unlock source
  kind text NOT NULL DEFAULT 'school'  -- school | admin | promo
    CHECK (kind IN ('school', 'admin', 'promo')),
  grants_admin boolean NOT NULL DEFAULT false,
  max_redemptions int,                 -- null = unlimited
  redemptions int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
-- Codes are never listed to clients; redemption goes through the function.
DROP POLICY IF EXISTS "No direct read of access codes" ON access_codes;

INSERT INTO access_codes (code, label, kind, grants_admin) VALUES
  ('ABA2026', 'ABA Oman International School', 'school', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO access_codes (code, label, kind, grants_admin) VALUES
  ('PSYLLABUS-DEV', 'Developer access', 'admin', true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Redeem a code. SECURITY DEFINER so entitlement can never be self-assigned.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION redeem_access_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

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

  IF c.max_redemptions IS NOT NULL AND c.redemptions >= c.max_redemptions THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code has reached its limit.');
  END IF;

  UPDATE profiles
  SET plan = 'premium',
      access_source = c.label,
      is_admin = (is_admin OR c.grants_admin)
  WHERE id = auth.uid();

  UPDATE access_codes SET redemptions = redemptions + 1 WHERE id = c.id;

  RETURN jsonb_build_object('ok', true, 'label', c.label, 'admin', c.grants_admin);
END;
$$;

REVOKE ALL ON FUNCTION redeem_access_code(text) FROM public;
GRANT EXECUTE ON FUNCTION redeem_access_code(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Retire the staff-read policies. Students only ever see their own data.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff read own school profiles" ON profiles;
DROP POLICY IF EXISTS "Staff read own school progress" ON progress;

DROP POLICY IF EXISTS "Users view own profile" ON profiles;
CREATE POLICY "Users view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Anyone who already redeemed the school code keeps their access.
UPDATE profiles SET plan = 'premium', access_source = 'ABA Oman International School'
WHERE school_id IS NOT NULL AND plan = 'free';

COMMIT;

-- Grant yourself permanent admin access:
--   UPDATE profiles SET is_admin = true, plan = 'premium', access_source = 'Developer'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
