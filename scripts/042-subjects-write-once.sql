-- Subjects are chosen once.
--
-- Everything a student earns is keyed to a subject: progress rows, mistakes,
-- flashcards, the predicted grade. Changing the list after the fact does not
-- move any of that — it just stops the app showing it, which is exactly what
-- made it look like a fortnight of work had been deleted when somebody else's
-- onboarding wrote over the list.
--
-- The app already refuses: onboarding stops if the account is set up, and the
-- profile page has no control for it. This is the same rule in the one place
-- that cannot be got round by a client, a stale tab, or a bug in a page nobody
-- has looked at in a month.
--
-- A direct connection is still allowed through, because is_trusted_profile_writer()
-- returns true when there are no JWT claims. That is the support path: fixing a
-- list that was set wrong stays possible from a migration or a script, and
-- stays impossible from a browser.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profile_subjects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF is_trusted_profile_writer() THEN
    RETURN NEW;
  END IF;

  -- Nothing chosen yet, so this is the choice.
  IF OLD.subjects IS NULL OR jsonb_array_length(OLD.subjects) = 0 THEN
    RETURN NEW;
  END IF;

  -- Set already. Keep what is there and say why, rather than silently
  -- discarding the write and leaving the page to claim it saved.
  IF NEW.subjects IS DISTINCT FROM OLD.subjects THEN
    RAISE EXCEPTION
      'Subjects are chosen once. Your progress, mistakes and flashcards are filed under the subjects you picked, so changing the list would hide them rather than move them. Ask for help if the list is wrong.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_subjects ON profiles;
CREATE TRIGGER profiles_protect_subjects
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_subjects();

COMMIT;
