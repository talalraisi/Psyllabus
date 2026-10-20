-- Subjects can be changed whenever a student needs to.
--
-- 042 and 043 locked the list once there was work under it, because work is
-- filed under subject names and changing the list hid it. Hiding is not
-- losing: progress, mistakes and flashcards stay filed under their subject,
-- so removing one hides its work and adding it back brings it all back. The
-- page says exactly that, and students need a way to fix a list they got
-- wrong or that changed.
--
-- What still holds:
--   a free account cannot take its free subject off the list, or the free
--     place would fall to whichever subject came first;
--   the list stays a list of short names, at most twelve.
-- A direct connection (support) can still do anything.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profile_subjects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  everything boolean;
BEGIN
  IF is_trusted_profile_writer() THEN
    RETURN NEW;
  END IF;

  IF NEW.subjects IS NOT DISTINCT FROM OLD.subjects THEN
    RETURN NEW;
  END IF;

  IF NEW.subjects IS NULL OR jsonb_typeof(NEW.subjects) <> 'array' THEN
    RAISE EXCEPTION 'Subjects must be a list.' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_array_length(NEW.subjects) > 12
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.subjects) e WHERE jsonb_typeof(e) <> 'string' OR char_length(e #>> '{}') > 120) THEN
    RAISE EXCEPTION 'That is not a list of subjects.' USING ERRCODE = 'check_violation';
  END IF;

  everything := OLD.is_admin
    OR OLD.plan IN ('basic', 'premium')
    OR (OLD.access_expires_at IS NOT NULL AND OLD.access_expires_at > now());

  IF NOT everything AND OLD.free_subject IS NOT NULL AND NOT (NEW.subjects ? OLD.free_subject) THEN
    RAISE EXCEPTION 'Your free subject (%) stays on your list. Change the others, or unlock every subject.', OLD.free_subject
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
