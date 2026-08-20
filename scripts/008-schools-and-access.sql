-- Schools, roles, and access tiers.
--
-- A school gets a join code. Students who enter that code (or sign up with a
-- matching email domain) are linked to the school and get full access free.
-- Staff at the school can read aggregate progress for their own cohort only.
--
-- Run in the Supabase SQL editor after 007.

BEGIN;

-- ---------------------------------------------------------------------------
-- Schools
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  email_domain text,                        -- optional auto-join, e.g. 'abaoman.org'
  plan text NOT NULL DEFAULT 'school_free'  -- school_free | school_paid
    CHECK (plan IN ('school_free', 'school_paid')),
  seats int,                                -- null = unlimited
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schools_domain ON schools (lower(email_domain));

-- ---------------------------------------------------------------------------
-- Profile membership and role
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
  CHECK (role IN ('student', 'teacher', 'admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles (school_id);

-- ---------------------------------------------------------------------------
-- Helper functions.
-- SECURITY DEFINER so they read profiles without re-triggering profile RLS,
-- which would recurse when a policy on profiles calls them.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_school_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_school_staff()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role IN ('teacher', 'admin') AND school_id IS NOT NULL
     FROM profiles WHERE id = auth.uid()),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may look up a school in order to join it. Only non-secret
-- columns matter here; the join code is what the student already typed.
DROP POLICY IF EXISTS "Authenticated users can read schools" ON schools;
CREATE POLICY "Authenticated users can read schools"
  ON schools FOR SELECT TO authenticated USING (true);

-- Staff can read the profiles of students at their own school (for the cohort
-- dashboard). Students keep reading only their own row.
DROP POLICY IF EXISTS "Staff read own school profiles" ON profiles;
CREATE POLICY "Staff read own school profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (is_school_staff() AND school_id = current_school_id())
  );

-- Same rule for progress rows.
DROP POLICY IF EXISTS "Staff read own school progress" ON progress;
CREATE POLICY "Staff read own school progress"
  ON progress FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      is_school_staff()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = progress.user_id AND p.school_id = current_school_id()
      )
    )
  );

-- Existing "Users manage own progress" policy still governs writes, so staff
-- can read cohort data but never modify a student's record.

-- ---------------------------------------------------------------------------
-- Seed the first school. Change the name and domain to match, then share the
-- join code with students.
-- ---------------------------------------------------------------------------

INSERT INTO schools (name, join_code, email_domain, plan)
VALUES ('ABA Oman International School', 'ABA2026', NULL, 'school_free')
ON CONFLICT (join_code) DO NOTHING;

COMMIT;

-- Make yourself staff so you can open the School dashboard:
--   UPDATE profiles SET role = 'teacher',
--     school_id = (SELECT id FROM schools WHERE join_code = 'ABA2026')
--   WHERE id = auth.uid();
--
-- Or by email:
--   UPDATE profiles SET role = 'teacher',
--     school_id = (SELECT id FROM schools WHERE join_code = 'ABA2026')
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'you@example.com');
