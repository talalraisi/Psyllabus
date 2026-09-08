-- Two holes a student could walk through, and one they could throw a file into.
--
-- 1. PRIVILEGE ESCALATION
--
-- profiles carries is_admin, role, plan, access_source, access_expires_at and
-- access_code_id. The UPDATE policy is `auth.uid() = id`, which correctly stops
-- you editing somebody else's profile and does nothing at all to stop you
-- editing your own privileges. Postgres RLS cannot restrict columns, so the
-- policy was never going to catch this:
--
--   supabase.from('profiles').update({ is_admin: true, plan: 'premium' })
--
-- That is one line in a browser console, from any signed-in account, and it
-- grants admin and unlocks every paid subject. A trigger is the fix: on every
-- update from a normal session, the privileged columns are put back to what
-- they were. The service role, which only server-side code holds, is exempt so
-- redemption and admin tooling still work.
--
-- 2. UPLOADS
--
-- The avatars bucket is public with no size limit and no allowed types, so any
-- signed-in account could upload a 2GB file, or an .html that then serves from
-- the project's own domain, or an .exe with a link to send people. RLS keeps
-- uploads inside a folder named after the uploader; it says nothing about what
-- the file is. Now: images only, 2MB, and the bucket stops being a way to host
-- arbitrary content.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Privileged columns are server-owned
-- ---------------------------------------------------------------------------

-- current_setting returns an empty string when no JWT is attached, and
-- ''::jsonb throws. A direct database connection has no claims, so without
-- this guard every server-side script and migration errors on any profile
-- update. Anyone holding the connection string can drop the trigger anyway,
-- so a claimless connection is treated as the trusted server side rather than
-- as a suspicious one.
CREATE OR REPLACE FUNCTION is_trusted_profile_writer()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims text := current_setting('request.jwt.claims', true);
BEGIN
  IF claims IS NULL OR claims = '' THEN
    RETURN true;  -- direct connection: already fully privileged
  END IF;
  RETURN (claims::jsonb ->> 'role') = 'service_role';
EXCEPTION
  WHEN others THEN
    RETURN false;  -- unparseable claims are not a reason to trust them
END;
$$;

CREATE OR REPLACE FUNCTION protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The service role is server-side only and is how legitimate upgrades happen.
  IF is_trusted_profile_writer() THEN
    RETURN NEW;
  END IF;

  NEW.is_admin           := OLD.is_admin;
  NEW.role               := OLD.role;
  NEW.plan               := OLD.plan;
  NEW.access_source      := OLD.access_source;
  NEW.access_expires_at  := OLD.access_expires_at;
  NEW.access_code_id     := OLD.access_code_id;
  NEW.school_id          := OLD.school_id;

  -- Guardian consent is a record of something that happened, not a preference.
  -- Letting the client backdate or forge it would make the consent worthless
  -- as evidence, which is the only reason it is stored.
  NEW.guardian_consent_at   := OLD.guardian_consent_at;
  NEW.guardian_consent_text := OLD.guardian_consent_text;
  NEW.guardian_verified_at  := OLD.guardian_verified_at;

  -- The free-subject lock exists so the choice cannot be swapped daily. A
  -- client that can shorten it can ignore it.
  IF OLD.free_subject_locked_until IS NOT NULL
     AND OLD.free_subject_locked_until > now()
     AND NEW.free_subject IS DISTINCT FROM OLD.free_subject THEN
    NEW.free_subject := OLD.free_subject;
    NEW.free_subject_locked_until := OLD.free_subject_locked_until;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileges ON profiles;
CREATE TRIGGER profiles_protect_privileges
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_privileges();

-- A new profile must not arrive already privileged either.
CREATE OR REPLACE FUNCTION protect_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_trusted_profile_writer() THEN
    RETURN NEW;
  END IF;
  NEW.is_admin          := false;
  NEW.role              := 'student';
  NEW.plan              := 'free';
  NEW.access_source     := NULL;
  NEW.access_expires_at := NULL;
  NEW.access_code_id    := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_insert ON profiles;
CREATE TRIGGER profiles_protect_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_insert();

-- ---------------------------------------------------------------------------
-- 2. Uploads are images, and small ones
-- ---------------------------------------------------------------------------

UPDATE storage.buckets
SET file_size_limit = 2097152,  -- 2MB, well above any avatar
    allowed_mime_types = ARRAY[
      'image/png', 'image/jpeg', 'image/webp', 'image/gif'
    ]
WHERE id = 'avatars';

COMMIT;
