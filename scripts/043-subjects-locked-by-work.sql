-- Subjects lock when there is work to lose, not the moment they are chosen.
--
-- Migration 042 made the list write-once, for a good reason: progress,
-- mistakes, flashcards and the predicted grade are all filed under a subject
-- name, so changing the list hides that work rather than moving it, and that
-- is exactly what made a fortnight of work look deleted.
--
-- But it was too strict, and a beta makes that obvious. 166 of 173 subjects
-- have no questions in them yet. A student signs up, picks the six subjects
-- they actually take, finds four of them empty, and under 042 is stuck with
-- that forever — punished by a rule whose entire purpose is to protect work
-- they do not have.
--
-- So the rule becomes what it always meant. Nothing earned under these
-- subjects means nothing to lose, and the list is still theirs to set. One
-- answer to one question is enough to close it, because from that point on a
-- change would hide something real.
--
-- A direct connection still passes, which keeps the support path open for a
-- list that was set wrong.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_profile_subjects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_work boolean;
BEGIN
  IF is_trusted_profile_writer() THEN
    RETURN NEW;
  END IF;

  IF NEW.subjects IS NOT DISTINCT FROM OLD.subjects THEN
    RETURN NEW;
  END IF;

  -- Never chosen: this is the choice.
  IF OLD.subjects IS NULL OR jsonb_array_length(OLD.subjects) = 0 THEN
    RETURN NEW;
  END IF;

  -- Anything at all that is filed under a subject name.
  SELECT EXISTS (SELECT 1 FROM progress        WHERE user_id = OLD.id)
      OR EXISTS (SELECT 1 FROM quiz_attempts   WHERE user_id = OLD.id)
      OR EXISTS (SELECT 1 FROM mistakes        WHERE user_id = OLD.id)
      OR EXISTS (SELECT 1 FROM flashcards      WHERE user_id = OLD.id)
    INTO has_work;

  IF NOT has_work THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Your subjects are set. Your levels, mistake bank and predicted grade are all filed under the subjects you picked, so changing the list now would hide that work rather than move it. Ask for help if the list is wrong.'
    USING ERRCODE = 'check_violation';
END;
$$;

COMMIT;
