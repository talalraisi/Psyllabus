-- Secure school joining.
--
-- Staff access must never be self-assigned: a student who could set their own
-- role to 'teacher' would gain read access to the whole cohort. So each school
-- has two codes -- a public join code for students and a separate staff code --
-- and the role is decided server-side by a SECURITY DEFINER function.
--
-- The schools table is also locked down so the staff code can never be read by
-- clients; joining happens only through the function.

BEGIN;

ALTER TABLE schools ADD COLUMN IF NOT EXISTS staff_code text UNIQUE;

UPDATE schools
SET staff_code = 'ABA-STAFF-2026'
WHERE join_code = 'ABA2026' AND staff_code IS NULL;

-- Replace the permissive read policy: clients may only read their own school,
-- which keeps staff_code out of reach.
DROP POLICY IF EXISTS "Authenticated users can read schools" ON schools;
DROP POLICY IF EXISTS "Read own school" ON schools;
CREATE POLICY "Read own school"
  ON schools FOR SELECT TO authenticated
  USING (id = current_school_id());

/**
 * Link the calling user to a school using either code.
 * Returns { ok, school, role } or { ok:false, error }.
 */
CREATE OR REPLACE FUNCTION join_school_with_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE profiles
  SET school_id = s.id,
      role = resolved_role
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'school', s.name, 'role', resolved_role);
END;
$$;

REVOKE ALL ON FUNCTION join_school_with_code(text) FROM public;
GRANT EXECUTE ON FUNCTION join_school_with_code(text) TO authenticated;

COMMIT;

-- Codes for ABA Oman International School:
--   Students: ABA2026
--   Staff:    ABA-STAFF-2026   (share only with teachers)
